document.addEventListener('DOMContentLoaded', async function() {
    // App State and Managers
    const state = { currentUser: null, spotifyAppToken: null };
    const api = {}, auth = {}, ui = {};

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
        fetchUser: () => api.manager._request('user', 'GET'),
        updateUser: (d) => api.manager._request('user', 'PUT', d),
        searchSpotify: (q, t) => api.manager._spotifyRequest(`search?q=${encodeURIComponent(q)}&type=${t}&limit=12`),
        getSpotifyArtist: (id) => api.manager._spotifyRequest(`artists/${id}`),
        getSpotifyArtistAlbums: (id) => api.manager._spotifyRequest(`artists/${id}/albums?include_groups=album,single&limit=20`),
        getSpotifyAlbum: (id) => api.manager._spotifyRequest(`albums/${id}`),
        getSpotifyNewReleases: () => api.manager._spotifyRequest(`browse/new-releases?limit=12`),
        getSpotifySeveralArtists: (ids) => api.manager._spotifyRequest(`artists?ids=${ids.join(',')}`),
        getWikipediaInfo: async (artistName) => {
            try {
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(artistName + " artist")}&srlimit=1&format=json&origin=*`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();
                const pageTitle = searchData.query.search[0]?.title;
                if (!pageTitle) return { summary: null, origin: null };
                const pageUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`;
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
                const [contentRes, summaryRes] = await Promise.all([fetch(pageUrl), fetch(summaryUrl)]);
                if (!contentRes.ok || !summaryRes.ok) return { summary: null, origin: null };
                const contentData = await contentRes.json();
                const summaryData = await summaryRes.json();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = contentData.parse.text['*'];
                let origin = null;
                const allTh = Array.from(tempDiv.querySelectorAll('.infobox th'));
                const originNode = allTh.find(th => th.textContent.trim() === 'Origin');
                if (originNode) {
                    origin = originNode.nextElementSibling.textContent.trim().split('\n')[0];
                }
                return { summary: summaryData.extract, origin };
            } catch (e) {
                console.error("Wikipedia API error:", e);
                return { summary: null, origin: null };
            }
        }
    };
    
    auth.manager = {
        async init() { if (localStorage.getItem('authToken')) { try { state.currentUser = await api.manager.fetchUser(); } catch (e) { this.logout(); }}},
        async login(email, password) { const data = await api.manager.login(email, password); localStorage.setItem('authToken', data.token); state.currentUser = await api.manager.fetchUser(); },
        async register(name, email, password) { const data = await api.manager.register(name, email, password); localStorage.setItem('authToken', data.token); state.currentUser = await api.manager.fetchUser(); },
        logout() { localStorage.removeItem('authToken'); state.currentUser = null; },
        isFollowing: (id) => state.currentUser?.following.some(a => a.id === id),
        async toggleFollow(artist) {
            if (!state.currentUser || !artist) return;
            const artistData = { id: artist.id, name: artist.name, images: artist.images, genres: artist.genres };
            const followingList = state.currentUser.following || [];
            const isCurrentlyFollowing = followingList.some(a => a.id === artist.id);
            let updatedFollowingList = isCurrentlyFollowing ? followingList.filter(a => a.id !== artist.id) : [...followingList, artistData];
            state.currentUser = await api.manager.updateUser({ following: updatedFollowingList });
            return !isCurrentlyFollowing;
        }
    };
    
    ui.manager = {
        dom: {
            appLoader: document.getElementById('app-loader'), mainContainer: document.querySelector('.main-container'), mainContent: document.querySelector('.main-content'), searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'), userProfile: document.getElementById('userProfile'), userInfo: document.getElementById('userInfo'), userAvatar: document.getElementById('userAvatar'), userDropdown: document.getElementById('userDropdown'), detailsView: document.getElementById('details-view'),
            loginModal: document.getElementById('loginModal'), registerModal: document.getElementById('registerModal'), nameChangeModal: document.getElementById('nameChangeModal'),
            followedArtistsGrid: document.getElementById('followed-artists-grid'), searchResultsContainer: document.getElementById('searchResultsContainer'),
            homeAlbumsGrid: document.getElementById('home-albums-grid'), homeArtistsGrid: document.getElementById('home-artists-grid'),
            followingStats: document.getElementById('following-stats'), themeToggleBtn: document.getElementById('themeToggleBtn'), badgeTooltip: document.getElementById('badgeTooltip')
        },
        updateForAuthState() {
            const u = state.currentUser;
            this.dom.loginPromptBtn.style.display = u ? 'none' : 'block';
            this.dom.userProfile.style.display = u ? 'flex' : 'none';
            if (u) {
                const avatarColors = ['#e53935', '#1e88e5', '#43a047', '#f4511e', '#5e35b1', '#00acc1', '#d81b60'];
                let hash = 0;
                for (let i = 0; i < u.name.length; i++) {
                    hash = u.name.charCodeAt(i) + ((hash << 5) - hash);
                }
                const colorIndex = Math.abs(hash % avatarColors.length);
                this.dom.userAvatar.style.backgroundColor = avatarColors[colorIndex];
                this.dom.userAvatar.innerHTML = u.name.charAt(0).toUpperCase();

                const badgeMap = {
                    admin: { src: 'img/Admn.png', title: 'Administrator', description: 'Reserved for Lyrica creators and managers.' },
                    supporter: { src: 'img/Apoiad.png', title: 'Lyrica Supporter', description: 'Granted to all Premium version users.' },
                    veteran: { src: 'img/Vetern.png', title: 'Beta Member', description: 'Unlocked by members of the beta version.' }
                };
                let badgesHTML = '';
                if (u.badges && u.badges.length > 0) {
                    badgesHTML += '<div class="user-badges">';
                    u.badges.forEach(badgeKey => {
                        if (badgeMap[badgeKey]) {
                            const badge = badgeMap[badgeKey];
                            badgesHTML += `<img src="${badge.src}" alt="${badge.title}" title="${badge.title}" class="badge-icon" data-badge-key="${badgeKey}">`;
                        }
                    });
                    badgesHTML += '</div>';
                }
                this.dom.userInfo.innerHTML = `<span id="userName">${u.name}</span>${badgesHTML}`;
            }
        },
        switchContent(id) { /* ... (sem alterações) ... */ },
        renderMusicCard(item) { /* ... (sem alterações) ... */ },
        populateGrid(items, container) { /* ... (sem alterações) ... */ },
        renderLoader(message) { /* ... (sem alterações) ... */ },
        applyTheme(theme) { /* ... (sem alterações) ... */ },
        openModal(modal) { /* ... (sem alterações) ... */ },
        closeAllModals() { /* ... (sem alterações) ... */ },
        showModalError(m, msg) { /* ... (sem alterações) ... */ },
        clearModalMessages(m) { /* ... (sem alterações) ... */ }
    };
    
    // ... (O resto do código é idêntico à versão anterior e está completo abaixo para sua conveniência) ...
    const formatDuration = (ms) => { const minutes = Math.floor(ms / 60000); const seconds = ((ms % 60000) / 1000).toFixed(0); return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`; };
    async function renderHomePage() {
        ui.manager.dom.homeArtistsGrid.innerHTML = ui.manager.renderLoader('');
        ui.manager.dom.homeAlbumsGrid.innerHTML = ui.manager.renderLoader('');
        const featuredArtistIds = [ '6olE6TJLqED3rqDCT0FyPh', '04gDigrS5kc9YWfZHwBETP', '7jy3rLJdDQY21OgRLCZK48', '3WrFJ7ztbogyGnTHbHJFl2', '1dfeR4HaWDbWqFHLkxsg1d', '36QJpDe2go2KgaRleHCDls', '22bE4uQ6baNwSHPVcDxLCe', '06HL4z0CvFAxyc27GXpf02' ];
        const [artistsData, newReleases] = await Promise.all([ 
            api.manager.getSpotifySeveralArtists(featuredArtistIds).catch(e => { console.error(e); return null; }), 
            api.manager.getSpotifyNewReleases().catch(e => { console.error(e); return null; }) 
        ]);
        ui.manager.populateGrid(artistsData?.artists, ui.manager.dom.homeArtistsGrid);
        ui.manager.populateGrid(newReleases?.albums?.items, ui.manager.dom.homeAlbumsGrid);
    }
    async function renderArtistView(artistId, artistName) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Artist...');
        const [artist, albumsData, wikiInfo] = await Promise.all([ 
            api.manager.getSpotifyArtist(artistId).catch(err => null), 
            api.manager.getSpotifyArtistAlbums(artistId).catch(err => null), 
            api.manager.getWikipediaInfo(artistName).catch(err => null) 
        ]);
        if (!artist) { ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Could not load artist information.</p>`; return; }
        const isFollowing = auth.manager.isFollowing(artistId);
        const followBtnHTML = state.currentUser ? `<button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-id="${artist.id}"><i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i><span>${isFollowing ? 'Following' : 'Follow'}</span></button>` : '';
        const discographyHTML = `<div class="music-grid horizontal-music-grid">${albumsData?.items?.map(ui.manager.renderMusicCard).join('') || ''}</div>`;
        const spotifyEmbedHTML = `<div class="spotify-embed"><iframe src="https://open.spotify.com/embed/artist/${artist.id}?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
        const originHTML = wikiInfo?.origin ? `<p class="artist-origin"><i class="fas fa-map-marker-alt"></i> ${wikiInfo.origin}</p>` : '';
        ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="details-header"><div class="details-img band-img"><img src="${artist.images[0]?.url}" alt="${artist.name}"></div><div class="details-info"><h2>${artist.name}</h2><p class="meta-info">${artist.genres.join(', ')}</p>${originHTML}${followBtnHTML}</div></div><div class="artist-layout"><div class="artist-main-content">${wikiInfo?.summary ? `<h3>About ${artist.name}</h3><p class="bio">${wikiInfo.summary}</p>` : ''}${spotifyEmbedHTML}<h3>Discography</h3>${discographyHTML}</div></div>`;
    }
    async function renderAlbumView(albumId) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Album...');
        const album = await api.manager.getSpotifyAlbum(albumId).catch(err => null);
        if (!album) { ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Could not load album information.</p>`; return; }
        const artistsHTML = album.artists.map(a => `<span class="clickable-artist" data-artist-id="${a.id}" data-artist-name="${encodeURIComponent(a.name)}">${a.name}</span>`).join(', ');
        const spotifyEmbedHTML = `<div class="spotify-embed"><iframe src="https://open.spotify.com/embed/album/${album.id}?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
        const tracksHTML = album.tracks.items.map(track => `<div class="track-item"><div class="track-number">${track.track_number}</div><div class="track-info"><div class="track-title">${track.name}</div><div class="track-artists">${track.artists.map(a => a.name).join(', ')}</div></div><div class="track-duration">${formatDuration(track.duration_ms)}</div></div>`).join('');
        ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="details-header"><div class="details-img album-art"><img src="${album.images[0]?.url}" alt="${album.name}"></div><div class="details-info"><h2>${album.name}</h2><p class="meta-info">${artistsHTML}</p><p class="album-meta">${album.release_date.substring(0, 4)} &bull; ${album.total_tracks} songs</p></div></div>${spotifyEmbedHTML}<h3 class="section-title-main tracks-title">Tracks</h3><div class="track-list">${tracksHTML}</div>`;
    }
    function renderFollowingPage() { 
        if (!state.currentUser) return;
        const followingCount = state.currentUser.following.length;
        const limit = 50;
        ui.manager.dom.followingStats.innerHTML = `You are following <strong>${followingCount}</strong> out of <strong>${limit}</strong> artists.`;
        const artistsToRender = state.currentUser.following.map(a => ({...a, type: 'artist'}));
        ui.manager.populateGrid(artistsToRender, ui.manager.dom.followedArtistsGrid); 
    }
    async function handleLoginSubmit(e) {
        const btn = e.target; const modal = ui.manager.dom.loginModal;
        ui.manager.clearModalMessages(modal); btn.disabled = true; btn.textContent = 'Logging in...';
        try {
            await auth.manager.login(modal.querySelector('#loginEmail').value, modal.querySelector('#loginPassword').value);
            ui.manager.closeAllModals(); ui.manager.updateForAuthState(); renderHomePage();
        } catch (error) { ui.manager.showModalError(modal, error.message); } finally { btn.disabled = false; btn.textContent = 'Login'; }
    }
    async function handleRegisterSubmit(e) {
        const btn = e.target; const modal = ui.manager.dom.registerModal;
        ui.manager.clearModalMessages(modal); const name = modal.querySelector('#registerName').value; const email = modal.querySelector('#registerEmail').value; const password = modal.querySelector('#registerPassword').value;
        if (name.length <= 4) { return ui.manager.showModalError(modal, 'Name must be more than 4 characters long'); }
        if (/\s/.test(name)) { return ui.manager.showModalError(modal, 'Name cannot contain spaces'); }
        if (password.length <= 4) { return ui.manager.showModalError(modal, 'Password must be more than 4 characters long.'); }
        btn.disabled = true; btn.textContent = 'Creating...';
        try {
            await auth.manager.register(name, email, password);
            ui.manager.closeAllModals(); ui.manager.updateForAuthState(); renderHomePage();
        } catch (error) { ui.manager.showModalError(modal, error.message); } finally { btn.disabled = false; btn.textContent = 'Create Account'; }
    }
    async function handleNameChangeSubmit(e) {
        const btn = e.target; const modal = ui.manager.dom.nameChangeModal;
        const newName = modal.querySelector('#newNameInput').value;
        if (!newName) { return ui.manager.showModalError(modal, 'Name cannot be empty.'); }
        if (newName.length <= 4) { return ui.manager.showModalError(modal, 'Name must be more than 4 characters long'); }
        if (/\s/.test(newName)) { return ui.manager.showModalError(modal, 'Name cannot contain spaces'); }
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            state.currentUser = await api.manager.updateUser({ name: newName });
            ui.manager.updateForAuthState(); ui.manager.closeAllModals();
        } catch (error) { ui.manager.showModalError(modal, error.message); } finally { btn.disabled = false; btn.textContent = 'Save'; }
    }
    function setupEventListeners() {
        document.body.addEventListener('click', async e => {
            const badgeIcon = e.target.closest('.badge-icon');
            const tooltip = ui.manager.dom.badgeTooltip;
            if (badgeIcon) {
                e.stopPropagation();
                const badgeKey = badgeIcon.dataset.badgeKey;
                const badgeMap = {
                    admin: { title: 'Administrator', description: 'Reserved for Lyrica creators and managers.' },
                    supporter: { title: 'Lyrica Supporter', description: 'Granted to all Premium version users.' },
                    veteran: { title: 'Beta Member', description: 'Unlocked by members of the beta version.' }
                };
                const badgeData = badgeMap[badgeKey];
                if (tooltip.classList.contains('active') && tooltip.dataset.currentBadge === badgeKey) {
                    tooltip.classList.remove('active');
                    return;
                }
                if (badgeData) {
                    document.getElementById('badgeTooltipTitle').textContent = badgeData.title;
                    document.getElementById('badgeTooltipDesc').textContent = badgeData.description;
                    const badgeRect = badgeIcon.getBoundingClientRect();
                    tooltip.style.left = `${badgeRect.left + (badgeRect.width / 2) - (tooltip.offsetWidth / 2)}px`;
                    tooltip.style.top = `${badgeRect.bottom + 10}px`;
                    tooltip.classList.add('active');
                    tooltip.dataset.currentBadge = badgeKey;
                }
                return;
            }
            if (tooltip.classList.contains('active') && !e.target.closest('.badge-tooltip')) {
                tooltip.classList.remove('active');
            }

            const cardContent = e.target.closest('.music-card-content');
            if (cardContent) { const { type, id, name } = cardContent.dataset; if (type === 'artist') return renderArtistView(id, decodeURIComponent(name)); if (type === 'album') return renderAlbumView(id); }
            const clickableArtist = e.target.closest('.clickable-artist');
            if (clickableArtist) { const { artistId, artistName } = clickableArtist.dataset; return renderArtistView(artistId, decodeURIComponent(artistName)); }
            const followBtn = e.target.closest('.follow-btn');
            if (followBtn) { 
                try {
                    const artist = await api.manager.getSpotifyArtist(followBtn.dataset.artistId); 
                    const isFollowing = await auth.manager.toggleFollow(artist); 
                    followBtn.classList.toggle('following', isFollowing); 
                    followBtn.querySelector('i').className = `fas ${isFollowing ? 'fa-check' : 'fa-plus'}`;
                    followBtn.querySelector('span').textContent = isFollowing ? 'Following' : 'Follow';
                } catch (error) { console.error("Follow/Unfollow failed:", error); alert(error.message); }
                return; 
            }
            const passToggle = e.target.closest('.password-toggle');
            if (passToggle) { const input = passToggle.previousElementSibling; const isPassword = input.type === 'password'; input.type = isPassword ? 'text' : 'password'; passToggle.className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`; return; }
            if (e.target.closest('.back-btn')) return ui.manager.switchContent(ui.manager.dom.searchInput.value ? 'buscar' : 'inicio');
            if (e.target.closest('#loginPromptBtn')) return ui.manager.openModal(ui.manager.dom.loginModal);
            if (e.target.closest('#changeNameBtn')) return ui.manager.openModal(ui.manager.dom.nameChangeModal);
            if (e.target.closest('#switchToRegister')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.registerModal); }
            if (e.target.closest('#switchToLogin')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.loginModal); }
            if (e.target.closest('#closeNameBtn') || e.target.closest('.close-modal-btn')) return ui.manager.closeAllModals();
            if (e.target.closest('#userProfile')) return ui.manager.dom.userDropdown.classList.toggle('active');
            if (!e.target.closest('#userProfile')) ui.manager.dom.userDropdown.classList.remove('active');
        });
        
        ui.manager.dom.themeToggleBtn.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('lyricaTheme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            ui.manager.applyTheme(newTheme);
        });

        document.getElementById('loginSubmitBtn').addEventListener('click', handleLoginSubmit);
        document.getElementById('registerSubmitBtn').addEventListener('click', handleRegisterSubmit);
        document.getElementById('saveNameBtn').addEventListener('click', handleNameChangeSubmit);
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                if (target === 'seguindo') {
                    if (!state.currentUser) {
                        return ui.manager.openModal(ui.manager.dom.loginModal);
                    }
                    renderFollowingPage();
                }
                ui.manager.switchContent(target);
            });
        });

        document.getElementById('logoutBtn').addEventListener('click', () => { auth.manager.logout(); ui.manager.updateForAuthState(); ui.manager.switchContent('inicio'); location.reload(); });
        
        let searchTimeout;
        ui.manager.dom.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (!query) return ui.manager.switchContent('inicio');
            ui.manager.dom.searchResultsContainer.innerHTML = ui.manager.renderLoader('Searching...');
            ui.manager.switchContent('buscar');
            searchTimeout = setTimeout(async () => {
                const results = await api.manager.searchSpotify(query, 'artist,album');
                const allItems = [...(results?.artists?.items || []), ...(results?.albums?.items || [])];
                const artists = allItems.filter(i => i.type === 'artist');
                const albums = allItems.filter(i => i.type === 'album');
                let html = '';
                if (artists.length) html += `<h2 class="section-title-main">Artists</h2><div class="music-grid">${artists.map(ui.manager.renderMusicCard).join('')}</div>`;
                if (albums.length) html += `<h2 class="section-title-main">Albums</h2><div class="music-grid">${albums.map(ui.manager.renderMusicCard).join('')}</div>`;
                ui.manager.dom.searchResultsContainer.innerHTML = html || '<p class="search-message">No results found.</p>';
            }, 500);
        });
    }
    async function init() {
        try {
            await api.manager.fetchSpotifyAppToken();
            await auth.manager.init();
            ui.manager.updateForAuthState();
            const savedTheme = localStorage.getItem('lyricaTheme') || 'dark';
            ui.manager.applyTheme(savedTheme);
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