// /api/getToken.js

// Lida com a busca do token de acesso do Spotify (Client Credentials Flow)
export default async function handler(req, res) {
  // Este endpoint deve aceitar apenas requisições GET do nosso frontend.
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Pega as credenciais do Spotify das variáveis de ambiente do servidor.
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  // Validação para garantir que as variáveis de ambiente foram configuradas.
  if (!clientId || !clientSecret) {
    console.error('Spotify credentials are not set in environment variables.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // Spotify exige que as credenciais sejam enviadas em Base64 no cabeçalho de autorização.
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    // Faz a requisição POST para a API de contas do Spotify para obter o token.
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const data = await tokenResponse.json();

    // Se a resposta não for bem-sucedida, retorna o erro.
    if (!tokenResponse.ok) {
      console.error('Spotify Token API Error:', data);
      return res.status(tokenResponse.status).json({ error: data.error_description || 'Failed to fetch token from Spotify.' });
    }

    // Se tudo der certo, envia o token de acesso de volta para o frontend.
    res.status(200).json({ access_token: data.access_token });

  } catch (error) {
    console.error('Internal Server Error fetching Spotify token:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}