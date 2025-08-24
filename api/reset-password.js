// /api/reset-password.js
import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') { return res.status(405).end(); }
  const { token, newPassword } = req.body;

  if (!token || !newPassword) { return res.status(400).json({ error: 'Token and new password are required.' }); }

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$/;
  if (!passwordRegex.test(newPassword)) { return res.status(400).json({ error: 'Password does not meet requirements.' }); }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;
    const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

    const user = await kv.get(`user:${email}`);
    if (!user) { return res.status(404).json({ error: 'User not found.' }); }

    user.password = await bcrypt.hash(newPassword, 10);
    await kv.set(`user:${email}`, user);

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid or expired password reset token.' });
  }
}