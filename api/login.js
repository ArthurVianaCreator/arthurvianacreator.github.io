// /api/login.js

import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // MUDANÇA 1: Verificação explícita das variáveis de ambiente
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error: Missing environment variables.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const { email, password } = req.body;
  
  // MUDANÇA 2: Simplificando a criação do cliente
  const kv = createClient({
    url: KV_REST_API_URL,
    token: KV_REST_API_TOKEN,
  });

  const user = await kv.get(`user:${email}`);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
  
  res.status(200).json({ token });
}