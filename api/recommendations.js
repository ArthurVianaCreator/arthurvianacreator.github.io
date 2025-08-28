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

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.json().catch(() => ({ message: apiResponse.statusText }));
        throw new Error(`Spotify API Error: ${errorBody.error?.message || apiResponse.statusText}`);
    }
    
    return apiResponse.json();
}

// Função de fallback para buscar artistas populares
async function getPopularArtistsFallback(env) {
    const popularArtistIds = '4iHNK0tOyZPYnBU7nGAgpQ,1vCWHaC5f2uS3yhpwWbIA6,06HL4z0CvFAxyc27GXpf02,6eUKZXaKkcviH0Ku9w2n3V,04gDigrS5kc9YWfZHwBETP,1Xyo4u8uXC1ZmMpatF05PJ,7dGJo4pcD2V6oG8kP0tJRR';
    return getSpotifyData(`artists?ids=${popularArtistIds}`, env);
}

export default async function handler(req, res) {
    const { JWT_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    
    try {
        const { email } = jwt.verify(token, JWT_SECRET);
        const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
        const user = await kv.get(`user:${email}`);

        // Se o usuário não existe ou não segue ninguém, usa o fallback imediatamente.
        if (!user || !user.following || user.following.length === 0) {
            const popularArtists = await getPopularArtistsFallback(process.env);
            return res.status(200).json(popularArtists);
        }

        let artistsDetails;
        
        // --- INÍCIO DA CORREÇÃO DE RESILIÊNCIA ---
        try {
            // 1. Tenta obter recomendações personalizadas
            const seedArtistIds = user.following.map(a => a.id).sort(() => 0.5 - Math.random()).slice(0, 5);
            const recommendations = await getSpotifyData(`recommendations?limit=10&seed_artists=${seedArtistIds.join(',')}`, process.env);
            
            // 2. Extrai os IDs de forma segura
            const validArtistIds = recommendations.tracks.reduce((acc, track) => {
                if (track && track.artists && track.artists.length > 0 && track.artists[0].id) {
                    acc.push(track.artists[0].id);
                }
                return acc;
            }, []);
            
            const uniqueArtistIds = [...new Set(validArtistIds)];

            // 3. Se encontrou artistas, busca os detalhes deles
            if (uniqueArtistIds.length > 0) {
                artistsDetails = await getSpotifyData(`artists?ids=${uniqueArtistIds.join(',')}`, process.env);
            }
        } catch (error) {
            console.error("Could not fetch personalized recommendations, using fallback. Error:", error.message);
            // Se qualquer passo acima falhar, a variável artistsDetails continuará vazia,
            // e o código prosseguirá para o fallback.
        }
        // --- FIM DA CORREÇÃO DE RESILIÊNCIA ---

        // 4. Se as recomendações personalizadas funcionaram, retorna o resultado.
        if (artistsDetails && artistsDetails.artists && artistsDetails.artists.length > 0) {
            return res.status(200).json(artistsDetails);
        }
        
        // 5. Se não, retorna os artistas populares como fallback.
        const popularArtists = await getPopularArtistsFallback(process.env);
        return res.status(200).json(popularArtists);

    } catch (error) {
        // Este catch externo lida com erros maiores, como token inválido ou falha no banco de dados.
        console.error('Recommendations API Error:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations.' });
    }
}