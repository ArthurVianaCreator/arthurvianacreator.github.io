// Localização: /script.js

document.addEventListener('DOMContentLoaded', async function() {

    // ===================================================================================
    // CONFIGURAÇÃO E AUTENTICAÇÃO
    // ===================================================================================
    const clientId = '38a2cbe589494c8f8ed0820db317ae72'; // Sua Client ID
    // O redirectUri é construído dinamicamente a partir da localização atual do site.
    // Isso garante que ele sempre corresponda ao domínio que você está usando.
    const redirectUri = `${window.location.origin}/api/callback`; 
    
    // DEBUG: Mostra no console qual URI estamos usando. Compare com o Spotify Dashboard.
    console.log("Redirect URI being used by frontend:", redirectUri);

    let accessToken = null;

    function handleLogin() {
        const scopes = 'user-read-private user-read-email user-follow-read user-follow-modify user-top-read';
        window.location = `https://accounts.spotify.com/authorize?` +
            `response_type=code` +
            `&client_id=${clientId}` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    function handleUrlParameters() {
        if (window.location.hash) {
            const params = new URLSearchParams(window.location.hash.substring(1));
            const token = params.get('access_token');
            const error = params.get('error');

            if (token) {
                accessToken = token;
                localStorage.setItem('spotify_access_token', token);
                window.location.hash = ''; // Limpa a URL
            } else if (error) {
                // Se o backend nos redirecionou com um erro, mostre-o.
                alert(`An error occurred during authentication: ${error}`);
                window.location.hash = '';
            }
        }
    }

    // O resto do seu código (módulo de API, renderização, etc.) continua aqui.
    // Nenhuma mudança é necessária no resto do código.
    // O código abaixo é o mesmo da última vez e está correto.

    // ===================================================================================
    // MÓDULO DA API DO SPOTIFY... (o resto do código é idêntico ao anterior)
    // ===================================================================================
    const spotifyApi = (() => {
        const fetchWebApi = async (endpoint, method = 'GET', body = null) => {
            if (!accessToken) {
                showLoginScreen();
                return null;
            }
            try {
                const res = await fetch(`https://api.spotify.com/${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    method,
                    body: body ? JSON.stringify(body) : null
                });

                if (res.status === 401) { // Token expirou ou é inválido
                    localStorage.removeItem('spotify_access_token');
                    accessToken = null;
                    showLoginScreen();
                    return null;
                }
                if (!res.ok) {
                    console.error(`API Error: ${res.status} ${res.statusText}`);
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
            getMe: () => fetchWebApi('v1/me'),
            search: (query, type) => fetchWebApi(`v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=12`),
            getArtist: (id) => fetchWebApi(`v1/artists/${id}`),
            getArtistAlbums: (id) => fetchWebApi(`v1/artists/${id}/albums?include_groups=album,single&limit=20`),
            getAlbum: (id) => fetchWebApi(`v1/albums/${id}`),
            getNewReleases: () => fetchWebApi('v1/browse/new-releases?limit=12'),
            getSeveralArtists: (ids) => fetchWebApi(`v1/artists?ids=${ids.join(',')}`),
            checkIfUserFollowsArtists: (ids) => fetchWebApi(`v1/me/following/contains?type=artist&ids=${ids.join(',')}`),
            followArtist: (id) => fetchWebApi(`v1/me/following?type=artist&ids=${id}`, 'PUT'),
            unfollowArtist: (id) => fetchWebApi(`v1/me/following?type=artist&ids=${id}`, 'DELETE'),
            getTopArtists: () => fetchWebApi('v1/me/top/artists?limit=12'),
            getRecommendations: (seed_artists) => fetchWebApi(`v1/recommendations?seed_artists=${seed_artists.join(',')}&limit=12`)
        };
    })();

    // ===================================================================================
    // ELEMENTOS DO DOM (seletores)
    // ===================================================================================
    const mainContainer = document.querySelector('.main-container');
    const mainContent = document.querySelector('.main-content');
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const detailsViewContainer = document.getElementById('details-view');
    const followedArtistsGrid = document.getElementById('followed-artists-grid');
    const homeArtistsGrid = document.getElementById('home-artists-grid');
    const homeAlbumsGrid = document.getElementById('home-albums-grid');
    const discoverGrid = document.getElementById('discover-grid');
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const userProfile = document.getElementById('userProfile');
    const nameChangeModal = document.getElementById('nameChangeModal');
    const themePicker = document.getElementById('themePicker');
    const colorSwatches = document.querySelectorAll('.color-swatch');
    const settingsBtn = document.getElementById('settingsBtn');


    // ===================================================================================
    // LÓGICA DE RENDERIZAÇÃO
    // ===================================================================================
    const renderMusicCard = (item) => {
        const type = item.type;
        const imageUrl = (item.images && item.images.length > 0) ? item.images[0].url : 'https://via.placeholder.com/150'; // Imagem placeholder
        const title = item.name;
        const subtext = type === 'artist' ? (item.genres?.[0] || 'Artist') : (item.artists.map(a => a.name).join(', '));
        const year = type === 'album' && item.release_date ? `• ${new Date(item.release_date).getFullYear()}` : '';

        return `
            <div class="music-card" data-type="${type}" data-id="${item.id}">
                <div class="music-img"><img src="${imageUrl}" alt="${title}"></div>
                <div class="music-title">${title}</div>
                <div class="music-artist">${subtext} ${year}</div>
            </div>
        `;
    };

    const populateGrid = (gridElement, items) => {
        if (!items || items.length === 0) {
            gridElement.innerHTML = '<p class="search-message">Nothing to show here.</p>';
            return;
        }
        gridElement.innerHTML = items.map(renderMusicCard).join('');
    };

    async function renderHomePage() {
        const newReleasesData = await spotifyApi.getNewReleases();
        populateGrid(homeAlbumsGrid, newReleasesData?.albums?.items);

        const artistIds = [...new Set(newReleasesData?.albums?.items.flatMap(album => album.artists.map(artist => artist.id)))].slice(0, 12);
        if (artistIds?.length) {
            const artistsData = await spotifyApi.getSeveralArtists(artistIds);
            populateGrid(homeArtistsGrid, artistsData?.artists);
        }
    }
    
    async function renderDiscoverPage() {
        const topArtistsData = await spotifyApi.getTopArtists();
        if (topArtistsData && topArtistsData.items.length > 0) {
            const seedArtists = topArtistsData.items.slice(0, 5).map(artist => artist.id);
            const recommendations = await spotifyApi.getRecommendations(seedArtists);
            populateGrid(discoverGrid, recommendations?.tracks.map(track => ({ ...track.album, type: 'album' })));
        } else {
            discoverGrid.innerHTML = '<p class="search-message">Listen to more music to get recommendations!</p>';
        }
    }

    async function renderArtistView(artistId) {
        const [artist, albumsData, isFollowingArr] = await Promise.all([
            spotifyApi.getArtist(artistId),
            spotifyApi.getArtistAlbums(artistId),
            spotifyApi.checkIfUserFollowsArtists([artistId])
        ]);

        if (!artist) return;
        
        const isFollowing = isFollowingArr?.[0];
        const discographyHTML = albumsData?.items ? albumsData.items.map(renderMusicCard).join('') : '<p>No albums found.</p>';
        
        detailsViewContainer.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header">
                <div class="details-img band-img"><img src="${artist.images[0]?.url}" alt="${artist.name}"></div>
                <div class="details-info">
                    <h2>${artist.name}</h2>
                    <p class="meta-info">${artist.genres.join(', ')}</p>
                    <button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-id="${artist.id}">
                        <i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i>
                        <span>${isFollowing ? 'Following' : 'Follow'}</span>
                    </button>
                </div>
            </div>
            <div class="details-body">
                <h3>Discography</h3>
                <div class="music-grid">${discographyHTML}</div>
            </div>
        `;
        switchContent('details-view');
    }

    async function renderAlbumView(albumId) {
        const album = await spotifyApi.getAlbum(albumId);
        if (!album) return;

        detailsViewContainer.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header">
                <div class="details-img"><img src="${album.images[0]?.url}" alt="${album.name}"></div>
                <div class="details-info">
                    <h2>${album.name}</h2>
                    <p>${album.artists.map(a => a.name).join(', ')} • ${new Date(album.release_date).getFullYear()}</p>
                </div>
            </div>
            <div class.body">
                <h3>Tracklist</h3>
                <ol class="track-list">${album.tracks.items.map(track => `<li>${track.name}</li>`).join('')}</ol>
            </div>
        `;
        switchContent('details-view');
    }
    
    async function handleFollowClick(e) {
        const button = e.target.closest('.follow-btn');
        const artistId = button.dataset.artistId;
        const isFollowing = button.classList.contains('following');

        let result;
        if (isFollowing) {
            result = await spotifyApi.unfollowArtist(artistId);
        } else {
            result = await spotifyApi.followArtist(artistId);
        }

        if (result?.success) {
            button.classList.toggle('following');
            button.querySelector('i').className = isFollowing ? 'fas fa-plus' : 'fas fa-check';
            button.querySelector('span').textContent = isFollowing ? 'Follow' : 'Following';
        }
    }
    
    // ===================================================================================
    // UI & NAVEGAÇÃO
    // ===================================================================================
    function applyTheme(color) { document.documentElement.style.setProperty('--primary-color', color); }
    function updateUserName(name) {
        userNameEl.textContent = name;
        userAvatarEl.textContent = name ? name.charAt(0).toUpperCase() : 'U';
    }

    function switchContent(targetId) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === targetId));
        mainContent.scrollTop = 0;
        document.querySelector('.main-container').classList.remove('sidebar-open');
        document.body.style.overflow = 'auto';
    }

    // Event Listeners
    userProfile.addEventListener('click', () => nameChangeModal.style.display = 'flex');
    document.getElementById('closeNameBtn').addEventListener('click', () => nameChangeModal.style.display = 'none');
    
    settingsBtn.addEventListener('click', () => themePicker.classList.toggle('active'));
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color;
            applyTheme(color);
            localStorage.setItem('avrenpediaTheme', color);
            themePicker.classList.remove('active');
        });
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            if(targetId === 'descobrir') renderDiscoverPage();
            switchContent(targetId);
        });
    });

    document.getElementById('menuBtn').addEventListener('click', () => {
        document.querySelector('.main-container').classList.add('sidebar-open');
        document.body.style.overflow = 'hidden';
    });
    document.getElementById('closeSidebarBtn').addEventListener('click', () => {
        document.querySelector('.main-container').classList.remove('sidebar-open');
        document.body.style.overflow = 'auto';
    });

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.toLowerCase().trim();
        if (!query) { switchContent('inicio'); return; }

        searchTimeout = setTimeout(async () => {
            const [artistData, albumData] = await Promise.all([
                spotifyApi.search(query, 'artist'),
                spotifyApi.search(query, 'album')
            ]);
            let resultsHTML = '';
            if (artistData?.artists?.items?.length) {
                resultsHTML += `<h2 class="section-title-main">Artists</h2><div class="music-grid">${artistData.artists.items.map(renderMusicCard).join('')}</div>`;
            }
            if (albumData?.albums?.items?.length) {
                resultsHTML += `<h2 class="section-title-main">Albums</h2><div class="music-grid">${albumData.albums.items.map(renderMusicCard).join('')}</div>`;
            }
            searchResultsContainer.innerHTML = resultsHTML || '<p class="search-message">No results found.</p>';
            switchContent('buscar');
        }, 300); 
    });

    mainContent.addEventListener('click', e => {
        const backBtn = e.target.closest('.back-btn');
        const followBtn = e.target.closest('.follow-btn');
        const card = e.target.closest('.music-card');

        if (backBtn) { switchContent('inicio'); return; }
        if (followBtn) { handleFollowClick(e); return; }
        if (card) {
            const { type, id } = card.dataset;
            if (type === 'artist') renderArtistView(id);
            else if (type === 'album') renderAlbumView(id);
        }
    });

    // ===================================================================================
    // INICIALIZAÇÃO
    // ===================================================================================
    function showLoginScreen() {
        mainContainer.style.display = 'none';
        if (document.getElementById('login-screen')) return; 
        const loginScreen = document.createElement('div');
        loginScreen.id = 'login-screen';
        loginScreen.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; text-align: center; background: var(--darker-bg); color: white; font-family: 'Poppins', sans-serif;">
                <h1 style="font-family: 'Bebas Neue', sans-serif; font-size: 5rem; color: var(--primary-color);">Avrenpedia</h1>
                <p style="margin-bottom: 40px; font-size: 1.2rem;">Your Music Encyclopedia</p>
                <button id="loginBtn" style="background-color: #1DB954; color: white; border: none; padding: 15px 35px; border-radius: 50px; font-weight: bold; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; gap: 10px;">
                    <i class="fab fa-spotify" style="font-size: 1.5rem;"></i> LOG IN WITH SPOTIFY
                </button>
            </div>
        `;
        document.body.appendChild(loginScreen);
        document.getElementById('loginBtn').addEventListener('click', handleLogin);
    }
    
    async function initializeApp() {
        applyTheme(localStorage.getItem('avrenpediaTheme') || '#E50914');
        handleUrlParameters();
        accessToken = accessToken || localStorage.getItem('spotify_access_token');

        if (!accessToken) {
            showLoginScreen();
        } else {
            const userData = await spotifyApi.getMe();
            if (userData) {
                document.getElementById('login-screen')?.remove();
                mainContainer.style.display = 'grid';
                updateUserName(userData.display_name);
                renderHomePage();
            } else {
                showLoginScreen();
            }
        }
    }

    initializeApp();
});