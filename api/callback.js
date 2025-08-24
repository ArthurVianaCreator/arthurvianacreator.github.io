// Este arquivo vai em: /api/callback.js

export default async function handler(req, res) {
    const { code } = req.query;
  
    if (!code) {
      return res.status(400).send('Error: Missing authorization code');
    }
  
    // Pega as chaves secretas das Variáveis de Ambiente da Vercel
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    // A Vercel define esta variável automaticamente com a URL do seu site
    const siteUrl = process.env.VERCEL_URL;
  
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', `https://${siteUrl}/api/callback`);
  
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
        throw new Error(data.error_description || 'Failed to fetch token');
      }
  
      // Redireciona de volta para a página inicial, passando os tokens no hash (#)
      const frontendUrl = `https://${siteUrl}`;
      res.redirect(`${frontendUrl}#access_token=${data.access_token}&refresh_token=${data.refresh_token}`);
  
    } catch (error) {
      console.error('Error in callback:', error);
      res.status(500).send(`An error occurred: ${error.message}`);
    }
  }