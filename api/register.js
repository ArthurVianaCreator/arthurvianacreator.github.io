// /api/register.js
import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

export default async function handler(req, res) {
  // CORREÇÃO: Inicializa o Resend DENTRO da função.
  if (!process.env.RESEND_API_KEY) {
    console.error("CRITICAL: RESEND_API_KEY is not defined.");
    return res.status(500).json({ error: "Server configuration error: Email service is not set up." });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }
  
  const { name, email, password } = req.body;
  
  // Validações...
  if (!name || !email || !password) { return res.status(400).json({ error: 'All fields are required' }); }
  if (name.trim().length < 4) { return res.status(400).json({ error: 'Name must be at least 4 characters long' }); }
  if (/\s/.test(name)) { return res.status(400).json({ error: 'Name cannot contain spaces' }); }
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$/;
  if (!passwordRegex.test(password)) { return res.status(400).json({ error: 'Password does not meet requirements.' }); }

  const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const normalizedName = name.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const [existingUser, nameTaken] = await Promise.all([ kv.get(`user:${normalizedEmail}`), kv.get(`name:${normalizedName}`) ]);
  
  if (existingUser) { return res.status(409).json({ error: 'Email already in use' }); }
  if (nameTaken) { return res.status(409).json({ error: 'Name already taken (case-insensitive)' }); }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { name: name.trim(), email: normalizedEmail, password: hashedPassword, following: [], votes: {}, isVerified: false };
  
  await kv.set(`user:${normalizedEmail}`, user);
  await kv.set(`name:${normalizedName}`, 1);

  const verificationToken = jwt.sign({ email: normalizedEmail }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/verify-email?token=${verificationToken}`;

  try {
    await resend.emails.send({
      from: 'Avrenpedia <nao-responda@avrenpedia.com>',
      to: normalizedEmail,
      subject: 'Verify Your Avrenpedia Account',
      html: `<h1>Welcome to Avrenpedia!</h1><p>Please click the link below to verify your email address:</p><a href="${verificationUrl}" style="background-color: #E50914; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a><p>This link will expire in 24 hours.</p>`
    });
    res.status(201).json({ message: 'Registration successful! Please check your email to verify your account.' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ error: 'Could not send verification email.' });
  }
}