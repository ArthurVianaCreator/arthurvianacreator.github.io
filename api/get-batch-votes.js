// /api/get-batch-votes.js
import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  // Adicionamos logs para seguir a execução
  console.log("API /get-batch-votes: Função iniciada.");

  if (req.method !== 'POST') {
    console.log(`API /get-batch-votes: Método ${req.method} não permitido.`);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { items } = req.body;
    console.log("API /get-batch-votes: Itens recebidos no corpo da requisição:", items);

    if (!Array.isArray(items) || items.length === 0) {
      console.log("API /get-batch-votes: Array de itens está vazio, retornando sucesso com objeto vazio.");
      return res.status(200).json({});
    }

    // Usando a criação de cliente simplificada que você já implementou
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    console.log("API /get-batch-votes: Cliente do Vercel KV criado com sucesso.");

    const likeKeys = items.map(key => `likes:${key}`);
    const dislikeKeys = items.map(key => `dislikes:${key}`);

    console.log("API /get-batch-votes: Tentando buscar dados do KV com kv.mget()...");
    const voteCounts = await kv.mget(...likeKeys, ...dislikeKeys);
    console.log("API /get-batch-votes: Dados do KV recebidos com sucesso:", voteCounts);

    const result = {};
    items.forEach((key, index) => {
      result[key] = {
        likes: voteCounts[index] || 0,
        dislikes: voteCounts[index + items.length] || 0,
      };
    });

    console.log("API /get-batch-votes: Enviando resposta final com sucesso.");
    res.status(200).json(result);

  } catch (error) {
    // ESTA É A PARTE MAIS IMPORTANTE
    // Se a função falhar, este bloco será executado e nos dirá o porquê.
    console.error("!!! ERRO CRÍTICO NA API /get-batch-votes:", error);
    
    // Retorna uma resposta JSON detalhada para o frontend (e para os logs)
    res.status(500).json({ 
      error: 'Ocorreu um erro no servidor ao buscar os votos.', 
      details: error.message, // A mensagem de erro real
      stack: error.stack // O rastreamento do erro
    });
  }
}