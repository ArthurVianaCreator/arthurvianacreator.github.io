// /api/register.js
import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // ... (código de validação anterior) ...
  const { name, email, password } = req.body;
  // ... (código de validação) ...

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  const normalizedName = name.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const [existingUser, nameTaken] = await Promise.all([
    kv.get(`user:${normalizedEmail}`),
    kv.get(`name:${normalizedName}`)
  ]);
  
  if (existingUser) { return res.status(409).json({ error: 'Email already in use' }); }
  if (nameTaken) { return res.status(409).json({ error: 'Name already taken (case-insensitive)' }); }

  const hashedPassword = await bcrypt.hash(password, 10);
  // MUDANÇA: Adiciona o campo 'votes' ao criar um novo usuário
  const user = { name: name.trim(), email: normalizedEmail, password: hashedPassword, following: [], votes: {} };
  
  await Promise.all([
    kv.set(`user:${normalizedEmail}`, user),
    kv.set(`name:${normalizedName}`, 1)
  ]);

  const token = jwt.sign({ email: normalizedEmail }, process.env.JWT_SECRET, { expiresIn: '7d' });
  
  res.status(201).json({ token });
}