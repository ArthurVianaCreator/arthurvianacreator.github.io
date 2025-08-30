import jwt from 'jsonwebtoken';
import { createClient } from '@vercel/kv';

async function authenticateAndGetUser(req, env) {
  const { JWT_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN } = env;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, JWT_SECRET);
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    const user = await kv.get(`user:${email}`);
    return user;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const currentUser = await authenticateAndGetUser(req, process.env);
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendList = currentUser.friends || [];
    if (friendList.length === 0) {
      return res.status(200).json([]);
    }

    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    
    // Fetch the last 100 activities from the global feed
    const rawActivities = await kv.lrange('global_activity_feed', 0, 99);
    
    // Parse activities and filter for those performed by friends
    const feedActivities = rawActivities
      .map(activity => JSON.parse(activity))
      .filter(activity => friendList.includes(activity.username));

    // Limit to the most recent 25 activities
    const limitedFeed = feedActivities.slice(0, 25);

    res.status(200).json(limitedFeed);

  } catch (error) {
    console.error('Activity Feed API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}