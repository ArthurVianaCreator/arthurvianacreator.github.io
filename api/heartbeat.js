import jwt from 'jsonwebtoken';
import { createClient } from '@vercel/kv';

async function authenticate(req, env) {
  const { JWT_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN } = env;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    return email;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const userEmail = await authenticate(req, process.env);
    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    const userKey = `user:${userEmail}`;
    const user = await kv.get(userKey);

    if (user) {
      user.lastSeen = Date.now();
      await kv.set(userKey, user);
    }

    return res.status(204).end(); // 204 No Content is efficient for this

  } catch (error) {
    console.error('Heartbeat API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}