// pages/api/friends.js

import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

async function authenticateAndGetUser(req, env) {
  const { JWT_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN } = env;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    const userKey = `user:${email}`;
    const user = await kv.get(userKey);
    return user ? { ...user, key: userKey } : null;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const currentUser = await authenticateAndGetUser(req, process.env);
  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, targetName } = req.body;
  
  // CORREÇÃO: Adicionada validação robusta para os dados de entrada.
  if (!action || typeof action !== 'string' || !targetName || typeof targetName !== 'string') {
    return res.status(400).json({ error: 'Action and targetName are required and must be strings.' });
  }

  const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const normalizedTargetName = targetName.toLowerCase();
  
  // Busca o email associado ao nome de usuário normalizado.
  const targetUserEmail = await kv.get(`name:${normalizedTargetName}`);

  if (!targetUserEmail || typeof targetUserEmail !== 'string') {
      return res.status(404).json({ error: 'Target user not found.' });
  }
  
  const targetUserKey = `user:${targetUserEmail}`;
  const targetUser = await kv.get(targetUserKey);

  if (!targetUser) {
    return res.status(404).json({ error: 'Target user data not found.' });
  }
  
  // Assegura que todos os arrays necessários existam em ambos os usuários.
  const fields = ['friends', 'friendRequestsSent', 'friendRequestsReceived'];
  [currentUser, targetUser].forEach(user => {
    fields.forEach(field => {
      if (!Array.isArray(user[field])) {
        user[field] = [];
      }
    });
  });

  try {
    switch (action) {
      case 'request':
        if (currentUser.email === targetUser.email) return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
        if (currentUser.friends.includes(targetUser.name)) return res.status(400).json({ error: 'You are already friends.' });
        if (currentUser.friendRequestsSent.includes(targetUser.name)) return res.status(400).json({ error: 'Friend request already sent.' });

        currentUser.friendRequestsSent.push(targetUser.name);
        targetUser.friendRequestsReceived.push(currentUser.name);
        break;

      case 'accept':
        currentUser.friendRequestsReceived = currentUser.friendRequestsReceived.filter(name => name !== targetUser.name);
        currentUser.friends.push(targetUser.name);
        targetUser.friendRequestsSent = targetUser.friendRequestsSent.filter(name => name !== currentUser.name);
        targetUser.friends.push(currentUser.name);
        break;

      case 'reject':
        currentUser.friendRequestsReceived = currentUser.friendRequestsReceived.filter(name => name !== targetUser.name);
        targetUser.friendRequestsSent = targetUser.friendRequestsSent.filter(name => name !== currentUser.name);
        break;
        
      case 'remove':
        currentUser.friends = currentUser.friends.filter(name => name !== targetUser.name);
        targetUser.friends = targetUser.friends.filter(name => name !== currentUser.name);
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid action.' });
    }

    // Salva as alterações em ambos os usuários no banco de dados.
    await kv.set(currentUser.key, currentUser);
    await kv.set(targetUserKey, targetUser);
    
    // Retorna os dados atualizados do usuário atual, sem informações sensíveis.
    const { password, ip, ...safeUserData } = currentUser;
    res.status(200).json({ message: 'Action successful.', user: safeUserData });

  } catch (error) {
    console.error('Friends API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}