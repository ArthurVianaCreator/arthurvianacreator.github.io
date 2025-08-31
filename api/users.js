import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

// Função auxiliar para autenticar o usuário e buscar seus dados
async function authenticate(req, kv, secret) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, secret);
    return await kv.get(`user:${email}`);
  } catch (error) {
    console.error('Authentication Error:', error);
    return null;
  }
}

export default async function handler(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
  const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });

  // --- ROTA GET: Busca o perfil do usuário logado ou um perfil público ---
  if (req.method === 'GET') {
    const { name } = req.query;

    if (name) {
      try {
        const normalizedName = name.toLowerCase();
        const userEmail = await kv.get(`name:${normalizedName}`);
        if (!userEmail) return res.status(404).json({ error: 'User not found.' });
        
        const user = await kv.get(`user:${userEmail}`);
        if (!user) return res.status(404).json({ error: 'User data not found.' });

        const publicData = {
          name: user.name,
          avatar: user.avatar || null,
          badges: user.badges || [],
          following: user.following || [],
          friends: user.friends || [],
          description: user.description || null,
          lastSeen: user.lastSeen || null,
          favoriteTrackId: user.favoriteTrackId || null
        };
        return res.status(200).json(publicData);
      } catch (error) {
        console.error('Public Profile GET Error:', error);
        return res.status(500).json({ error: 'A server-side error occurred.' });
      }
    }

    const currentUser = await authenticate(req, kv, JWT_SECRET);
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
    
    currentUser.lastSeen = Date.now();
    await kv.set(`user:${currentUser.email}`, currentUser);
    
    const { password, ip, ...userData } = currentUser;
    return res.status(200).json(userData);
  }

  // --- ROTA PUT: Atualiza o perfil do usuário logado ---
  if (req.method === 'PUT') {
    const user = await authenticate(req, kv, JWT_SECRET);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const updatedData = req.body;
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
                if (normalizedOldName) multi.del(`name:${normalizedOldName}`);
                multi.set(`name:${normalizedNewName}`, user.email);
                user.name = newName;
                await multi.exec();
            } else {
                user.name = newName;
            }
        }
        if (Array.isArray(updatedData.following)) user.following = updatedData.following;
        
        // Lógica para a música favorita
        if (typeof updatedData.favoriteTrackId !== 'undefined') {
          if (updatedData.favoriteTrackId === null) {
            delete user.favoriteTrackId;
          } else {
            user.favoriteTrackId = updatedData.favoriteTrackId;
          }
        }

        if (Array.isArray(updatedData.badges)) user.badges = updatedData.badges;
        if (typeof updatedData.avatar !== 'undefined') user.avatar = updatedData.avatar;
        if (typeof updatedData.description === 'string') user.description = updatedData.description.trim();

        user.lastSeen = Date.now();
        await kv.set(`user:${user.email}`, user);
        
        const { password, ip, ...userData } = user;
        return res.status(200).json(userData);

    } catch (error) {
        console.error('User PUT Error:', error);
        return res.status(500).json({ error: 'A server-side error occurred.' });
    }
  }

  // --- ROTA POST: Ações como atualizar badge ou buscar status ---
  if (req.method === 'POST') {
    const { action, ...body } = req.body;

    if (action === 'updateBadge') {
      const currentUser = await authenticate(req, kv, JWT_SECRET);
      if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
      
      const { badge } = body;
      const validBadges = ['discoverer', 'explorer', 'collector'];
      if (!badge || !validBadges.includes(badge)) return res.status(400).json({ error: 'Invalid badge provided.' });
      
      if (!Array.isArray(currentUser.badges)) currentUser.badges = [];
      currentUser.badges = currentUser.badges.filter(b => !validBadges.includes(b));
      currentUser.badges.push(badge);

      await kv.set(`user:${currentUser.email}`, currentUser);
      const { password, ip, ...safeUserData } = currentUser;
      return res.status(200).json(safeUserData);
    }
    
    if (action === 'getStatuses') {
      const { userNames } = body;
      if (!Array.isArray(userNames) || userNames.length === 0) return res.status(400).json({ error: 'userNames must be a non-empty array.' });
      
      const nameKeys = userNames.map(name => `name:${name.toLowerCase()}`);
      const userEmails = await kv.mget(...nameKeys);
      const userObjectKeys = userEmails.filter(email => typeof email === 'string').map(email => `user:${email}`);
      if (userObjectKeys.length === 0) return res.status(200).json({});
      
      const users = await kv.mget(...userObjectKeys);
      const statuses = {};
      users.forEach(user => {
        if (user && user.name) statuses[user.name] = user.lastSeen || null;
      });
      return res.status(200).json(statuses);
    }

    return res.status(400).json({ error: 'Invalid action provided.' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}