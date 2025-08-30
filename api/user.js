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

    // Update lastSeen on any authenticated action
    user.lastSeen = Date.now();

    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    if (req.method === 'GET') {
      await kv.set(`user:${user.email}`, user); // Save updated timestamp
      const { password, ip, ...userData } = user;
      res.status(200).json(userData);
    } else if (req.method === 'PUT') {
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
          if (normalizedOldName) {
            multi.del(`name:${normalizedOldName}`);
          }
          multi.set(`name:${normalizedNewName}`, user.email);
          user.name = newName;
          await multi.exec();
        } else {
          user.name = newName;
        }
      }
      
      if (Array.isArray(updatedData.following)) {
        const oldFollowingIds = new Set((user.following || []).map(a => a.id));
        const newFollows = updatedData.following.filter(artist => !oldFollowingIds.has(artist.id));

        for (const artist of newFollows) {
            const activity = {
                username: user.name,
                action: 'FOLLOWED_ARTIST',
                targetName: artist.name,
                targetId: artist.id,
                timestamp: Date.now()
            };
            await kv.lpush('global_activity_feed', JSON.stringify(activity));
        }
        if (newFollows.length > 0) {
            await kv.ltrim('global_activity_feed', 0, 99);
        }
        user.following = updatedData.following;
      }

      if (Array.isArray(updatedData.badges)) {
        user.badges = updatedData.badges;
      }
      
      if (typeof updatedData.avatar !== 'undefined') {
        user.avatar = updatedData.avatar;
      }

      if (typeof updatedData.description === 'string') {
        user.description = updatedData.description.trim();
      }

      await kv.set(`user:${user.email}`, user);
      
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