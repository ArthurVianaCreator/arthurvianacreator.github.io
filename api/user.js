// /api/user.js

import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

async function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  
  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  try {
    const { email } = jwt.verify(token, process.env.JWT_SECRET);
    const userString = await kv.get(`user:${email}`);
    return userString ? JSON.parse(userString) : null;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  const user = await authenticate(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  if (req.method === 'GET') {
    const { password, ...userData } = user; // NUNCA retorne a senha
    res.status(200).json(userData);
  } else if (req.method === 'PUT') {
    const updatedData = req.body;
    if (updatedData.name) user.name = updatedData.name;
    if (Array.isArray(updatedData.following)) user.following = updatedData.following;
    
    await kv.set(`user:${user.email}`, JSON.stringify(user));
    
    const { password, ...userData } = user;
    res.status(200).json(userData);
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}