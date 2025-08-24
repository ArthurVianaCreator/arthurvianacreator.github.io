// Localização: /api/callback.js

export default async function handler(req, res) {
    const { code } = req.query;
  
    if (!code) {
      return res.status(400).send('Error: Missing authorization code');
    }
  
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    // Usamos nossa variável de ambiente SITE_URL para garantir consistência.
    const siteUrl = process.env.SITE_URL; 
  
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
      const frontendUrl = `https://${siteUrl}`;
  
      if (!response.ok) {
        // Se falhar, redireciona de volta com uma mensagem de erro clara
        throw new Error(data.error_description || 'Failed to fetch token');
      }
  
      // Se tiver sucesso, redireciona para a página inicial com os tokens
      res.redirect(`${frontendUrl}#access_token=${data.access_token}&refresh_token=${data.refresh_token}`);
  
    } catch (error) {
      // Se ocorrer um erro, mostra o erro na URL para depuração
      const frontendUrl = `https://${siteUrl}`;
      console.error('Error in callback:', error);
      res.redirect(`${frontendUrl}#error=${encodeURIComponent(error.message)}`);
    }
  }