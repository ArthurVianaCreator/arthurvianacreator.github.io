// pages/api/artist-bio.js

// Função para limpar o HTML bruto retornado pela API da Wikipedia
function cleanHtml(html) {
    if (!html) return 'No biography available for this artist.';
    // Remove tags HTML, referências de citação [1], etc.
    return html.replace(/<[^>]*>/g, '').replace(/\[\d+\]/g, '').trim();
}

export default async function handler(req, res) {
    const { artistName } = req.query;

    if (!artistName) {
        return res.status(400).json({ error: 'Artist name is required.' });
    }

    // Endpoint da API da Wikipedia para buscar o resumo introdutório de uma página
    const WIKIPEDIA_API_URL = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=1&titles=${encodeURIComponent(artistName)}`;

    try {
        const response = await fetch(WIKIPEDIA_API_URL);
        const data = await response.json();

        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0]; // Pega o ID da primeira página encontrada

        // Se a página não existir (pageId === '-1') ou não tiver um resumo, retorna uma mensagem padrão
        if (!pageId || pageId === '-1' || !pages[pageId].extract) {
            return res.status(200).json({ bio: 'No biography available for this artist.' });
        }

        const bioHtml = pages[pageId].extract;
        const bioText = cleanHtml(bioHtml);

        res.status(200).json({ bio: bioText });

    } catch (error) {
        console.error('Wikipedia API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch artist biography.' });
    }
}