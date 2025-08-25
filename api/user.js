import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

async function authenticate(req, env) {
  const { JWT_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN } = env;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    return await kv.get(`user:${email}`);
  } catch (error) {
    console.error('Authentication Error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !JWT_SECRET) {
    console.error('Server configuration error: Missing environment variables for user management.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }
  
  try {
    const user = await authenticate(req, process.env);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    if (req.method === 'GET') {
      const { password, ...userData } = user;
      res.status(200).json(userData);
    } else if (req.method === 'PUT') {
      // ... (lógica do PUT inalterada)
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('User API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}