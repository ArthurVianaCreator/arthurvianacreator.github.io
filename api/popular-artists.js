// /api/popular-artists.js
import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const SPOTIFY_TOKEN_KEY = 'spotify_access_token';

async function getSpotifyAccessToken() {
    let token = await kv.get(SPOTIFY_TOKEN_KEY);
    if (token) return token;

    const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
    const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
    });

    if (!response.ok) throw new Error('Failed to fetch new Spotify token.');

    const data = await response.json();
    await kv.set(SPOTIFY_TOKEN_KEY, data.access_token, { ex: data.expires_in - 300 });
    return data.access_token;
}

async function fetchFromSpotify(endpoint) {
    const accessToken = await getSpotifyAccessToken();
    const apiResponse = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!apiResponse.ok) throw new Error(`Spotify API Error: ${apiResponse.statusText}`);
    return apiResponse.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  
  try {
    const userKeys = [];
    for await (const key of kv.scanIterator({ match: 'user:*' })) {
        userKeys.push(key);
    }
    if (userKeys.length === 0) return res.status(200).json({ artists: [] });
    
    const allUsers = await kv.mget(...userKeys);
    const artistFollowCounts = {};
    allUsers.forEach(user => {
        if (user && Array.isArray(user.following)) {
            user.following.forEach(artist => {
                if (artist && artist.id) artistFollowCounts[artist.id] = (artistFollowCounts[artist.id] || 0) + 1;
            });
        }
    });
    
    const sortedArtistIds = Object.keys(artistFollowCounts).sort((a, b) => artistFollowCounts[b] - artistFollowCounts[a]);
    const top9ArtistIds = sortedArtistIds.slice(0, 9);
    
    if (top9ArtistIds.length === 0) return res.status(200).json({ artists: [] });
    
    const popularArtistsData = await fetchFromSpotify(`artists?ids=${top9ArtistIds.join(',')}`);
    res.status(200).json(popularArtistsData);
    
  } catch (error) {
    console.error('Popular Artists API Error:', error.message);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}