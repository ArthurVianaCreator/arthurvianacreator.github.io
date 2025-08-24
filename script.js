document.addEventListener('DOMContentLoaded', function() {

    // ===================================================================================
    // CONFIGURAÇÃO E AUTENTICAÇÃO DA APLICAÇÃO
    // ===================================================================================
    let appAccessToken = null;

    // Função para buscar o token de acesso da nossa API no back-end
    async function getAppToken() {
        try {
            const response = await fetch('/api/getToken');
            if (!response.ok) {
                throw new Error('Failed to get app token from server.');
            }
            const data = await response.json();
            appAccessToken = data.access_token;
            return true;
        } catch (error) {
            console.error("Authentication Error:", error);
            document.body.innerHTML = `<div style="color: white; text-align: center; padding-top: 50px;"><h1>Error</h1><p>Could not connect to the music service. Please check the server configuration.</p></div>`;
            return false;
        }
    }

    // ===================================================================================
    // MÓDULO DE APIS
    // ===================================================================================
    const spotifyApi = (() => {
        const fetchWebApi = async (endpoint, method = 'GET') => {
            if (!appAccessToken) {
                console.error("Spotify token is not available.");
                return null;
            }
            try {
                const res = await fetch(`https://api.spotify.com/${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${appAccessToken}` },
                    method
                });
                if (res.status === 401) { // Token expirado
                    console.log("Token expired, fetching a new one...");
                    await getAppToken(); // Pega um novo token
                    return fetchWebApi(endpoint, method); // Tenta a chamada novamente
                }
                if (!res.ok) {
                    console.error(`Spotify API Error: ${res.status}`);
                    return null;
                }
                if (res.status === 204) return { success: true };
                return await res.json();
            } catch (e) {
                console.error("Fetch failed", e);
                return null;
            }
        };
        return {
            search: (q, type) => fetchWebApi(`v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=12`),
            getArtist: (id) => fetchWebApi(`v1/artists/${id}`),
            getArtistAlbums: (id) => fetchWebApi(`v1/artists/${id}/albums?include_groups=album,single&limit=20`),
            getAlbum: (id) => fetchWebApi(`v1/albums/${id}`),
            getNewReleases: () => fetchWebApi('v1/browse/new-releases?limit=12'),
            getSeveralArtists: (ids) => fetchWebApi(`v1/artists?ids=${ids.join(',')}`),
            getRecommendations: (seeds) => fetchWebApi(`v1/recommendations?seed_artists=${seeds.join(',')}&limit=12`)
        };
    })();
    
    const wikipediaApi = {
        getArtistInfo: async (artistName) => {
            try {
                const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName.replace(/ /g, '_'))}`;
                const response = await fetch(url);
                if (!response.ok) return null;
                return await response.json();
            } catch (error) {
                console.error("Wikipedia API error:", error);
                return null;
            }
        }
    };

    // ===================================================================================
    // ELEMENTOS DO DOM
    // ===================================================================================
    const mainContent = document.querySelector('.main-content');
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const detailsViewContainer = document.getElementById('details-view');

    // ===================================================================================
    // LÓGICA DE RENDERIZAÇÃO
    // ===================================================================================
    const renderMusicCard = (item) => {
        const type = item.type;
        const imageUrl = (item.images && item.images.length > 0) ? item.images[0].url : 'https://via.placeholder.com/150';
        const title = item.name;
        const subtext = type === 'artist' ? (item.genres?.[0] || 'Artist') : (item.artists.map(a => a.name).join(', '));
        const year = type === 'album' && item.release_date ? `• ${new Date(item.release_date).getFullYear()}` : '';
        return `<div class="music-card" data-type="${type}" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}">
                    <div class="music-img"><img src="${imageUrl}" alt="${title}"></div>
                    <div class="music-title">${title}</div>
                    <div class="music-artist">${subtext} ${year}</div>
                </div>`;
    };

    const populateGrid = (gridElement, items) => {
        if (!items || items.length === 0) {
            gridElement.innerHTML = '<p class="search-message">Nothing to show here.</p>'; return;
        }
        gridElement.innerHTML = items.map(renderMusicCard).join('');
    };

    async function renderHomePage() {
        const newReleases = await spotifyApi.getNewReleases();
        populateGrid(document.getElementById('home-albums-grid'), newReleases?.albums?.items);
        const artistIds = [...new Set(newReleases?.albums?.items.flatMap(a => a.artists.map(art => art.id)))].slice(0, 12);
        if (artistIds?.length) {
            const artistsData = await spotifyApi.getSeveralArtists(artistIds);
            populateGrid(document.getElementById('home-artists-grid'), artistsData?.artists);
        }
    }
    
    async function renderDiscoverPage() {
        // Como não temos mais os "top artists" do usuário, usamos artistas populares como base para recomendações.
        const seedArtists = ['06HL4z0CvFAxyc27GXpf02', '4dpARuHxo51G3z768sgnrY', '1vCWHaC5f2uS3yhpwWbIA6', '7dGJo4pcD2V6oG8kP0tJRR', '6M2wZ9GZgrQXHCFfjv46we']; // Queen, Daft Punk, Red Hot Chili Peppers, Metallica, Nirvana
        const recommendations = await spotifyApi.getRecommendations(seedArtists);
        const albums = recommendations?.tracks.map(track => ({ ...track.album, type: 'album' })) || [];
        // Remove duplicados
        const uniqueAlbums = [...new Map(albums.map(item => [item['id'], item])).values()];
        populateGrid(document.getElementById('discover-grid'), uniqueAlbums);
    }

    async function renderArtistView(artistId, artistName) {
        detailsViewContainer.innerHTML = `<p class="search-message">Loading artist info...</p>`;
        switchContent('details-view');
        
        const [artist, albumsData, wikiInfo] = await Promise.all([
            spotifyApi.getArtist(artistId),
            spotifyApi.getArtistAlbums(artistId),
            wikipediaApi.getArtistInfo(artistName)
        ]);

        if (!artist) {
            detailsViewContainer.innerHTML = `<p class="search-message">Artist not found.</p>`;
            return;
        }
        
        const discographyHTML = albumsData?.items ? albumsData.items.map(renderMusicCard).join('') : '<p>No albums found.</p>';
        
        let wikipediaHTML = '';
        if (wikiInfo && wikiInfo.extract) {
            wikipediaHTML = `<h3>About the Artist</h3><p class="bio">${wikiInfo.extract}</p>`;
        }

        detailsViewContainer.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header">
                <div class="details-img band-img"><img src="${artist.images[0]?.url}" alt="${artist.name}"></div>
                <div class="details-info">
                    <h2>${artist.name}</h2>
                    <p class="meta-info">${artist.genres.join(', ')}</p>
                </div>
            </div>
            <div class="details-body">
                ${wikipediaHTML}
                <h3>Discography</h3>
                <div class="music-grid">${discographyHTML}</div>
            </div>`;
    }

    async function renderAlbumView(albumId) {
        const album = await spotifyApi.getAlbum(albumId);
        if (!album) return;
        detailsViewContainer.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header"> <div class="details-img"><img src="${album.images[0]?.url}" alt="${album.name}"></div> <div class="details-info"> <h2>${album.name}</h2> <p>${album.artists.map(a => a.name).join(', ')} • ${new Date(album.release_date).getFullYear()}</p> </div> </div>
            <div class="details-body"> <h3>Tracklist</h3> <ol class="track-list">${album.tracks.items.map(track => `<li>${track.name}</li>`).join('')}</ol> </div>`;
        switchContent('details-view');
    }

    // ===================================================================================
    // UI & NAVEGAÇÃO
    // ===================================================================================
    function switchContent(targetId) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === targetId));
        mainContent.scrollTop = 0;
        document.querySelector('.main-container').classList.remove('sidebar-open');
        document.body.style.overflow = 'auto';
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            if (targetId === 'descobrir') renderDiscoverPage();
            switchContent(targetId);
        });
    });

    document.getElementById('menuBtn').addEventListener('click', () => document.querySelector('.main-container').classList.add('sidebar-open'));
    document.getElementById('closeSidebarBtn').addEventListener('click', () => document.querySelector('.main-container').classList.remove('sidebar-open'));

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (!query) { switchContent('inicio'); return; }
        searchTimeout = setTimeout(async () => {
            const [artistData, albumData] = await Promise.all([spotifyApi.search(query, 'artist'), spotifyApi.search(query, 'album')]);
            let resultsHTML = '';
            if (artistData?.artists?.items?.length) resultsHTML += `<h2 class="section-title-main">Artists</h2><div class="music-grid">${artistData.artists.items.map(renderMusicCard).join('')}</div>`;
            if (albumData?.albums?.items?.length) resultsHTML += `<h2 class="section-title-main">Albums</h2><div class="music-grid">${albumData.albums.items.map(renderMusicCard).join('')}</div>`;
            searchResultsContainer.innerHTML = resultsHTML || '<p class="search-message">No results found.</p>';
            switchContent('buscar');
        }, 300); 
    });

    mainContent.addEventListener('click', e => {
        const card = e.target.closest('.music-card');
        const backBtn = e.target.closest('.back-btn');
        if (backBtn) { switchContent(searchInput.value ? 'buscar' : 'inicio'); return; }
        if (card) {
            const { type, id, name } = card.dataset;
            if (type === 'artist') renderArtistView(id, decodeURIComponent(name));
            else if (type === 'album') renderAlbumView(id);
        }
    });

    // ===================================================================================
    // INICIALIZAÇÃO
    // ===================================================================================
    async function initializeApp() {
        const isAuthenticated = await getAppToken();
        if (isAuthenticated) {
            renderHomePage();
        }
    }

    initializeApp();
});