// /api/user.js
import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

async function authenticate(req, env) {
  // ... (esta função permanece a mesma)
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = env;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    return await kv.get(`user:${email}`);
  } catch (error) {
    console.error('Authentication Error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
    if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !JWT_SECRET) {
      console.error('Erro de Configuração: Uma ou mais variáveis de ambiente essenciais não foram encontradas.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }
    const user = await authenticate(req, process.env);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    if (req.method === 'GET') {
      const { password, ...userData } = user;
      res.status(200).json(userData);
    } else if (req.method === 'PUT') {
      const updatedData = req.body;
      let userWasUpdated = false;

      // Lógica para atualizar o nome (existente)
      if (updatedData.name) {
        // ... (código de atualização de nome permanece o mesmo)
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
          multi.set(`name:${normalizedNewName}`, 1);
          user.name = newName;
          await multi.exec();
        } else {
          user.name = newName;
        }
        userWasUpdated = true;
      }
      
      // Lógica para atualizar a lista 'following' (existente)
      if (Array.isArray(updatedData.following)) {
        user.following = updatedData.following;
        userWasUpdated = true;
      }

      // --- INÍCIO DA NOVA LÓGICA ---
      // Lógica para atualizar os badges
      if (Array.isArray(updatedData.badges)) {
        // Aqui você pode adicionar validações se quiser,
        // por exemplo, para garantir que apenas badges válidos sejam adicionados.
        user.badges = updatedData.badges;
        userWasUpdated = true;
      }
      // --- FIM DA NOVA LÓGICA ---

      // Salva o usuário no banco de dados apenas se algo foi alterado
      if (userWasUpdated) {
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