// /api/recover-password.js

import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }
  
  const { email } = req.body;
  
  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  const userString = await kv.get(`user:${email}`);

  if (userString) {
    console.log(`Password recovery requested for ${email}. In a real app, an email would be sent.`);
  }
  
  // A resposta é sempre a mesma para não revelar se um email existe no sistema.
  res.status(200).json({ message: "If an account with this email exists, a recovery link has been sent." });
}