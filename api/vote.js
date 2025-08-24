// /api/vote.js
import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

// Função authenticate não precisa de alteração, já é segura.
async function authenticate(req, env) {
    const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = env;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
      const { email } = jwt.verify(token, JWT_SECRET);
      const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
      return await kv.get(`user:${email}`);
    } catch (error) { return null; }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try { // Adicionado bloco try...catch
        const user = await authenticate(req, process.env);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { itemId, itemType, voteType } = req.body;
        if (!itemId || !itemType || !voteType) {
            return res.status(400).json({ error: 'Missing required voting information' });
        }

        const kv = createClient({
            url: process.env.KV_REST_API_URL,
            token: process.env.KV_REST_API_TOKEN,
        });
        
        const itemKey = `${itemType}:${itemId}`;
        const likeKey = `likes:${itemKey}`;
        const dislikeKey = `dislikes:${itemKey}`;

        user.votes = user.votes || {};
        const currentVote = user.votes[itemKey];

        const multi = kv.multi();

        if (currentVote === voteType) { // Undoing vote
            multi.decr(voteType === 'like' ? likeKey : dislikeKey);
            delete user.votes[itemKey];
        } else {
            if (currentVote) { // Changing vote
                multi.decr(currentVote === 'like' ? likeKey : dislikeKey);
            }
            multi.incr(voteType === 'like' ? likeKey : dislikeKey);
            user.votes[itemKey] = voteType;
        }

        multi.set(`user:${user.email}`, user);
        await multi.exec();

        const [likes, dislikes] = await kv.mget(likeKey, dislikeKey);

        res.status(200).json({ likes: likes || 0, dislikes: dislikes || 0 });

    } catch (error) {
        console.error('Vote API Error:', error);
        return res.status(500).json({ error: 'A server-side error occurred while casting vote.' });
    }
}