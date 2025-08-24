// Localização: /api/callback.js

export default async function handler(req, res) {
    const { code } = req.query;
  
    if (!code) {
      return res.status(400).send('Error: Missing authorization code');
    }
  
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    // A variável SITE_URL ainda é usada para o redirecionamento final.
    const siteUrl = process.env.SITE_URL; 
    // CORREÇÃO 1: Definir a redirect_uri como um valor fixo para garantir que seja idêntica à do front-end.
    const redirectUri = 'https://arthurianacreator-github-io.vercel.app/api/callback';
  
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    // Usar a variável fixa aqui em vez de construir a partir do siteUrl.
    params.append('redirect_uri', redirectUri);
  
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
      // CORREÇÃO 2: Havia um erro de digitação aqui ("httpshttps://").
      const frontendUrl = `https://${siteUrl}`;
      console.error('Error in callback:', error);
      res.redirect(`${frontendUrl}#error=${encodeURIComponent(error.message)}`);
    }
  }