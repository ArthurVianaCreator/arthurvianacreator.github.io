// /api/getToken.js

export default async function handler(req, res) {
  // ==================== INÍCIO DO CÓDIGO DE DIAGNÓSTICO ====================
  console.log("--- Diagnóstico de Ambiente da Função /api/getToken ---");
  
  // Iremos listar apenas os NOMES das variáveis, não os seus valores secretos.
  // Isso é seguro e nos dirá se as variáveis do KV estão sendo injetadas.
  const envKeys = Object.keys(process.env);
  console.log("Variáveis de ambiente disponíveis:", envKeys);
  
  // Verificação específica para as variáveis do Vercel KV
  console.log("Verificando a presença das variáveis do Vercel KV:");
  console.log("-> KV_REST_API_URL existe?", envKeys.includes('KV_REST_API_URL'));
  console.log("-> KV_REST_API_TOKEN existe?", envKeys.includes('KV_REST_API_TOKEN'));
  console.log("--- Fim do Diagnóstico ---");
  // ===================== FIM DO CÓDIGO DE DIAGNÓSTICO =====================

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server configuration error: Missing Spotify credentials.' });
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: params,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || 'Failed to fetch Spotify token');
    }

    res.status(200).json(data);

  } catch (error) {
    console.error('Error in getToken.js:', error);
    res.status(500).json({ error: error.message });
  }
}