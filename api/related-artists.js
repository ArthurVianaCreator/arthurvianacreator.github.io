// /api/related-artists.js
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
    await kv.set(SPOTIFY_TOKEN_KEY, data.access_token, { ex: data.expires_in - 300 }); // Cache for 5 mins less than expiry
    return data.access_token;
}

async function fetchFromSpotify(endpoint) {
    const accessToken = await getSpotifyAccessToken();
    const apiResponse = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!apiResponse.ok) {
        console.error(`Spotify API Error for ${endpoint}:`, await apiResponse.text());
        throw new Error(`Spotify API Error: ${apiResponse.statusText}`);
    }
    return apiResponse.json();
}

export default async function handler(req, res) {
    const { artistId } = req.query;

    if (!artistId) {
        return res.status(400).json({ error: 'Artist ID is required.' });
    }

    try {
        const relatedArtists = await fetchFromSpotify(`artists/${artistId}/related-artists`);
        res.status(200).json(relatedArtists);
    } catch (error) {
        console.error('Related Artists API Error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch related artists.' });
    }
}