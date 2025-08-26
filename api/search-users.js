import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  try {
    const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
    const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });
    
    const userKeys = [];
    const normalizedQuery = query.toLowerCase();
    
    // Itera pelas chaves de nome de usuário para encontrar correspondências
    for await (const key of kv.scanIterator({ match: `name:*${normalizedQuery}*` })) {
      userKeys.push(key);
    }
    
    if (userKeys.length === 0) {
      return res.status(200).json([]);
    }

    // Obtém os emails associados aos nomes encontrados
    const userEmails = await kv.mget(...userKeys);
    
    // Obtém os dados completos dos usuários a partir dos emails
    const userObjectKeys = userEmails.filter(email => typeof email === 'string').map(email => `user:${email}`);
    
    if (userObjectKeys.length === 0) {
        return res.status(200).json([]);
    }

    const users = await kv.mget(...userObjectKeys);

    // Filtra e formata os dados para retornar apenas informações públicas
    const publicUsers = users
      .filter(user => user != null)
      .map(user => ({
        name: user.name,
        avatar: user.avatar || null,
      }));

    res.status(200).json(publicUsers);

  } catch (error) {
    console.error('User Search API Error:', error);
    return res.status(500).json({ error: 'A server-side error occurred.' });
  }
}