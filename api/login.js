import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !JWT_SECRET) {
    console.error('Server configuration error: Missing environment variables for login.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, password } = req.body;
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    const userKey = `user:${email.toLowerCase()}`;
    const user = await kv.get(userKey);

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update lastSeen timestamp on login
    user.lastSeen = Date.now();
    await kv.set(userKey, user);

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token });

  } catch (error) {
    console.error('Login API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}