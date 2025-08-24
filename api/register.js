// /api/register.js

import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs'; // <-- MUDANÇA AQUI
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  const existingUser = await kv.get(`user:${email}`);
  if (existingUser) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { name, email, password: hashedPassword, following: [] };
  
  await kv.set(`user:${email}`, JSON.stringify(user));

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  
  res.status(201).json({ token });
}