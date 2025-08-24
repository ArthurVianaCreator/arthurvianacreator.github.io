// /api/verify-email.js
import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) { return res.status(400).send('<h1>Error</h1><p>Verification token is missing.</p>'); }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

    const user = await kv.get(`user:${email}`);
    if (!user) { return res.status(404).send('<h1>Error</h1><p>User not found.</p>'); }
    
    if (user.isVerified) {
      return res.status(200).send('<h1>Email Already Verified</h1><p>You can now log in to your account.</p>');
    }

    user.isVerified = true;
    await kv.set(`user:${email}`, user);

    res.writeHead(302, { Location: process.env.NEXT_PUBLIC_APP_URL });
    res.end();

  } catch (error) {
    res.status(400).send('<h1>Error</h1><p>Invalid or expired verification token.</p>');
  }
}