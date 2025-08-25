import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !JWT_SECRET) {
    console.error('Server configuration error: Missing environment variables for registration.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) { return res.status(400).json({ error: 'All fields are required' }); }
    if (name.trim().length <= 4) { return res.status(400).json({ error: 'Name must be more than 4 characters long' }); }
    if (/\s/.test(name)) { return res.status(400).json({ error: 'Name cannot contain spaces' }); }
    if (password.length <= 4) { return res.status(400).json({ error: 'Password must be more than 4 characters long.' }); }

    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    const normalizedName = name.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const [existingUser, nameTaken] = await Promise.all([ kv.get(`user:${normalizedEmail}`), kv.get(`name:${normalizedName}`) ]);
    
    if (existingUser) { return res.status(409).json({ error: 'Email already in use' }); }
    if (nameTaken) { return res.status(409).json({ error: 'Name already taken (case-insensitive)' }); }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { 
      name: name.trim(), 
      email: normalizedEmail, 
      password: hashedPassword, 
      following: [], 
      badges: ["veteran"]
    };
    
    await kv.set(`user:${normalizedEmail}`, user);
    await kv.set(`name:${normalizedName}`, 1);

    const token = jwt.sign({ email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token });

  } catch (error) {
    console.error('Register API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}