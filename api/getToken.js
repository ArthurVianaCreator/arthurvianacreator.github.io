// /api/getToken.js
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Spotify credentials are not set in environment variables.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const data = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Spotify Token API Error:', data);
      return res.status(tokenResponse.status).json({ error: data.error_description || 'Failed to fetch token from Spotify.' });
    }
    res.status(200).json({ access_token: data.access_token });
  } catch (error) {
    console.error('Internal Server Error fetching Spotify token:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}