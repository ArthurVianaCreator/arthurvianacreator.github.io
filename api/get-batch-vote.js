// /api/get-batch-votes.js
import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(200).json({});
  }

  const kv = createClient({
  });

  const likeKeys = items.map(key => `likes:${key}`);
  const dislikeKeys = items.map(key => `dislikes:${key}`);

  const voteCounts = await kv.mget(...likeKeys, ...dislikeKeys);

  const result = {};
  items.forEach((key, index) => {
    result[key] = {
      likes: voteCounts[index] || 0,
      dislikes: voteCounts[index + items.length] || 0,
    };
  });

  res.status(200).json(result);
}