// /api/register.js

import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
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

  const kv = createClient({
    url: KV_REST_API_URL,
    token: KV_REST_API_TOKEN,
  });

  const normalizedName = name.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  // MUDANÇA: Verifica o nome e o email em paralelo para maior eficiência
  const [existingUser, nameTaken] = await Promise.all([
    kv.get(`user:${normalizedEmail}`),
    kv.get(`name:${normalizedName}`)
  ]);
  
  if (existingUser) {
    return res.status(409).json({ error: 'Email already in use' });
  }
  if (nameTaken) {
    return res.status(409).json({ error: 'Name already taken' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { name, email: normalizedEmail, password: hashedPassword, following: [] };
  
  // MUDANÇA: Salva tanto o usuário quanto a referência do nome
  await Promise.all([
    kv.set(`user:${normalizedEmail}`, user),
    kv.set(`name:${normalizedName}`, 1) // Usa a chave para marcar o nome como usado
  ]);

  const token = jwt.sign({ email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });
  
  res.status(201).json({ token });
}