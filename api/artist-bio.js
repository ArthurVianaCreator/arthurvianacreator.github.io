// pages/api/artist-bio.js

// Função para limpar o HTML bruto retornado pela API da Wikipedia
function cleanHtml(html) {
    if (!html) return null;
    return html.replace(/<[^>]*>/g, '').replace(/\[\d+\]/g, '').trim();
}

// Função para extrair a origem do infobox
function extractOrigin(wikitext) {
    if (!wikitext) return null;
    const originRegex = /\|\s*origin\s*=\s*(.*?)\n/i;
    const match = wikitext.match(originRegex);
    if (match && match[1]) {
        // Limpa o wikitext (ex: [[London]], England -> London, England)
        return match[1].replace(/\[\[|\]\]/g, '').trim();
    }
    return null;
}

export default async function handler(req, res) {
    const { artistName } = req.query;

    if (!artistName) {
        return res.status(400).json({ error: 'Artist name is required.' });
    }

    const encodedArtistName = encodeURIComponent(artistName);
    // API para o resumo (extract) e para o wikitext do infobox (revisions)
    const WIKIPEDIA_API_URL = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|revisions&exintro=true&redirects=1&rvprop=content&rvsection=0&titles=${encodedArtistName}`;

    try {
        const response = await fetch(WIKIPEDIA_API_URL);
        const data = await response.json();

        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];

        if (!pageId || pageId === '-1') {
            return res.status(200).json({ bio: 'No biography available for this artist.', origin: null });
        }
        
        const page = pages[pageId];
        const bioHtml = page.extract;
        const wikitext = page.revisions && page.revisions[0] ? page.revisions[0]['*'] : null;

        const bio = bioHtml ? cleanHtml(bioHtml) : 'No biography available for this artist.';
        const origin = extractOrigin(wikitext);

        res.status(200).json({ bio, origin });

    } catch (error) {
        console.error('Wikipedia API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch artist biography.' });
    }
}