// /api/register.js

import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // MUDANÇA 1: Verificação explícita das variáveis de ambiente no início
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error: Missing environment variables.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // MUDANÇA 2: Simplificando a criação do cliente KV (forma recomendada)
  const kv = createClient({
    url: KV_REST_API_URL,
    token: KV_REST_API_TOKEN,
  });

  const existingUser = await kv.get(`user:${email}`);
  if (existingUser) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { name, email, password: hashedPassword, following: [] };
  
  await kv.set(`user:${email}`, user);

  // A linha que estava falhando
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
  
  res.status(201).json({ token });
}