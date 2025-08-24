// /api/recover-password.js
import { createClient } from '@vercel/kv';
// import jwt from 'jsonwebtoken'; // TEMPORARIAMENTE DESATIVADO
// import { Resend } from 'resend'; // TEMPORARIAMENTE DESATIVADO

export default async function handler(req, res) {
  if (req.method !== 'POST') { return res.status(405).end(); }
  
  const { email } = req.body;
  const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const user = await kv.get(`user:${email.toLowerCase()}`);

  if (user) {
    // SIMULAÇÃO: O código do Resend foi removido para depuração.
    console.log(`DEBUG: Password recovery for ${user.email} was requested but email sending is disabled.`);
  }
  
  res.status(200).json({ message: "If an account with this email exists, a recovery link has been sent. (DEBUG MODE)" });
}