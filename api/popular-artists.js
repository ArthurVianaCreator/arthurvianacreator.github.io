import { createClient } from '@vercel/kv';

async function getSpotifySeveralArtists(ids, env) {
    const basicAuth = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
    });
    if (!tokenResponse.ok) throw new Error('Failed to fetch Spotify token');
    const tokenData = await tokenResponse.json();
    const artistsResponse = await fetch(`https://api.spotify.com/v1/artists?ids=${ids.join(',')}`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    if (!artistsResponse.ok) throw new Error(`Spotify API Error: ${artistsResponse.status}`);
    return artistsResponse.json();
}

export default async function handler(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('Server configuration error: Missing environment variables for popular artists.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }
  
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    
    const migrationFlag = await kv.get('popularity_migrated');

    if (!migrationFlag) {
        const userKeys = [];
        for await (const key of kv.scanIterator({ match: 'user:*' })) {
            userKeys.push(key);
        }
        
        if (userKeys.length > 0) {
            const allUsers = await kv.mget(...userKeys);
            const artistFollowCounts = {};
            allUsers.forEach(user => {
                if (user && Array.isArray(user.following)) {
                    user.following.forEach(artist => {
                        if (artist && artist.id) {
                            artistFollowCounts[artist.id] = (artistFollowCounts[artist.id] || 0) + 1;
                        }
                    });
                }
            });

            if (Object.keys(artistFollowCounts).length > 0) {
                const multi = kv.multi();
                for (const artistId in artistFollowCounts) {
                    multi.zadd('artist_popularity', { score: artistFollowCounts[artistId], member: artistId });
                }
                await multi.exec();
            }
        }
        
        await kv.set('popularity_migrated', 'true');
    }

    const top9ArtistIds = await kv.zrange('artist_popularity', 0, 8, { rev: true });

    if (!top9ArtistIds || top9ArtistIds.length === 0) {
        return res.status(200).json({ artists: [] });
    }

    const popularArtistsData = await getSpotifySeveralArtists(top9ArtistIds, process.env);
    res.status(200).json(popularArtistsData);

  } catch (error) {
    console.error('Popular Artists API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}