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
      const { password, ip, ...userData } = user;
      res.status(200).json(userData);
    } else if (req.method === 'PUT') {
      const updatedData = req.body;
      let userWasUpdated = false;

      if (updatedData.name) {
        const newName = updatedData.name.trim();
        if (newName.length <= 4) { return res.status(400).json({ error: 'Name must be more than 4 characters long' }); }
        if (/\s/.test(newName)) { return res.status(400).json({ error: 'Name cannot contain spaces' }); }
        const normalizedNewName = newName.toLowerCase();
        const normalizedOldName = (user.name || '').trim().toLowerCase();
        if (normalizedNewName !== normalizedOldName) {
          const nameTaken = await kv.get(`name:${normalizedNewName}`);
          if (nameTaken) { return res.status(409).json({ error: 'Name already taken (case-insensitive)' }); }
          const multi = kv.multi();
          if (normalizedOldName) {
            multi.del(`name:${normalizedOldName}`);
          }
          // CORREÇÃO: Salva o email do usuário, não o número 1.
          multi.set(`name:${normalizedNewName}`, user.email);
          user.name = newName;
          await multi.exec();
        } else {
          user.name = newName;
        }
        userWasUpdated = true;
      }
      
      if (Array.isArray(updatedData.following)) {
        user.following = updatedData.following;
        userWasUpdated = true;
      }

      if (Array.isArray(updatedData.badges)) {
        user.badges = updatedData.badges;
        userWasUpdated = true;
      }
      
      if (typeof updatedData.avatar !== 'undefined') {
        user.avatar = updatedData.avatar;
        userWasUpdated = true;
      }

      if (userWasUpdated) {
          await kv.set(`user:${user.email}`, user);
      }
      
      const { password, ip, ...userData } = user;
      res.status(200).json(userData);
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('User API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}