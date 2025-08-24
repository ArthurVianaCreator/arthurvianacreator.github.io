document.addEventListener('DOMContentLoaded', async function() {
    // App State and Managers
    const state = { currentUser: null, spotifyAppToken: null };
    const api = {}, auth = {}, ui = {};

    // ===================================================================================
    // API MANAGER
    // ===================================================================================
    api.manager = {
        async _request(endpoint, method = 'GET', body = null) {
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('authToken');
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const config = { method, headers };
            if (body) config.body = JSON.stringify(body);
            const response = await fetch(`/api/${endpoint}`, config);
            if (!response.ok) {
                const data = await response.json().catch(() => ({ error: 'An unknown server error occurred' }));
                throw new Error(data.error || `API Error: ${response.status}`);
            }
            return response.status === 204 ? { success: true } : response.json();
        },
        async _spotifyRequest(endpoint) {
            if (!state.spotifyAppToken) throw new Error("Spotify App Token not available.");
            const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, { headers: { 'Authorization': `Bearer ${state.spotifyAppToken}` } });
            if (response.status === 401) { await this.fetchSpotifyAppToken(); return this._spotifyRequest(endpoint); }
            if (!response.ok) throw new Error(`Spotify API Error: ${response.status}`);
            return response.json();
        },
        fetchSpotifyAppToken: async () => { const data = await (await fetch('/api/getToken')).json(); state.spotifyAppToken = data.access_token; },
        login: (e, p) => api.manager._request('login', 'POST', { email: e, password: p }),
        register: (n, e, p) => api.manager._request('register', 'POST', { name: n, email: e, password: p }),
        recoverPassword: (e) => api.manager._request('recover-password', 'POST', { email: e }),
        fetchUser: () => api.manager._request('user', 'GET'),
        updateUser: (d) => api.manager._request('user', 'PUT', d),
        searchSpotify: (q, t) => api.manager._spotifyRequest(`search?q=${encodeURIComponent(q)}&type=${t}&limit=12`),
        getSpotifyArtist: (id) => api.manager._spotifyRequest(`artists/${id}`),
        getSpotifyArtistAlbums: (id) => api.manager._spotifyRequest(`artists/${id}/albums?include_groups=album,single&limit=20`),
        getSpotifyAlbum: (id) => api.manager._spotifyRequest(`albums/${id}`), // NOVO: Endpoint para buscar um álbum específico
        getSpotifyNewReleases: () => api.manager._spotifyRequest(`browse/new-releases?limit=12`),
        getSpotifySeveralArtists: (ids) => api.manager._spotifyRequest(`artists?ids=${ids.join(',')}`),
        getWikipediaInfo: async (artistName) => {
            try {
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(artistName + " band musician")}&srlimit=1&format=json&origin=*`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();
                const pageTitle = searchData.query.search[0]?.title;
                if (!pageTitle) return null;
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
                const contentUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`;
                const [summaryRes, contentRes] = await Promise.all([fetch(summaryUrl), fetch(contentUrl)]);
                if (!summaryRes.ok || !contentRes.ok) return null;
                const summaryData = await summaryRes.json();
                const contentData = await contentRes.json();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = contentData.parse.text['*'];
                
                let members = [], composers = [];
                const allTh = Array.from(tempDiv.querySelectorAll('.infobox th'));
                
                // MUDANÇA: Função auxiliar para extrair dados do infobox
                const extractInfoboxData = (thElement) => {
                    const links = thElement?.parentElement.nextElementSibling?.querySelectorAll('a[title]');
                    return links ? Array.from(links).map(a => a.textContent).filter(name => !name.startsWith('[')) : [];
                };

                const membersNode = allTh.find(th => th.textContent.trim().startsWith('Members'));
                if (membersNode) members = extractInfoboxData(membersNode);
                
                const composersNode = allTh.find(th => th.textContent.trim().includes('Songwriter(s)') || th.textContent.trim().includes('Composer(s)'));
                if (composersNode) composers = extractInfoboxData(composersNode);

                return { summary: summaryData.extract, members, composers };
            } catch (e) { console.error("Wikipedia API error:", e); return null; }
        }
    };
    
    // ===================================================================================
    // AUTH MANAGER
    // ===================================================================================
    auth.manager = {
        async init() { if (localStorage.getItem('authToken')) { try { state.currentUser = await api.manager.fetchUser(); } catch (e) { this.logout(); }}},
        async login(email, password) { const data = await api.manager.login(email, password); localStorage.setItem('authToken', data.token); state.currentUser = await api.manager.fetchUser(); },
        async register(name, email, password) { const data = await api.manager.register(name, email, password); localStorage.setItem('authToken', data.token); state.currentUser = await api.manager.fetchUser(); },
        logout() { localStorage.removeItem('authToken'); state.currentUser = null; },
        isFollowing: (id) => state.currentUser?.following.some(a => a.id === id),
        async toggleFollow(artist) {
            if (!state.currentUser) return;
            const isFollowing = this.isFollowing(artist.id);
            const updatedFollowing = isFollowing ? state.currentUser.following.filter(a => a.id !== artist.id) : [...state.currentUser.following, {id: artist.id, name: artist.name, images: artist.images}];
            state.currentUser = await api.manager.updateUser({ following: updatedFollowing });
            return !isFollowing;
        }
    };
    
    // ===================================================================================
    // UI MANAGER
    // ===================================================================================
    ui.manager = {
        dom: {
            appLoader: document.getElementById('app-loader'), mainContainer: document.querySelector('.main-container'), mainContent: document.querySelector('.main-content'), searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'), userProfile: document.getElementById('userProfile'), userName: document.getElementById('userName'), libraryNavItem: document.getElementById('libraryNavItem'), userDropdown: document.getElementById('userDropdown'), detailsView: document.getElementById('details-view'),
            loginModal: document.getElementById('loginModal'), registerModal: document.getElementById('registerModal'), nameChangeModal: document.getElementById('nameChangeModal'), forgotPasswordModal: document.getElementById('forgotPasswordModal'),
            followedArtistsGrid: document.getElementById('followed-artists-grid'), searchResultsContainer: document.getElementById('searchResultsContainer'),
            homeAlbumsGrid: document.getElementById('home-albums-grid'), homeArtistsGrid: document.getElementById('home-artists-grid')
        },
        updateForAuthState() { const u = state.currentUser; this.dom.loginPromptBtn.style.display = u ? 'none' : 'block'; this.dom.userProfile.style.display = u ? 'flex' : 'none'; this.dom.libraryNavItem.style.display = u ? 'block' : 'none'; if (u) this.dom.userName.textContent = u.name; },
        switchContent(id) { document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === id)); this.dom.mainContent.scrollTop = 0; },
        renderMusicCard(item) { const img = item.images?.[0]?.url || 'https://via.placeholder.com/150'; const sub = item.type === 'artist' ? (item.genres?.[0] || 'Artist') : (item.artists.map(a => a.name).join(', ')); return `<div class="music-card" data-type="${item.type}" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}"><div class="music-img"><img src="${img}" alt="${item.name}"></div><div class="music-title">${item.name}</div><div class="music-artist">${sub}</div></div>`; },
        populateGrid(items) { if (!items || items.length === 0) return '<p class="search-message">Nothing to show here.</p>'; return `<div class="music-grid">${items.filter(item => item).map(this.renderMusicCard).join('')}</div>`; },
        renderLoader(message) { return `<div class="loading-container"><div class="spinner"></div><p>${message}</p></div>`; },
        applyTheme(color) { document.documentElement.style.setProperty('--primary-color', color); localStorage.setItem('avrenpediaTheme', color); },
        openModal(modal) { this.clearModalMessages(modal); modal.classList.add('active'); },
        closeAllModals() { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); },
        showModalError(m, msg) { m.querySelector('.modal-error').textContent = msg; },
        showModalSuccess(m, msg) { m.querySelector('.modal-success').textContent = msg; },
        clearModalMessages(m) { m.querySelector('.modal-error').textContent = ''; const s = m.querySelector('.modal-success'); if (s) s.textContent = ''; }
    };
    
    // ===================================================================================
    // PAGE RENDER FUNCTIONS
    // ===================================================================================
    function formatDuration(ms) { const minutes = Math.floor(ms / 60000); const seconds = ((ms % 60000) / 1000).toFixed(0); return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`; }

    async function renderHomePage() {
        ui.manager.dom.homeArtistsGrid.innerHTML = ui.manager.renderLoader('Loading Artists...');
        ui.manager.dom.homeAlbumsGrid.innerHTML = ui.manager.renderLoader('Loading Albums...');
        const featuredArtistIds = [ '6olE6TJLqED3rqDCT0FyPh', '04gDigrS5kc9YWfZHwBETP', '7jy3rLJdDQY21OgRLCZK48', '3WrFJ7ztbogyGnTHbHJFl2', '1dfeR4HaWDbWqFHLkxsg1d', '36QJpDe2go2KgaRleHCDls', '22bE4uQ6baNwSHPVcDxLCe', '06HL4z0CvFAxyc27GXpf02' ];
        const [artistsData, newReleases] = await Promise.all([ api.manager.getSpotifySeveralArtists(featuredArtistIds).catch(e => { console.error(e); return null; }), api.manager.getSpotifyNewReleases().catch(e => { console.error(e); return null; }) ]);
        if (artistsData) ui.manager.dom.homeArtistsGrid.innerHTML = ui.manager.populateGrid(artistsData.artists); else ui.manager.dom.homeArtistsGrid.innerHTML = `<p class="search-message">Could not load featured artists.</p>`;
        if (newReleases) ui.manager.dom.homeAlbumsGrid.innerHTML = ui.manager.populateGrid(newReleases.albums.items); else ui.manager.dom.homeAlbumsGrid.innerHTML = `<p class="search-message">Could not load new releases.</p>`;
    }

    async function renderArtistView(artistId, artistName) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Artist...');
        const [artist, albumsData, wikiInfo] = await Promise.all([ api.manager.getSpotifyArtist(artistId).catch(err => { console.error(err); return null; }), api.manager.getSpotifyArtistAlbums(artistId).catch(err => { console.error(err); return null; }), api.manager.getWikipediaInfo(artistName).catch(err => { console.error(err); return null; }) ]);
        if (!artist) { ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Could not load artist information. Please try again later.</p>`; return; }
        const isFollowing = auth.manager.isFollowing(artistId);
        const followBtnHTML = state.currentUser ? `<button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-id="${artist.id}"><i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i><span>${isFollowing ? 'Following' : 'Follow'}</span></button>` : '';
        const membersHTML = wikiInfo?.members?.length > 0 ? `<div class="artist-sidebar-section"><h3>Members</h3><ul class="member-list">${wikiInfo.members.map(m => `<li>${m}</li>`).join('')}</ul></div>` : '';
        const composersHTML = wikiInfo?.composers?.length > 0 ? `<div class="artist-sidebar-section"><h3>Songwriters</h3><ul class="member-list">${wikiInfo.composers.map(m => `<li>${m}</li>`).join('')}</ul></div>` : ''; // NOVO
        const discographyHTML = ui.manager.populateGrid(albumsData?.items);
        ui.manager.dom.detailsView.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header"><div class="details-img band-img"><img src="${artist.images[0]?.url}" alt="${artist.name}"></div><div class="details-info"><h2>${artist.name}</h2><p class="meta-info">${artist.genres.join(', ')}</p>${followBtnHTML}</div></div>
            <div class="artist-layout"><div class="artist-main-content">${wikiInfo?.summary ? `<h3>About ${artist.name}</h3><p class="bio">${wikiInfo.summary}</p>` : ''}<h3>Discography</h3>${discographyHTML}</div><div class="artist-sidebar">${membersHTML}${composersHTML}</div></div>`;
    }

    // NOVO: Função inteira para renderizar a visualização do álbum
    async function renderAlbumView(albumId) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Album...');
        const album = await api.manager.getSpotifyAlbum(albumId).catch(err => { console.error(err); return null; });
        if (!album) { ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Could not load album information. Please try again later.</p>`; return; }
        const tracksHTML = album.tracks.items.map(track => `
            <div class="track-item">
                <div class="track-number">${track.track_number}</div>
                <div class="track-info">
                    <div class="track-title">${track.name}</div>
                    <div class="track-artists">${track.artists.map(a => a.name).join(', ')}</div>
                </div>
                <div class="track-duration">${formatDuration(track.duration_ms)}</div>
            </div>
        `).join('');
        ui.manager.dom.detailsView.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header"><div class="details-img album-art"><img src="${album.images[0]?.url}" alt="${album.name}"></div><div class="details-info"><h2>${album.name}</h2><p class="meta-info">${album.artists.map(a => a.name).join(', ')}</p><p class="album-meta">${album.release_date.substring(0, 4)} &bull; ${album.total_tracks} songs</p></div></div>
            <div class="track-list">${tracksHTML}</div>`;
    }

    function renderFollowingPage() { if (!state.currentUser) return; ui.manager.dom.followedArtistsGrid.innerHTML = ui.manager.populateGrid(state.currentUser.following.map(a => ({...a, type: 'artist'}))); }

    function setupEventListeners() {
        document.body.addEventListener('click', async e => {
            const card = e.target.closest('.music-card');
            // MUDANÇA CRÍTICA: Diferencia o clique entre artista e álbum
            if (card) {
                const { type, id, name } = card.dataset;
                if (type === 'artist') return renderArtistView(id, decodeURIComponent(name));
                if (type === 'album') return renderAlbumView(id);
            }
            const followBtn = e.target.closest('.follow-btn');
            if (followBtn) { const artist = await api.manager.getSpotifyArtist(followBtn.dataset.artistId); const isFollowing = await auth.manager.toggleFollow(artist); followBtn.classList.toggle('following', isFollowing); followBtn.querySelector('i').className = `fas ${isFollowing ? 'fa-check' : 'fa-plus'}`; followBtn.querySelector('span').textContent = isFollowing ? 'Following' : 'Follow'; return; }
            const passToggle = e.target.closest('.password-toggle');
            if (passToggle) { const input = passToggle.previousElementSibling; const isPassword = input.type === 'password'; input.type = isPassword ? 'text' : 'password'; passToggle.className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`; return; }
            if (e.target.closest('.back-btn')) return ui.manager.switchContent(ui.manager.dom.searchInput.value ? 'buscar' : 'inicio');
            if (e.target.closest('#loginPromptBtn')) return ui.manager.openModal(ui.manager.dom.loginModal);
            if (e.target.closest('#changeNameBtn')) return ui.manager.openModal(ui.manager.dom.nameChangeModal);
            if (e.target.closest('#switchToRegister')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.registerModal); }
            if (e.target.closest('#switchToLogin') || e.target.closest('#backToLogin')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.loginModal); }
            if (e.target.closest('#switchToForgot')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.forgotPasswordModal); }
            if (e.target.closest('#closeNameBtn') || e.target.classList.contains('modal-overlay')) return ui.manager.closeAllModals();
            if (e.target.closest('#userProfile')) return ui.manager.dom.userDropdown.classList.toggle('active');
            if (e.target.closest('#settingsBtn')) return document.getElementById('themePicker').classList.toggle('active');
            if (!e.target.closest('#userProfile')) ui.manager.dom.userDropdown.classList.remove('active');
            if (!e.target.closest('#settingsBtn')) document.getElementById('themePicker').classList.remove('active');
        });
        document.getElementById('loginSubmitBtn').addEventListener('click', handleLoginSubmit);
        document.getElementById('registerSubmitBtn').addEventListener('click', handleRegisterSubmit);
        document.getElementById('saveNameBtn').addEventListener('click', handleNameChangeSubmit);
        document.getElementById('forgotSubmitBtn').addEventListener('click', handleForgotSubmit);
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => { const target = item.dataset.target; if (target === 'seguindo') renderFollowingPage(); ui.manager.switchContent(target); }));
        document.querySelectorAll('.color-swatch').forEach(swatch => swatch.addEventListener('click', () => ui.manager.applyTheme(swatch.dataset.color)));
        document.getElementById('logoutBtn').addEventListener('click', () => { auth.manager.logout(); ui.manager.updateForAuthState(); ui.manager.switchContent('inicio'); });
        let searchTimeout;
        ui.manager.dom.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (!query) return ui.manager.switchContent('inicio');
            ui.manager.dom.searchResultsContainer.innerHTML = ui.manager.renderLoader('Searching...');
            ui.manager.switchContent('buscar');
            searchTimeout = setTimeout(async () => {
                const results = await api.manager.searchSpotify(query, 'artist,album');
                let html = '';
                if (results?.artists?.items?.length) html += `<h2 class="section-title-main">Artists</h2>${ui.manager.populateGrid(results.artists.items)}`;
                if (results?.albums?.items?.length) html += `<h2 class="section-title-main">Albums</h2>${ui.manager.populateGrid(results.albums.items)}`;
                ui.manager.dom.searchResultsContainer.innerHTML = html || '<p class="search-message">No results found.</p>';
            }, 500);
        });
    }

    async function handleLoginSubmit(e) { const btn = e.target; const modal = ui.manager.dom.loginModal; ui.manager.clearModalMessages(modal); btn.disabled = true; btn.textContent = 'Logging in...'; try { await auth.manager.login(modal.querySelector('#loginEmail').value, modal.querySelector('#loginPassword').value); ui.manager.closeAllModals(); ui.manager.updateForAuthState(); } catch (error) { ui.manager.showModalError(modal, error.message); } finally { btn.disabled = false; btn.textContent = 'Login'; } }
    async function handleRegisterSubmit(e) { const btn = e.target; const modal = ui.manager.dom.registerModal; ui.manager.clearModalMessages(modal); btn.disabled = true; btn.textContent = 'Creating...'; try { await auth.manager.register(modal.querySelector('#registerName').value, modal.querySelector('#registerEmail').value, modal.querySelector('#registerPassword').value); ui.manager.closeAllModals(); ui.manager.updateForAuthState(); } catch (error) { ui.manager.showModalError(modal, error.message); } finally { btn.disabled = false; btn.textContent = 'Create Account'; } }
    async function handleNameChangeSubmit(e) { const btn = e.target; const modal = ui.manager.dom.nameChangeModal; const newName = modal.querySelector('#newNameInput').value; if (!newName) return ui.manager.showModalError(modal, 'Name cannot be empty.'); btn.disabled = true; btn.textContent = 'Saving...'; try { state.currentUser = await api.manager.updateUser({ name: newName }); ui.manager.updateForAuthState(); ui.manager.closeAllModals(); } catch (error) { ui.manager.showModalError(modal, error.message); } finally { btn.disabled = false; btn.textContent = 'Save'; } }
    async function handleForgotSubmit(e) { const btn = e.target; const modal = ui.manager.dom.forgotPasswordModal; ui.manager.clearModalMessages(modal); btn.disabled = true; btn.textContent = 'Sending...'; try { const result = await api.manager.recoverPassword(modal.querySelector('#forgotEmail').value); ui.manager.showModalSuccess(modal, result.message); } catch (error) { ui.manager.showModalError(modal, error.message); } finally { btn.disabled = false; btn.textContent = 'Send Recovery Link'; } }

    async function init() {
        try {
            await api.manager.fetchSpotifyAppToken();
            await auth.manager.init();
            ui.manager.updateForAuthState();
            ui.manager.applyTheme(localStorage.getItem('avrenpediaTheme') || '#E50914');
            setupEventListeners();
            await renderHomePage();
            ui.manager.dom.appLoader.style.display = 'none';
            ui.manager.dom.mainContainer.style.display = 'flex';
        } catch (error) {
            console.error("Initialization failed:", error);
            ui.manager.dom.appLoader.innerHTML = `<div style="text-align: center; color: white;"><h2>Oops!</h2><p>Something went wrong during startup.</p><p style="font-size: 0.8em; color: var(--gray-text);">${error.message}</p></div>`;
        }
    }
    init();
});