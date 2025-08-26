// pages/api/user-profile.js

import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'User name is required.' });
  }

  try {
    const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    
    // 1. Encontrar o email associado ao nome.
    const normalizedName = name.toLowerCase();
    const userEmail = await kv.get(`name:${normalizedName}`);
    
    if (!userEmail) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // 2. Buscar o objeto completo do usuário usando o email.
    const user = await kv.get(`user:${userEmail}`);

    if (!user) {
      return res.status(404).json({ error: 'User data not found.' });
    }

    // 3. Retornar apenas os dados públicos e seguros.
    const publicData = {
      name: user.name,
      avatar: user.avatar || null,
      badges: user.badges || [],
      following: user.following || [],
      friends: user.friends || [],
    };

    res.status(200).json(publicData);

  } catch (error) {
    console.error('User Profile API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}