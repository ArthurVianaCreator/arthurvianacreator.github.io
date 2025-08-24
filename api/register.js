// /api/register.js
import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // ... (validações de nome, email e senha continuam as mesmas) ...
  const { name, email, password } = req.body;
  // ... (código de validação omitido por brevidade) ...

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  const normalizedName = name.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const [existingUser, nameTaken] = await Promise.all([
    kv.get(`user:${normalizedEmail}`),
    kv.get(`name:${normalizedName}`)
  ]);
  
  if (existingUser) { return res.status(409).json({ error: 'Email already in use' }); }
  if (nameTaken) { return res.status(409).json({ error: 'Name already taken' }); }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    following: [],
    votes: {},
    isVerified: false // MUDANÇA: Novo campo para status de verificação
  };
  
  await kv.set(`user:${normalizedEmail}`, user);
  await kv.set(`name:${normalizedName}`, 1);

  // MUDANÇA: Gerar token de verificação e enviar e-mail
  const verificationToken = jwt.sign(
    { email: normalizedEmail },
    process.env.JWT_SECRET,
    { expiresIn: '1d' } // Token válido por 1 dia
  );

  const verificationUrl = `https://SEU-DOMINIO.com/api/verify-email?token=${verificationToken}`;

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev', // Ou seu domínio verificado
      to: normalizedEmail,
      subject: 'Verify Your Avrenpedia Account',
      html: `<p>Welcome to Avrenpedia! Click <a href="${verificationUrl}">here</a> to verify your email.</p>`
    });
    // Não retorna mais um token de login, apenas uma mensagem de sucesso.
    res.status(201).json({ message: 'Registration successful! Please check your email to verify your account.' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ error: 'Could not send verification email.' });
  }
}