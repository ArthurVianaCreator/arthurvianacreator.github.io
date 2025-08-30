import { createClient } from '@vercel/kv';
import jwt from 'jsonwebtoken';

// Função para autenticar e verificar se o usuário é admin
async function authenticateAdmin(req, kv, secret) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { email } = jwt.verify(token, secret);
    const user = await kv.get(`user:${email}`);
    if (user && user.badges && user.badges.includes('admin')) {
      return user;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET } = process.env;
  const kv = createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN });

  // --- ROTA GET: Busca todas as notícias ---
  if (req.method === 'GET') {
    try {
      // Busca as notícias do Sorted Set, ordenadas pela data (score)
      const articles = await kv.zrange('news_articles', 0, -1, { rev: true, withScores: true });
      const newsItems = [];
      for (let i = 0; i < articles.length; i += 2) {
          const articleData = articles[i];
          const timestamp = articles[i + 1];
          newsItems.push({ ...articleData, id: timestamp });
      }
      return res.status(200).json(newsItems);
    } catch (error) {
      console.error('News GET Error:', error);
      return res.status(500).json({ error: 'Failed to fetch news.' });
    }
  }

  // --- ROTA POST: Cria uma nova notícia (somente admin) ---
  if (req.method === 'POST') {
    const adminUser = await authenticateAdmin(req, kv, JWT_SECRET);
    if (!adminUser) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    try {
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required.' });
      }
      const timestamp = Date.now();
      const article = {
        title,
        content,
        author: adminUser.name,
        createdAt: timestamp
      };
      // Adiciona o artigo a um Sorted Set, usando o timestamp como score para ordenação
      await kv.zadd('news_articles', { score: timestamp, member: article });
      return res.status(201).json({ ...article, id: timestamp });
    } catch (error) {
      console.error('News POST Error:', error);
      return res.status(500).json({ error: 'Failed to create news article.' });
    }
  }
  
    // --- ROTA DELETE: Deleta uma notícia (somente admin) ---
  if (req.method === 'DELETE') {
    const adminUser = await authenticateAdmin(req, kv, JWT_SECRET);
    if (!adminUser) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'Article ID is required.' });
        }
        
        // Encontra o item exato no sorted set para remover
        const articles = await kv.zrangebyscore('news_articles', id, id);
        if (articles.length === 0) {
            return res.status(404).json({ error: 'Article not found.' });
        }
        
        await kv.zrem('news_articles', ...articles);
        return res.status(204).end(); // No Content
    } catch (error) {
        console.error('News DELETE Error:', error);
        return res.status(500).json({ error: 'Failed to delete news article.' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}