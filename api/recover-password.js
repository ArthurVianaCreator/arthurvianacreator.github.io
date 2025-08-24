// /api/recover-password.js
import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') { return res.status(405).end(); }
  
  const { email } = req.body;
  const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const user = await kv.get(`user:${email.toLowerCase()}`);

  if (user) {
    const resetToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}?resetToken=${resetToken}`;

    try {
      await resend.emails.send({
        from: 'Avrenpedia Security <security@resend.dev>',
        to: user.email,
        subject: 'Reset Your Avrenpedia Password',
        html: `<h1>Password Reset Request</h1><p>Someone requested a password reset for your account. If this was you, click the link below to set a new password:</p><a href="${resetUrl}" style="color: #E50914;">Reset Password</a><p>This link is valid for 1 hour. If you did not request this, you can safely ignore this email.</p>`
      });
    } catch (error) {
      console.error('Password recovery email error:', error);
    }
  }
  
  res.status(200).json({ message: "If an account with this email exists, a recovery link has been sent." });
}