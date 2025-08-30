import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userNames } = req.body;
  if (!Array.isArray(userNames) || userNames.length === 0) {
    return res.status(400).json({ error: 'userNames must be a non-empty array.' });
  }

  try {
    const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });

    const nameKeys = userNames.map(name => `name:${name.toLowerCase()}`);
    const userEmails = await kv.mget(...nameKeys);

    const userObjectKeys = userEmails
      .filter(email => typeof email === 'string')
      .map(email => `user:${email}`);

    if (userObjectKeys.length === 0) {
        return res.status(200).json({});
    }

    const users = await kv.mget(...userObjectKeys);

    const statuses = {};
    users.forEach(user => {
      if (user && user.name) {
        statuses[user.name] = user.lastSeen || null;
      }
    });

    res.status(200).json(statuses);

  } catch (error) {
    console.error('Users Status API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}