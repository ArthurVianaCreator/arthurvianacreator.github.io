document.addEventListener('DOMContentLoaded', async function() {
    // App State and Managers
    const state = { currentUser: null, spotifyAppToken: null };
    const api = {}, auth = {}, ui = {};

    // ===================================================================================
    // API MANAGER (Sem alterações)
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
        fetchUser: () => api.manager._request('user', 'GET'),
        updateUser: (d) => api.manager._request('user', 'PUT', d),
        getBatchVotes: (items) => api.manager._request('get-batch-votes', 'POST', { items }),
        castVote: (itemId, itemType, voteType) => api.manager._request('vote', 'POST', { itemId, itemType, voteType }),
        searchSpotify: (q, t) => api.manager._spotifyRequest(`search?q=${encodeURIComponent(q)}&type=${t}&limit=12`),
        getSpotifyArtist: (id) => api.manager._spotifyRequest(`artists/${id}`),
        getSpotifyArtistAlbums: (id) => api.manager._spotifyRequest(`artists/${id}/albums?include_groups=album,single&limit=20`),
        getSpotifyAlbum: (id) => api.manager._spotifyRequest(`albums/${id}`),
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
                const [summaryRes] = await Promise.all([fetch(summaryUrl)]);
                if (!summaryRes.ok) return null;
                const summaryData = await summaryRes.json();
                return { summary: summaryData.extract, members: [], composers: [] };
            } catch (e) { console.error("Wikipedia API error:", e); return null; }
        }
    };
    
    // ===================================================================================
    // AUTH MANAGER (Sem alterações)
    // ===================================================================================
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
    
    // ===================================================================================
    // UI MANAGER
    // ===================================================================================
    ui.manager = {
        dom: {
            appLoader: document.getElementById('app-loader'), mainContainer: document.querySelector('.main-container'), mainContent: document.querySelector('.main-content'), searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'), userProfile: document.getElementById('userProfile'), userName: document.getElementById('userName'), userDropdown: document.getElementById('userDropdown'), detailsView: document.getElementById('details-view'),
            loginModal: document.getElementById('loginModal'), registerModal: document.getElementById('registerModal'), nameChangeModal: document.getElementById('nameChangeModal'),
            followedArtistsGrid: document.getElementById('followed-artists-grid'), searchResultsContainer: document.getElementById('searchResultsContainer'),
            homeAlbumsGrid: document.getElementById('home-albums-grid'), homeArtistsGrid: document.getElementById('home-artists-grid')
        },
        updateForAuthState() { const u = state.currentUser; this.dom.loginPromptBtn.style.display = u ? 'none' : 'block'; this.dom.userProfile.style.display = u ? 'flex' : 'none'; if (u) this.dom.userName.textContent = u.name; },
        switchContent(id) { 
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active')); 
            document.getElementById(id).classList.add('active'); 
            document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === id)); 
            this.dom.mainContent.scrollTop = 0; 
        },
        renderMusicCard(item) {
            const img = item.images?.[0]?.url || 'https://via.placeholder.com/150';
            const sub = item.type === 'artist' ? (item.genres?.[0] || 'Artist') : (item.artists.map(a => a.name).join(', '));
            const userVote = state.currentUser?.votes?.[`${item.type}:${item.id}`];
            return `<div class="music-card"><div class="music-card-content" data-type="${item.type}" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}"><div class="music-img"><img src="${img}" alt="${item.name}"></div><div class="music-title">${item.name}</div><div class="music-artist">${sub}</div></div><div class="card-votes" data-item-id="${item.id}" data-item-type="${item.type}"><button class="vote-btn like-btn ${userVote === 'like' ? 'active' : ''}"><i class="fas fa-thumbs-up"></i></button><span class="likes-count">${item.votes?.likes ?? 0}</span><button class="vote-btn dislike-btn ${userVote === 'dislike' ? 'active' : ''}"><i class="fas fa-thumbs-down"></i></button><span class="dislikes-count">${item.votes?.dislikes ?? 0}</span></div></div>`;
        },
        populateGrid(items, container) { if (!items || items.length === 0) { container.innerHTML = '<p class="search-message">Nothing to show here.</p>'; return; } container.innerHTML = items.filter(item => item).map(this.renderMusicCard).join(''); },
        renderLoader(message) { return `<div class="loading-container"><div class="spinner"></div><p>${message}</p></div>`; },
        applyTheme(color) { document.documentElement.style.setProperty('--primary-color', color); localStorage.setItem('lyricaTheme', color); },
        openModal(modal) { this.clearModalMessages(modal); modal.classList.add('active'); },
        closeAllModals() { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); },
        showModalError(m, msg) { m.querySelector('.modal-error').textContent = msg; },
        clearModalMessages(m) { m.querySelector('.modal-error').textContent = ''; const s = m.querySelector('.modal-success'); if (s) s.textContent = ''; }
    };
    
    // ===================================================================================
    // RENDER FUNCTIONS (Sem alterações)
    // ===================================================================================
    async function enrichItemsWithVotes(items) {
        if (!items || items.length === 0) return [];
        const validItems = items.filter(item => item);
        if (validItems.length === 0) return [];
        const itemKeys = validItems.map(item => `${item.type}:${item.id}`);
        const votesData = await api.manager.getBatchVotes(itemKeys);
        return validItems.map(item => ({ ...item, votes: votesData[`${item.type}:${item.id}`] || { likes: 0, dislikes: 0 } }));
    }

    function formatDuration(ms) { const minutes = Math.floor(ms / 60000); const seconds = ((ms % 60000) / 1000).toFixed(0); return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`; }

    async function renderHomePage() {
        ui.manager.dom.homeArtistsGrid.innerHTML = ui.manager.renderLoader('');
        ui.manager.dom.homeAlbumsGrid.innerHTML = ui.manager.renderLoader('');
        const featuredArtistIds = [ '6olE6TJLqED3rqDCT0FyPh', '04gDigrS5kc9YWfZHwBETP', '7jy3rLJdDQY21OgRLCZK48', '3WrFJ7ztbogyGnTHbHJFl2', '1dfeR4HaWDbWqFHLkxsg1d', '36QJpDe2go2KgaRleHCDls', '22bE4uQ6baNwSHPVcDxLCe', '06HL4z0CvFAxyc27GXpf02' ];
        const [artistsData, newReleases] = await Promise.all([ api.manager.getSpotifySeveralArtists(featuredArtistIds).catch(e => { console.error(e); return null; }), api.manager.getSpotifyNewReleases().catch(e => { console.error(e); return null; }) ]);
        const enrichedArtists = await enrichItemsWithVotes(artistsData?.artists);
        const enrichedAlbums = await enrichItemsWithVotes(newReleases?.albums?.items);
        ui.manager.populateGrid(enrichedArtists, ui.manager.dom.homeArtistsGrid);
        ui.manager.populateGrid(enrichedAlbums, ui.manager.dom.homeAlbumsGrid);
    }

    async function renderArtistView(artistId, artistName) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Artist...');
        const [[artist, albumsData, wikiInfo], votesData] = await Promise.all([ Promise.all([ api.manager.getSpotifyArtist(artistId).catch(err => null), api.manager.getSpotifyArtistAlbums(artistId).catch(err => null), api.manager.getWikipediaInfo(artistName).catch(err => null) ]), api.manager.getBatchVotes([`artist:${artistId}`]).catch(err => ({})) ]);
        if (!artist) { ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Could not load artist information.</p>`; return; }
        const votes = votesData[`artist:${artistId}`] || { likes: 0, dislikes: 0 };
        const userVote = state.currentUser?.votes?.[`artist:${artistId}`];
        const isFollowing = auth.manager.isFollowing(artistId);
        const followBtnHTML = state.currentUser ? `<button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-id="${artist.id}"><i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i><span>${isFollowing ? 'Following' : 'Follow'}</span></button>` : '';
        const voteControlsHTML = `<div class="vote-controls" data-item-id="${artist.id}" data-item-type="artist"><button class="vote-btn like-btn ${userVote === 'like' ? 'active' : ''}"><i class="fas fa-thumbs-up"></i> <span class="likes-count">${votes.likes}</span></button><button class="vote-btn dislike-btn ${userVote === 'dislike' ? 'active' : ''}"><i class="fas fa-thumbs-down"></i> <span class="dislikes-count">${votes.dislikes}</span></button></div>`;
        const enrichedAlbums = await enrichItemsWithVotes(albumsData?.items);
        const discographyHTML = `<div class="music-grid horizontal-music-grid">${enrichedAlbums?.map(ui.manager.renderMusicCard).join('') || ''}</div>`;
        const spotifyEmbedHTML = `<div class="spotify-embed"><iframe src="https://open.spotify.com/embed/artist/${artist.id}?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
        ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="details-header"><div class="details-img band-img"><img src="${artist.images[0]?.url}" alt="${artist.name}"></div><div class="details-info"><h2>${artist.name}</h2><p class="meta-info">${artist.genres.join(', ')}</p>${voteControlsHTML}${followBtnHTML}</div></div><div class="artist-layout"><div class="artist-main-content">${wikiInfo?.summary ? `<h3>About ${artist.name}</h3><p class="bio">${wikiInfo.summary}</p>` : ''}${spotifyEmbedHTML}<h3>Discography</h3>${discographyHTML}</div></div>`;
    }

    async function renderAlbumView(albumId) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Album...');
        const [album, votesData] = await Promise.all([ api.manager.getSpotifyAlbum(albumId).catch(err => null), api.manager.getBatchVotes([`album:${albumId}`]).catch(err => ({})) ]);
        if (!album) { ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Could not load album information.</p>`; return; }
        const votes = votesData[`album:${albumId}`] || { likes: 0, dislikes: 0 };
        const userVote = state.currentUser?.votes?.[`album:${albumId}`];
        const artistsHTML = album.artists.map(a => `<span class="clickable-artist" data-artist-id="${a.id}" data-artist-name="${encodeURIComponent(a.name)}">${a.name}</span>`).join(', ');
        const voteControlsHTML = `<div class="vote-controls" data-item-id="${album.id}" data-item-type="album"><button class="vote-btn like-btn ${userVote === 'like' ? 'active' : ''}"><i class="fas fa-thumbs-up"></i> <span class="likes-count">${votes.likes}</span></button><button class="vote-btn dislike-btn ${userVote === 'dislike' ? 'active' : ''}"><i class="fas fa-thumbs-down"></i> <span class="dislikes-count">${votes.dislikes}</span></button></div>`;
        const spotifyEmbedHTML = `<div class="spotify-embed"><iframe src="https://open.spotify.com/embed/album/${album.id}?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
        const tracksHTML = album.tracks.items.map(track => `<div class="track-item"><div class="track-number">${track.track_number}</div><div class="track-info"><div class="track-title">${track.name}</div><div class="track-artists">${track.artists.map(a => a.name).join(', ')}</div></div><div class="track-duration">${formatDuration(track.duration_ms)}</div></div>`).join('');
        ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="details-header"><div class="details-img album-art"><img src="${album.images[0]?.url}" alt="${album.name}"></div><div class="details-info"><h2>${album.name}</h2><p class="meta-info">${artistsHTML}</p><p class="album-meta">${album.release_date.substring(0, 4)} &bull; ${album.total_tracks} songs</p>${voteControlsHTML}</div></div>${spotifyEmbedHTML}<h3 class="section-title-main tracks-title">Tracks</h3><div class="track-list">${tracksHTML}</div>`;
    }

    async function renderFollowingPage() { 
        if (!state.currentUser) return; 
        const enrichedArtists = await enrichItemsWithVotes(state.currentUser.following.map(a => ({...a, type: 'artist'})));
        ui.manager.populateGrid(enrichedArtists, ui.manager.dom.followedArtistsGrid); 
    }
    
    // ===================================================================================
    // EVENT LISTENERS E HANDLERS
    // ===================================================================================
    function setupEventListeners() {
        document.body.addEventListener('click', async e => {
            const cardContent = e.target.closest('.music-card-content');
            if (cardContent) { const { type, id, name } = cardContent.dataset; if (type === 'artist') return renderArtistView(id, decodeURIComponent(name)); if (type === 'album') return renderAlbumView(id); }
            const voteBtn = e.target.closest('.vote-btn');
            if (voteBtn) {
                if (!state.currentUser) return ui.manager.openModal(ui.manager.dom.loginModal);
                const voteControls = voteBtn.parentElement;
                const { itemId, itemType } = voteControls.dataset;
                const voteType = voteBtn.classList.contains('like-btn') ? 'like' : 'dislike';
                try {
                    const newVotes = await api.manager.castVote(itemId, itemType, voteType);
                    state.currentUser = await api.manager.fetchUser();
                    document.querySelectorAll(`[data-item-id="${itemId}"][data-item-type="${itemType}"]`).forEach(vc => {
                        vc.querySelector('.likes-count').textContent = newVotes.likes;
                        vc.querySelector('.dislikes-count').textContent = newVotes.dislikes;
                        const userVote = state.currentUser.votes[`${itemType}:${itemId}`];
                        vc.querySelector('.like-btn').classList.toggle('active', userVote === 'like');
                        vc.querySelector('.dislike-btn').classList.toggle('active', userVote === 'dislike');
                    });
                } catch (error) { console.error("Vote failed", error); alert(error.message); }
                return;
            }
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
            if (e.target.closest('#settingsBtn')) return document.getElementById('themePicker').classList.toggle('active');
            if (!e.target.closest('#userProfile')) ui.manager.dom.userDropdown.classList.remove('active');
            if (!e.target.closest('#settingsBtn')) document.getElementById('themePicker').classList.remove('active');
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

        document.querySelectorAll('.color-swatch').forEach(swatch => swatch.addEventListener('click', () => ui.manager.applyTheme(swatch.dataset.color)));
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
                let allItems = [...(results?.artists?.items || []), ...(results?.albums?.items || [])];
                if (allItems.length > 0) { allItems = await enrichItemsWithVotes(allItems); }
                const artists = allItems.filter(i => i.type === 'artist');
                const albums = allItems.filter(i => i.type === 'album');
                let html = '';
                if (artists.length) html += `<h2 class="section-title-main">Artists</h2><div class="music-grid">${artists.map(ui.manager.renderMusicCard).join('')}</div>`;
                if (albums.length) html += `<h2 class="section-title-main">Albums</h2><div class="music-grid">${albums.map(ui.manager.renderMusicCard).join('')}</div>`;
                ui.manager.dom.searchResultsContainer.innerHTML = html || '<p class="search-message">No results found.</p>';
            }, 500);
        });
    }

    async function handleLoginSubmit(e) {
        const btn = e.target; const modal = e.target.closest('.modal-overlay'); ui.manager.clearModalMessages(modal); btn.disabled = true; btn.textContent = 'Logging in...';
        try {
            await auth.manager.login(modal.querySelector('input[type="email"]').value, modal.querySelector('input[type="password"]').value);
            ui.manager.closeAllModals(); ui.manager.updateForAuthState(); renderHomePage();
        } catch (error) {
            ui.manager.showModalError(modal, error.message);
        } finally { btn.disabled = false; btn.textContent = 'Login'; }
    }

    async function handleRegisterSubmit(e) {
        const btn = e.target; const modal = e.target.closest('.modal-overlay'); ui.manager.clearModalMessages(modal);
        const name = modal.querySelector('input[placeholder="Your Name"]').value; const email = modal.querySelector('input[type="email"]').value; const password = modal.querySelector('input[type="password"]').value;
        if (name.length <= 4) { return ui.manager.showModalError(modal, 'Name must be more than 4 characters long'); }
        if (/\s/.test(name)) { return ui.manager.showModalError(modal, 'Name cannot contain spaces'); }
        if (password.length <= 4) { return ui.manager.showModalError(modal, 'Password must be more than 4 characters long.'); }
        btn.disabled = true; btn.textContent = 'Creating...';
        try {
            await auth.manager.register(name, email, password);
            ui.manager.closeAllModals();
            ui.manager.updateForAuthState();
            renderHomePage();
        } catch (error) {
            ui.manager.showModalError(modal, error.message);
        } finally { btn.disabled = false; btn.textContent = 'Create Account'; }
    }
    
    async function handleNameChangeSubmit(e) {
        const btn = e.target; const modal = e.target.closest('.modal-overlay'); const newName = modal.querySelector('#newNameInput').value;
        if (!newName) { return ui.manager.showModalError(modal, 'Name cannot be empty.'); }
        if (newName.length <= 4) { return ui.manager.showModalError(modal, 'Name must be more than 4 characters long'); }
        if (/\s/.test(newName)) { return ui.manager.showModalError(modal, 'Name cannot contain spaces'); }
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            state.currentUser = await api.manager.updateUser({ name: newName });
            ui.manager.updateForAuthState(); ui.manager.closeAllModals();
        } catch (error) {
            ui.manager.showModalError(modal, error.message);
        } finally { btn.disabled = false; btn.textContent = 'Save'; }
    }
    
    // ===================================================================================
    // INITIALIZATION
    // ===================================================================================
    async function init() {
        try {
            await api.manager.fetchSpotifyAppToken();
            await auth.manager.init();
            ui.manager.updateForAuthState();
            ui.manager.applyTheme(localStorage.getItem('lyricaTheme') || '#E50914');
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