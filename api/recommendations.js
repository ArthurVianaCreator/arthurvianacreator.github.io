// /api/recommendations.js
import jwt from 'jsonwebtoken';
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

async function getPopularArtistsFallback() {
    const popularArtistIds = '4iHNK0tOyZPYnBU7nGAgpQ,1vCWHaC5f2uS3yhpwWbIA6,06HL4z0CvFAxyc27GXpf02,6eUKZXaKkcviH0Ku9w2n3V,04gDigrS5kc9YWfZHwBETP,1Xyo4u8uXC1ZmMpatF05PJ,7dGJo4pcD2V6oG8kP0tJRR';
    return fetchFromSpotify(`artists?ids=${popularArtistIds}`);
}

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    
    try {
        const { email } = jwt.verify(token, process.env.JWT_SECRET);
        const user = await kv.get(`user:${email}`);

        if (!user || !user.following || user.following.length === 0) {
            const popularArtists = await getPopularArtistsFallback();
            return res.status(200).json(popularArtists);
        }

        let artistsDetails;
        try {
            const seedArtistIds = user.following.map(a => a.id).sort(() => 0.5 - Math.random()).slice(0, 5);
            const recommendations = await fetchFromSpotify(`recommendations?limit=10&seed_artists=${seedArtistIds.join(',')}`);
            
            const validArtistIds = recommendations.tracks.reduce((acc, track) => {
                if (track?.artists?.[0]?.id) acc.push(track.artists[0].id);
                return acc;
            }, []);
            
            const uniqueArtistIds = [...new Set(validArtistIds)];

            if (uniqueArtistIds.length > 0) {
                artistsDetails = await fetchFromSpotify(`artists?ids=${uniqueArtistIds.join(',')}`);
            }
        } catch (error) {
            console.error("Could not fetch personalized recommendations, using fallback. Error:", error.message);
        }

        if (artistsDetails?.artists?.length > 0) {
            return res.status(200).json(artistsDetails);
        }
        
        const popularArtists = await getPopularArtistsFallback();
        return res.status(200).json(popularArtists);

    } catch (error) {
        console.error('Recommendations API Error:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations.' });
    }
}