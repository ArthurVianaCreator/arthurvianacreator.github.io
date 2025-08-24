// /api/user.js
import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

// A função authenticate já trata erros retornando null, o que é bom.
async function authenticate(req, env) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = env;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    return await kv.get(`user:${email}`);
  } catch (error) {
    // Se a autenticação falhar (token inválido ou erro no KV), retorna null
    console.error('Authentication Error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  try { // Adicionado bloco try...catch geral
    const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
    if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const user = await authenticate(req, process.env);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const kv = createClient({
      url: KV_REST_API_URL,
      token: KV_REST_API_TOKEN,
    });

    if (req.method === 'GET') {
      const { password, ...userData } = user;
      res.status(200).json(userData);

    } else if (req.method === 'PUT') {
      const updatedData = req.body;
      
      if (updatedData.name) {
        const newName = updatedData.name.trim();
        if (newName.length < 4) { return res.status(400).json({ error: 'Name must be at least 4 characters long' }); }
        if (/\s/.test(newName)) { return res.status(400).json({ error: 'Name cannot contain spaces' }); }
        
        const normalizedNewName = newName.toLowerCase();
        const normalizedOldName = user.name.trim().toLowerCase();

        if (normalizedNewName !== normalizedOldName) {
          const nameTaken = await kv.get(`name:${normalizedNewName}`);
          if (nameTaken) { return res.status(409).json({ error: 'Name already taken (case-insensitive)' }); }
          
          const multi = kv.multi();
          multi.del(`name:${normalizedOldName}`);
          multi.set(`name:${normalizedNewName}`, 1);
          user.name = newName;
          multi.set(`user:${user.email}`, user);
          await multi.exec();
          
        } else {
          user.name = newName;
          await kv.set(`user:${user.email}`, user);
        }
      }

      if (Array.isArray(updatedData.following)) {
        user.following = updatedData.following;
        await kv.set(`user:${user.email}`, user);
      }
      
      const { password, ...userData } = user;
      res.status(200).json(userData);

    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('User API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred while handling user data.' });
  }
}