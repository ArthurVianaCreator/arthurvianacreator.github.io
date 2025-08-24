// /api/user.js
import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

async function authenticate(req, env) {
    // ... (código da função authenticate não muda)
    const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = env;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
      const { email } = jwt.verify(token, JWT_SECRET);
      const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
      return await kv.get(`user:${email}`);
    } catch (error) {
      console.error('Authentication Error:', error);
      return null;
    }
}

export default async function handler(req, res) {
  // --- INÍCIO DA MODIFICAÇÃO PARA DEBUG ---
  console.log('--- Verificando Variáveis de Ambiente ---');
  console.log('Variável KV_REST_API_URL existe?', !!process.env.KV_REST_API_URL);
  console.log('Variável KV_REST_API_TOKEN existe?', !!process.env.KV_REST_API_TOKEN);
  // --- FIM DA MODIFICAÇÃO ---
  
  try {
    const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
    // Adicionamos uma verificação explícita aqui também
    if (!KV_REST_API_URL || !KV_REST_API_TOKEN || !JWT_SECRET) {
      console.error('Erro de Configuração: Uma ou mais variáveis de ambiente essenciais não foram encontradas.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }
    
    // ... (resto do seu código do handler não muda)
    const user = await authenticate(req, process.env);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // ... (resto do seu código)

  } catch (error) {
    console.error('User API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred while handling user data.' });
  }
}