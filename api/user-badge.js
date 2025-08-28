import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

async function authenticateAndGetUser(req, env) {
  const { JWT_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN } = env;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    const user = await kv.get(`user:${email}`);
    return user;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const currentUser = await authenticateAndGetUser(req, process.env);
  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { badge } = req.body;
  const validBadges = ['discoverer', 'explorer', 'collector'];
  if (!badge || !validBadges.includes(badge)) {
    return res.status(400).json({ error: 'Invalid badge provided.' });
  }

  try {
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    
    // Garante que o array de badges exista
    if (!Array.isArray(currentUser.badges)) {
        currentUser.badges = [];
    }

    // Remove as insígnias de personalidade antigas antes de adicionar a nova
    currentUser.badges = currentUser.badges.filter(b => !validBadges.includes(b));
    currentUser.badges.push(badge);

    await kv.set(`user:${currentUser.email}`, currentUser);
    
    // Retorna o usuário atualizado sem dados sensíveis
    const { password, ip, ...safeUserData } = currentUser;
    res.status(200).json(safeUserData);

  } catch (error) {
    console.error('User Badge API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}