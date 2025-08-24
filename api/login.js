// /api/login.js
import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }
  
  const { email, password } = req.body;
  const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const user = await kv.get(`user:${email.toLowerCase()}`);

  if (!user) { return res.status(401).json({ error: 'Invalid email or password' }); }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) { return res.status(401).json({ error: 'Invalid email or password' }); }

  const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(200).json({ token });
}