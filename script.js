document.addEventListener('DOMContentLoaded', function() {

    let appAccessToken = null; // Token para acesso público da API

    // ===================================================================================
    // MÓDULO DE AUTENTICAÇÃO (APP + USUÁRIO LOCAL)
    // ===================================================================================
    const authManager = {
        async getAppToken() {
            if (appAccessToken) return true;
            try {
                const response = await fetch('/api/getToken');
                if (!response.ok) throw new Error('Failed to get app token');
                const data = await response.json();
                appAccessToken = data.access_token;
                return true;
            } catch (error) {
                console.error("Authentication Error:", error);
                document.body.innerHTML = `<div style="color:white;text-align:center;padding:50px;"><h1>Error</h1><p>Could not connect to services.</p></div>`;
                return false;
            }
        },
        // Sistema de usuário salvo no localStorage (NÃO SEGURO PARA PRODUÇÃO REAL, mas ótimo para este projeto)
        user: {
            getCurrent() {
                const user = localStorage.getItem('avrenpedia_user');
                return user ? JSON.parse(user) : null;
            },
            login(email, password) {
                const users = JSON.parse(localStorage.getItem('avrenpedia_users') || '{}');
                if (users[email] && users[email].password === password) {
                    localStorage.setItem('avrenpedia_user', JSON.stringify(users[email]));
                    return users[email];
                }
                return null;
            },
            logout() {
                localStorage.removeItem('avrenpedia_user');
            },
            signUp(name, email, password) {
                let users = JSON.parse(localStorage.getItem('avrenpedia_users') || '{}');
                if (users[email]) return { error: 'Email already exists.' };
                const newUser = { name, email, password, following: [] };
                users[email] = newUser;
                localStorage.setItem('avrenpedia_users', JSON.stringify(users));
                localStorage.setItem('avrenpedia_user', JSON.stringify(newUser));
                return newUser;
            },
            update(updatedUser) {
                let users = JSON.parse(localStorage.getItem('avrenpedia_users') || '{}');
                users[updatedUser.email] = updatedUser;
                localStorage.setItem('avrenpedia_users', JSON.stringify(users));
                localStorage.setItem('avrenpedia_user', JSON.stringify(updatedUser));
            },
            isFollowing(artistId) {
                const user = this.getCurrent();
                return user ? user.following.some(artist => artist.id === artistId) : false;
            },
            toggleFollow(artist) {
                let user = this.getCurrent();
                if (!user) return;
                const isFollowing = this.isFollowing(artist.id);
                if (isFollowing) {
                    user.following = user.following.filter(a => a.id !== artist.id);
                } else {
                    user.following.push(artist);
                }
                this.update(user);
                return !isFollowing;
            }
        }
    };

    // ===================================================================================
    // MÓDULO DE APIS EXTERNAS (SPOTIFY, WIKIPEDIA)
    // ===================================================================================
    const spotifyApi = {
        async fetchWebApi(endpoint) {
            if (!appAccessToken) return null;
            const res = await fetch(`https://api.spotify.com/${endpoint}`, { headers: { 'Authorization': `Bearer ${appAccessToken}` } });
            if (res.status === 401) { await authManager.getAppToken(); return this.fetchWebApi(endpoint); }
            return res.ok ? res.json() : null;
        },
        search: (q, type) => spotifyApi.fetchWebApi(`v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=12`),
        getArtist: (id) => spotifyApi.fetchWebApi(`v1/artists/${id}`),
        getArtistAlbums: (id) => spotifyApi.fetchWebApi(`v1/artists/${id}/albums?include_groups=album,single&limit=20`),
        getAlbum: (id) => spotifyApi.fetchWebApi(`v1/albums/${id}`),
        getNewReleases: () => spotifyApi.fetchWebApi('v1/browse/new-releases?limit=12'),
        getSeveralArtists: (ids) => spotifyApi.fetchWebApi(`v1/artists?ids=${ids.join(',')}`),
        getRecommendations: (seeds) => spotifyApi.fetchWebApi(`v1/recommendations?seed_artists=${seeds.join(',')}&limit=12`),
    };

    const wikipediaApi = {
        async getArtistInfo(artistName) {
            try {
                // CORREÇÃO: Busca primeiro para encontrar a página correta da banda/músico
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(artistName + " band musician")}&srlimit=1&format=json&origin=*`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();
                const pageTitle = searchData.query.search[0]?.title;

                if (!pageTitle) return null;

                // Agora busca o resumo e o conteúdo completo da página correta
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
                const contentUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`;
                
                const [summaryRes, contentRes] = await Promise.all([fetch(summaryUrl), fetch(contentUrl)]);
                if (!summaryRes.ok || !contentRes.ok) return null;

                const summaryData = await summaryRes.json();
                const contentData = await contentRes.json();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = contentData.parse.text['*'];
                
                // Extrai membros da infobox
                let members = [];
                const membersNode = tempDiv.querySelector('.infobox th:last-of-type'); // Lógica simples para encontrar membros
                if (membersNode && (membersNode.textContent.includes('Members') || membersNode.textContent.includes('Past members'))) {
                    const memberLinks = membersNode.parentElement.nextElementSibling?.querySelectorAll('a');
                    if(memberLinks) members = Array.from(memberLinks).map(a => a.textContent).slice(0, 5); // Limita a 5
                }

                return {
                    summary: summaryData.extract,
                    members
                };
            } catch (e) { console.error("Wikipedia API error:", e); return null; }
        }
    };
    
    // ... O resto do seu código (elementos do DOM, renderização, UI) irá aqui ...
    // Para manter a clareza, o restante do código está abaixo, mas imagine que ele continua aqui.
    
    // ===================================================================================
    // ELEMENTOS DO DOM E LÓGICA DE UI
    // ===================================================================================
    const dom = {
        // Seletores de elementos principais
        mainContent: document.querySelector('.main-content'),
        searchInput: document.getElementById('searchInput'),
        searchResultsContainer: document.getElementById('searchResultsContainer'),
        detailsViewContainer: document.getElementById('details-view'),
        // Seletores de UI de usuário
        loginPromptBtn: document.getElementById('loginPromptBtn'),
        userProfile: document.getElementById('userProfile'),
        userName: document.getElementById('userName'),
        userDropdown: document.getElementById('userDropdown'),
        librarySection: document.getElementById('librarySection'),
        followedArtistsGrid: document.getElementById('followed-artists-grid'),
        // Modais
        loginModal: document.getElementById('loginModal'),
        registerModal: document.getElementById('registerModal'),
        nameChangeModal: document.getElementById('nameChangeModal'),
    };

    const uiManager = {
        updateForAuthState() {
            const user = authManager.user.getCurrent();
            if (user) {
                dom.loginPromptBtn.style.display = 'none';
                dom.userProfile.style.display = 'flex';
                dom.userName.textContent = user.name;
                dom.librarySection.style.display = 'block';
            } else {
                dom.loginPromptBtn.style.display = 'block';
                dom.userProfile.style.display = 'none';
                dom.librarySection.style.display = 'none';
            }
        },
        switchContent(targetId) {
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === targetId));
            dom.mainContent.scrollTop = 0;
            document.querySelector('.main-container').classList.remove('sidebar-open');
        },
        populateGrid(gridElement, items) {
            if (!items || items.length === 0) {
                gridElement.innerHTML = '<p class="search-message">Nothing to show here.</p>'; return;
            }
            gridElement.innerHTML = items.map(this.renderMusicCard).join('');
        },
        renderMusicCard(item) {
            const imageUrl = item.images?.[0]?.url || 'https://via.placeholder.com/150';
            const subtext = item.type === 'artist' ? (item.genres?.[0] || 'Artist') : (item.artists.map(a => a.name).join(', '));
            return `<div class="music-card" data-type="${item.type}" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}">
                        <div class="music-img"><img src="${imageUrl}" alt="${item.name}"></div>
                        <div class="music-title">${item.name}</div>
                        <div class="music-artist">${subtext}</div>
                    </div>`;
        },
        applyTheme(color) { 
            document.documentElement.style.setProperty('--primary-color', color);
            localStorage.setItem('avrenpediaTheme', color);
        },
        openModal(modal) { modal.classList.add('active'); },
        closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }
    };
    
    // ===================================================================================
    // LÓGICA DE RENDERIZAÇÃO DE PÁGINAS
    // ===================================================================================
    async function renderHomePage() {
        const newReleases = await spotifyApi.getNewReleases();
        uiManager.populateGrid(document.getElementById('home-albums-grid'), newReleases?.albums?.items);
        const artistIds = [...new Set(newReleases?.albums?.items.flatMap(a => a.artists.map(art => art.id)))].slice(0, 12);
        if (artistIds.length) {
            const artistsData = await spotifyApi.getSeveralArtists(artistIds);
            uiManager.populateGrid(document.getElementById('home-artists-grid'), artistsData?.artists);
        }
    }
    
    async function renderDiscoverPage() {
        const seedArtists = ['06HL4z0CvFAxyc27GXpf02', '4dpARuHxo51G3z768sgnrY', '1vCWHaC5f2uS3yhpwWbIA6', '0LcJLqbBmaGUft1e9Mm8HV', '64M6ah0SkkRJGJUdNsMLck']; // Queen, Daft Punk, Red Hot Chili Peppers, Taylor Swift, Michael Jackson
        const recommendations = await spotifyApi.getRecommendations(seedArtists);
        const albums = recommendations?.tracks.map(track => ({ ...track.album, type: 'album' })) || [];
        uiManager.populateGrid(document.getElementById('discover-grid'), [...new Map(albums.map(item => [item['id'], item])).values()]);
    }

    async function renderArtistView(artistId, artistName) {
        uiManager.switchContent('details-view');
        dom.detailsViewContainer.innerHTML = `<p class="search-message">Loading artist info...</p>`;
        
        const [artist, albumsData, wikiInfo] = await Promise.all([
            spotifyApi.getArtist(artistId),
            spotifyApi.getArtistAlbums(artistId),
            wikipediaApi.getArtistInfo(artistName)
        ]);

        if (!artist) { dom.detailsViewContainer.innerHTML = `<p class="search-message">Artist not found.</p>`; return; }
        
        let followBtnHTML = '';
        if (authManager.user.getCurrent()) {
            const isFollowing = authManager.user.isFollowing(artistId);
            followBtnHTML = `<button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-id="${artist.id}">
                <i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i><span>${isFollowing ? 'Following' : 'Follow'}</span>
            </button>`;
        }
        
        let wikiHTML = '<div>';
        if (wikiInfo?.summary) wikiHTML += `<h3>About ${artist.name}</h3><p class="bio">${wikiInfo.summary}</p>`;
        wikiHTML += `<h3>Discography</h3><div class="music-grid">${albumsData?.items.map(uiManager.renderMusicCard).join('') || '<p>No albums found.</p>'}</div></div>`;
        
        let membersHTML = '';
        if (wikiInfo?.members?.length > 0) {
            membersHTML = `<div class="artist-sidebar"><h3>Members</h3><ul class="member-list">${wikiInfo.members.map(m => `<li>${m}</li>`).join('')}</ul></div>`;
        }

        dom.detailsViewContainer.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header">
                <div class="details-img band-img"><img src="${artist.images[0]?.url}" alt="${artist.name}"></div>
                <div class="details-info">
                    <h2>${artist.name}</h2>
                    <p class="meta-info">${artist.genres.join(', ')}</p>
                    ${followBtnHTML}
                </div>
            </div>
            <div class="details-body">${wikiHTML}${membersHTML}</div>`;
    }

    // Adicione mais funções de renderização como renderAlbumView, renderFollowingPage etc.
    async function renderAlbumView(albumId) {
        const album = await spotifyApi.getAlbum(albumId);
        if (!album) return;
        dom.detailsViewContainer.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="details-header"><div class="details-img"><img src="${album.images[0]?.url}" alt="${album.name}"></div><div class="details-info"><h2>${album.name}</h2><p>${album.artists.map(a => a.name).join(', ')} • ${new Date(album.release_date).getFullYear()}</p></div></div><div class="details-body"><div><h3>Tracklist</h3><ol class="track-list">${album.tracks.items.map(track => `<li>${track.name}</li>`).join('')}</ol></div></div>`;
        uiManager.switchContent('details-view');
    }

    function renderFollowingPage() {
        const user = authManager.user.getCurrent();
        if (!user || user.following.length === 0) {
            dom.followedArtistsGrid.innerHTML = '<p class="search-message">You are not following any artists yet.</p>';
        } else {
            uiManager.populateGrid(dom.followedArtistsGrid, user.following.map(a => ({...a, type: 'artist'})));
        }
    }


    // ===================================================================================
    // REGISTRO DE EVENTOS (EVENT LISTENERS)
    // ===================================================================================
    function setupEventListeners() {
        // Navegação principal
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.dataset.target;
                if (targetId === 'descobrir') renderDiscoverPage();
                else if (targetId === 'seguindo') renderFollowingPage();
                uiManager.switchContent(targetId);
            });
        });

        // Interações do header
        dom.loginPromptBtn.addEventListener('click', () => uiManager.openModal(dom.loginModal));
        dom.userProfile.addEventListener('click', () => dom.userDropdown.classList.toggle('active'));
        document.getElementById('logoutBtn').addEventListener('click', () => {
            authManager.user.logout();
            uiManager.updateForAuthState();
            dom.userDropdown.classList.remove('active');
        });
        document.getElementById('changeNameBtn').addEventListener('click', () => {
            uiManager.openModal(document.getElementById('nameChangeModal'));
            dom.userDropdown.classList.remove('active');
        });

        // Pesquisa
        let searchTimeout;
        dom.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (!query) { uiManager.switchContent('inicio'); return; }
            searchTimeout = setTimeout(async () => {
                const results = await spotifyApi.search(query, 'artist,album');
                let html = '';
                if (results?.artists?.items?.length) html += `<h2 class="section-title-main">Artists</h2><div class="music-grid">${results.artists.items.map(uiManager.renderMusicCard).join('')}</div>`;
                if (results?.albums?.items?.length) html += `<h2 class="section-title-main">Albums</h2><div class="music-grid">${results.albums.items.map(uiManager.renderMusicCard).join('')}</div>`;
                dom.searchResultsContainer.innerHTML = html || '<p class="search-message">No results found.</p>';
                uiManager.switchContent('buscar');
            }, 300); 
        });

        // Cliques no conteúdo principal (cards, botões de voltar/seguir)
        dom.mainContent.addEventListener('click', async e => {
            const card = e.target.closest('.music-card');
            const backBtn = e.target.closest('.back-btn');
            const followBtn = e.target.closest('.follow-btn');
            
            if (backBtn) { uiManager.switchContent(dom.searchInput.value ? 'buscar' : 'inicio'); }
            if (card) {
                const { type, id, name } = card.dataset;
                if (type === 'artist') renderArtistView(id, decodeURIComponent(name));
                else if (type === 'album') renderAlbumView(id);
            }
            if (followBtn) {
                const artistId = followBtn.dataset.artistId;
                const artistData = await spotifyApi.getArtist(artistId);
                const isNowFollowing = authManager.user.toggleFollow({id: artistData.id, name: artistData.name, images: artistData.images });
                followBtn.classList.toggle('following', isNowFollowing);
                followBtn.querySelector('i').className = `fas ${isNowFollowing ? 'fa-check' : 'fa-plus'}`;
                followBtn.querySelector('span').textContent = isNowFollowing ? 'Following' : 'Follow';
            }
        });

        // Lógica dos modais
        document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', (e) => { if(e.target === m) uiManager.closeAllModals(); }));
        document.getElementById('switchToRegister').addEventListener('click', () => { uiManager.closeAllModals(); uiManager.openModal(dom.registerModal); });
        document.getElementById('switchToLogin').addEventListener('click', () => { uiManager.closeAllModals(); uiManager.openModal(dom.loginModal); });

        // Submissão de formulários de modal
        document.getElementById('loginSubmitBtn').addEventListener('click', () => {
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            if (authManager.user.login(email, pass)) {
                uiManager.closeAllModals(); uiManager.updateForAuthState();
            } else { document.querySelector('#loginModal .modal-error').textContent = 'Invalid email or password.'; }
        });
        document.getElementById('registerSubmitBtn').addEventListener('click', () => {
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const pass = document.getElementById('registerPassword').value;
            const result = authManager.user.signUp(name, email, pass);
            if (result.error) { document.querySelector('#registerModal .modal-error').textContent = result.error; }
            else { uiManager.closeAllModals(); uiManager.updateForAuthState(); }
        });
        document.getElementById('saveNameBtn').addEventListener('click', () => {
            const user = authManager.user.getCurrent();
            user.name = document.getElementById('newNameInput').value;
            authManager.user.update(user);
            uiManager.updateForAuthState();
            uiManager.closeAllModals();
        });
        document.getElementById('closeNameBtn').addEventListener('click', uiManager.closeAllModals);

        // Tema e sidebar
        document.querySelectorAll('.color-swatch').forEach(swatch => swatch.addEventListener('click', () => uiManager.applyTheme(swatch.dataset.color)));
        document.getElementById('settingsBtn').addEventListener('click', () => document.getElementById('themePicker').classList.toggle('active'));
        document.getElementById('menuBtn').addEventListener('click', () => document.querySelector('.main-container').classList.add('sidebar-open'));
        document.getElementById('closeSidebarBtn').addEventListener('click', () => document.querySelector('.main-container').classList.remove('sidebar-open'));
    }

    // ===================================================================================
    // INICIALIZAÇÃO DA APLICAÇÃO
    // ===================================================================================
    async function initializeApp() {
        uiManager.applyTheme(localStorage.getItem('avrenpediaTheme') || '#E50914');
        const isAuthenticated = await authManager.getAppToken();
        if (isAuthenticated) {
            uiManager.updateForAuthState();
            setupEventListeners();
            renderHomePage();
        }
    }

    initializeApp();
});