// /api/popular-artists.js
import { createClient } from '@vercel/kv';

// Função auxiliar para buscar dados de vários artistas do Spotify
async function getSpotifySeveralArtists(ids, env) {
    // Primeiro, precisamos de um token do Spotify
    const basicAuth = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
        throw new Error('Failed to fetch Spotify token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Agora, busque os dados dos artistas com o token
    const artistsResponse = await fetch(`https://api.spotify.com/v1/artists?ids=${ids.join(',')}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!artistsResponse.ok) {
        throw new Error(`Spotify API Error: ${artistsResponse.status}`);
    }
    
    return artistsResponse.json();
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const kv = createClient({
            url: process.env.KV_REST_API_URL,
            token: process.env.KV_REST_API_TOKEN,
        });

        // 1. Encontrar todos os usuários
        const userKeys = [];
        for await (const key of kv.scanIterator({ match: 'user:*' })) {
            userKeys.push(key);
        }

        if (userKeys.length === 0) {
            return res.status(200).json({ artists: [] });
        }

        // 2. Obter a lista 'following' de todos os usuários
        const allUsers = await kv.mget(...userKeys);

        // 3. Contar a popularidade de cada artista
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

        // 4. Ordenar por popularidade e pegar o Top 9
        const sortedArtistIds = Object.keys(artistFollowCounts).sort((a, b) => {
            return artistFollowCounts[b] - artistFollowCounts[a];
        });
        const top9ArtistIds = sortedArtistIds.slice(0, 9);
        
        if (top9ArtistIds.length === 0) {
            return res.status(200).json({ artists: [] });
        }

        // 5. Buscar os dados completos dos artistas no Spotify
        const popularArtistsData = await getSpotifySeveralArtists(top9ArtistIds, process.env);
        
        res.status(200).json(popularArtistsData);

    } catch (error) {
        console.error('Popular Artists API Error:', error);
        return res.status(500).json({ error: 'A server-side error occurred.' });
    }
}