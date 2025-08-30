// /api/related-artists.js

async function getSpotifyData(endpoint, env) {
    const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = env;
    const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
    });
    if (!tokenResponse.ok) throw new Error('Failed to fetch Spotify token');
    
    const tokenData = await tokenResponse.json();
    const apiResponse = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.json().catch(() => ({ message: apiResponse.statusText }));
        throw new Error(`Spotify API Error: ${errorBody.error?.message || apiResponse.statusText}`);
    }
    
    return apiResponse.json();
}

export default async function handler(req, res) {
    const { artistId } = req.query;

    if (!artistId) {
        return res.status(400).json({ error: 'Artist ID is required.' });
    }

    try {
        const relatedArtists = await getSpotifyData(`artists/${artistId}/related-artists`, process.env);
        res.status(200).json(relatedArtists);
    } catch (error) {
        console.error('Related Artists API Error:', error);
        res.status(500).json({ error: 'Failed to fetch related artists.' });
    }
}