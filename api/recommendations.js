import jwt from 'jsonwebtoken';
import { createClient } from '@vercel/kv';

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
    if (!apiResponse.ok) throw new Error(`Spotify API Error: ${apiResponse.statusText}`);
    
    return apiResponse.json();
}

export default async function handler(req, res) {
    const { JWT_SECRET } = process.env;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    
    try {
        const { email } = jwt.verify(token, JWT_SECRET);
        const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
        const user = await kv.get(`user:${email}`);

        if (!user || !user.following || user.following.length === 0) {
            // Se o usuário não segue ninguém, retorna artistas populares como fallback
            const popularArtists = await getSpotifyData('artists?ids=4iHNK0tOyZPYnBU7nGAgpQ,1vCWHaC5f2uS3yhpwWbIA6,06HL4z0CvFAxyc27GXpf02,6eUKZXaKkcviH0Ku9w2n3V,04gDigrS5kc9YWfZHwBETP,1Xyo4u8uXC1ZmMpatF05PJ,7dGJo4pcD2V6oG8kP0tJRR', process.env);
            return res.status(200).json(popularArtists);
        }

        const seedArtistIds = user.following.map(a => a.id).sort(() => 0.5 - Math.random()).slice(0, 5);
        const recommendations = await getSpotifyData(`recommendations?limit=10&seed_artists=${seedArtistIds.join(',')}`, process.env);
        
        // Extrai artistas únicos das faixas recomendadas
        const recommendedArtists = recommendations.tracks.map(track => track.artists[0]);
        const uniqueArtistIds = [...new Set(recommendedArtists.map(a => a.id))];
        
        // Busca os detalhes completos dos artistas
        const artistsDetails = await getSpotifyData(`artists?ids=${uniqueArtistIds.join(',')}`, process.env);
        
        res.status(200).json(artistsDetails);

    } catch (error) {
        console.error('Recommendations API Error:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations.' });
    }
}