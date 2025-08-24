document.addEventListener('DOMContentLoaded', async function() {
    // App State and Managers
    const state = { currentUser: null, spotifyAppToken: null };
    const api = {}, auth = {}, ui = {}, quizz = {};

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
        getSpotifyNewReleases: () => api.manager._spotifyRequest(`browse/new-releases?limit=12`),
        getSpotifySeveralArtists: (ids) => api.manager._spotifyRequest(`artists?ids=${ids.join(',')}`),
        getSpotifyRecommendations: (p) => api.manager._spotifyRequest(`recommendations?${p}`),
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
                let members = [];
                const membersNode = Array.from(tempDiv.querySelectorAll('.infobox th')).find(th => th.textContent.trim().startsWith('Members'));
                if (membersNode) {
                    const memberLinks = membersNode.parentElement.nextElementSibling?.querySelectorAll('a[title]');
                    if(memberLinks) members = Array.from(memberLinks).map(a => a.textContent).filter(name => !name.startsWith('['));
                }
                return { summary: summaryData.extract, members };
            } catch (e) { console.error("Wikipedia API error:", e); return null; }
        }
    };
    
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
    
    ui.manager = {
        dom: {
            appLoader: document.getElementById('app-loader'), mainContainer: document.querySelector('.main-container'), mainContent: document.querySelector('.main-content'), searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'), userProfile: document.getElementById('userProfile'), userName: document.getElementById('userName'), librarySection: document.getElementById('librarySection'), userDropdown: document.getElementById('userDropdown'), detailsView: document.getElementById('details-view'),
            loginModal: document.getElementById('loginModal'), registerModal: document.getElementById('registerModal'), nameChangeModal: document.getElementById('nameChangeModal'), forgotPasswordModal: document.getElementById('forgotPasswordModal'),
            quizzIntro: document.getElementById('quizz-intro'), quizzQuestions: document.getElementById('quizz-questions'), discoverResults: document.getElementById('discover-results'), discoverGrid: document.getElementById('discover-grid'),
            followedArtistsGrid: document.getElementById('followed-artists-grid'), searchResultsContainer: document.getElementById('searchResultsContainer'),
            homeAlbumsGrid: document.getElementById('home-albums-grid'), homeArtistsGrid: document.getElementById('home-artists-grid')
        },
        updateForAuthState() { const u = state.currentUser; this.dom.loginPromptBtn.style.display = u ? 'none' : 'block'; this.dom.userProfile.style.display = u ? 'flex' : 'none'; this.dom.librarySection.style.display = u ? 'block' : 'none'; if (u) this.dom.userName.textContent = u.name; },
        switchContent(id) { document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === id)); this.dom.mainContent.scrollTop = 0; document.querySelector('.main-container').classList.remove('sidebar-open'); },
        renderMusicCard(item) { const img = item.images?.[0]?.url || 'https://via.placeholder.com/150'; const sub = item.type === 'artist' ? (item.genres?.[0] || 'Artist') : (item.artists.map(a => a.name).join(', ')); return `<div class="music-card" data-type="${item.type}" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}"><div class="music-img"><img src="${img}" alt="${item.name}"></div><div class="music-title">${item.name}</div><div class="music-artist">${sub}</div></div>`; },
        populateGrid(items) { if (!items || items.length === 0) return '<p class="search-message">Nothing to show here.</p>'; return `<div class="music-grid">${items.map(this.renderMusicCard).join('')}</div>`; },
        renderLoader(message) { return `<div class="loading-container"><div class="spinner"></div><p>${message}</p></div>`; },
        applyTheme(color) { document.documentElement.style.setProperty('--primary-color', color); localStorage.setItem('avrenpediaTheme', color); },
        openModal(modal) { this.clearModalMessages(modal); modal.classList.add('active'); },
        closeAllModals() { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); },
        showModalError(m, msg) { m.querySelector('.modal-error').textContent = msg; },
        showModalSuccess(m, msg) { m.querySelector('.modal-success').textContent = msg; },
        clearModalMessages(m) { m.querySelector('.modal-error').textContent = ''; const s = m.querySelector('.modal-success'); if (s) s.textContent = ''; }
    };

    quizz.manager = {
        currentQuestionIndex: 0, answers: {},
        questions: [ { id: 'mood', text: "How are you feeling right now?", options: { 'Happy 😃': { target_valence: 0.8 }, 'Energetic ⚡️': { target_energy: 0.8 }, 'Chill 😌': { target_energy: 0.3 }, 'Sad 😢': { target_valence: 0.2 } } }, { id: 'genre', text: "Pick a core sound:", options: { 'Pop Vocals': { seed_genres: 'pop' }, 'Rock Guitar': { seed_genres: 'rock' }, 'Hip-Hop Beats': { seed_genres: 'hip-hop' }, 'Electronic Synths': { seed_genres: 'electronic' } } }, { id: 'dance', text: "Do you feel like dancing?", options: { 'Absolutely!': { target_danceability: 0.9 }, "Maybe a little": { target_danceability: 0.6 }, 'Not at all': { target_acousticness: 0.8 } } } ],
        start() { this.currentQuestionIndex = 0; this.answers = {}; ui.manager.dom.quizzIntro.style.display = 'none'; ui.manager.dom.quizzQuestions.style.display = 'block'; ui.manager.dom.discoverResults.style.display = 'none'; this.renderQuestion(); },
        renderQuestion() { const q = this.questions[this.currentQuestionIndex]; const opts = Object.entries(q.options).map(([txt, val]) => `<div class="quizz-option" data-value='${JSON.stringify(val)}'>${txt}</div>`).join(''); ui.manager.dom.quizzQuestions.innerHTML = `<h3>${q.text}</h3><div class="quizz-options">${opts}</div>`; },
        handleAnswer(val) { Object.assign(this.answers, JSON.parse(val)); this.currentQuestionIndex++; if (this.currentQuestionIndex < this.questions.length) this.renderQuestion(); else this.finish(); },
        async finish() {
            ui.manager.dom.quizzQuestions.innerHTML = ui.manager.renderLoader('Finding your recommendations...');
            let params = new URLSearchParams();
            params.append('seed_genres', this.answers.seed_genres || 'pop,rock,hip-hop');
            Object.entries(this.answers).forEach(([key, value]) => { if(key !== 'seed_genres') params.append(key, value); });
            
            try {
                const recommendations = await api.manager.getSpotifyRecommendations(params.toString());
                const uniqueAlbums = [...new Map(recommendations?.tracks.map(t => [t.album.id, {...t.album, type: 'album'}])).values()];
                ui.manager.dom.discoverGrid.innerHTML = ui.manager.populateGrid(uniqueAlbums);
            } catch (error) {
                console.error("Failed to get recommendations:", error);
                ui.manager.dom.discoverGrid.innerHTML = `<p class="search-message">Could not load recommendations. Please try again.</p>`;
            } finally {
                ui.manager.dom.quizzQuestions.style.display = 'none';
                ui.manager.dom.discoverResults.style.display = 'block';
            }
        }
    };
    
    async function renderHomePage() {
        const [newReleases, featuredIdsResponse] = await Promise.all([
            api.manager.getSpotifyNewReleases().catch(e => { console.error(e); return null; }),
            api.manager.getSpotifyRecommendations("seed_genres=pop,rock,indie,hip-hop&limit=12").catch(e => { console.error(e); return null; })
        ]);
        ui.manager.dom.homeAlbumsGrid.innerHTML = ui.manager.populateGrid(newReleases?.albums?.items);
        const artistIds = [...new Set(featuredIdsResponse?.tracks.flatMap(t => t.artists.map(a => a.id)))];
        if (artistIds.length) {
            const artistsData = await api.manager.getSpotifySeveralArtists(artistIds);
            ui.manager.dom.homeArtistsGrid.innerHTML = ui.manager.populateGrid(artistsData?.artists);
        } else {
             ui.manager.dom.homeArtistsGrid.innerHTML = `<p class="search-message">Could not load featured artists.</p>`;
        }
    }

    async function renderArtistView(artistId, artistName) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Artist...');
        
        // CORREÇÃO CRÍTICA: Executa as chamadas de forma segura para não travar
        const [artist, albumsData, wikiInfo] = await Promise.all([
            api.manager.getSpotifyArtist(artistId).catch(err => { console.error(err); return null; }),
            api.manager.getSpotifyArtistAlbums(artistId).catch(err => { console.error(err); return null; }),
            api.manager.getWikipediaInfo(artistName).catch(err => { console.error(err); return null; })
        ]);

        if (!artist) { ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Could not load artist information. Please try again later.</p>`; return; }
        
        const isFollowing = auth.manager.isFollowing(artistId);
        const followBtnHTML = state.currentUser ? `<button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-id="${artist.id}"><i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i><span>${isFollowing ? 'Following' : 'Follow'}</span></button>` : '';
        const membersHTML = wikiInfo?.members?.length > 0 ? `<div class="artist-sidebar"><h3>Members</h3><ul class="member-list">${wikiInfo.members.map(m => `<li>${m}</li>`).join('')}</ul></div>` : '';
        const discographyHTML = ui.manager.populateGrid(albumsData?.items);

        ui.manager.dom.detailsView.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header"><div class="details-img band-img"><img src="${artist.images[0]?.url}" alt="${artist.name}"></div><div class="details-info"><h2>${artist.name}</h2><p class="meta-info">${artist.genres.join(', ')}</p>${followBtnHTML}</div></div>
            <div class="artist-layout">
                <div class="artist-main-content">
                    ${wikiInfo?.summary ? `<h3>About ${artist.name}</h3><p class="bio">${wikiInfo.summary}</p>` : ''}
                    <h3>Discography</h3>${discographyHTML}
                </div>
                ${membersHTML}
            </div>`;
    }

    function renderFollowingPage() { if (!state.currentUser) return; ui.manager.dom.followedArtistsGrid.innerHTML = ui.manager.populateGrid(state.currentUser.following.map(a => ({...a, type: 'artist'}))); }

    function setupEventListeners() {
        document.body.addEventListener('click', async e => {
            const card = e.target.closest('.music-card');
            if (card) return renderArtistView(card.dataset.id, decodeURIComponent(card.dataset.name));
            const followBtn = e.target.closest('.follow-btn');
            if (followBtn) {
                const artist = await api.manager.getSpotifyArtist(followBtn.dataset.artistId);
                const isFollowing = await auth.manager.toggleFollow(artist);
                followBtn.classList.toggle('following', isFollowing);
                followBtn.querySelector('i').className = `fas ${isFollowing ? 'fa-check' : 'fa-plus'}`;
                followBtn.querySelector('span').textContent = isFollowing ? 'Following' : 'Follow';
                return;
            }
            const passToggle = e.target.closest('.password-toggle');
            if (passToggle) {
                const input = passToggle.previousElementSibling;
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                passToggle.className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`;
                return;
            }
            if (e.target.closest('.back-btn')) return ui.manager.switchContent(ui.manager.dom.searchInput.value ? 'buscar' : 'inicio');
            if (e.target.closest('#loginPromptBtn')) return ui.manager.openModal(ui.manager.dom.loginModal);
            if (e.target.closest('#changeNameBtn')) return ui.manager.openModal(ui.manager.dom.nameChangeModal);
            if (e.target.closest('#switchToRegister')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.registerModal); }
            if (e.target.closest('#switchToLogin') || e.target.closest('#backToLogin')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.loginModal); }
            if (e.target.closest('#switchToForgot')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.forgotPasswordModal); }
            if (e.target.closest('#closeNameBtn') || e.target.classList.contains('modal-overlay')) return ui.manager.closeAllModals();
            if (e.target.closest('#userProfile')) return ui.manager.dom.userDropdown.classList.toggle('active');
            if (e.target.closest('#settingsBtn')) return document.getElementById('themePicker').classList.toggle('active');
            if(e.target.closest('.start-quizz-btn')) return quizz.manager.start();
            if(e.target.closest('#retakeQuizzBtn')) return quizz.manager.start();
            const quizzOption = e.target.closest('.quizz-option');
            if(quizzOption) return quizz.manager.handleAnswer(quizzOption.dataset.value);
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
        document.getElementById('menuBtn').addEventListener('click', () => document.querySelector('.main-container').classList.add('sidebar-open'));
        document.getElementById('closeSidebarBtn').addEventListener('click', () => document.querySelector('.main-container').classList.remove('sidebar-open'));
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
            ui.manager.dom.mainContainer.style.display = 'grid';
        } catch (error) {
            console.error("Initialization failed:", error);
            ui.manager.dom.appLoader.innerHTML = `<div style="text-align: center; color: white;"><h2>Oops!</h2><p>Something went wrong during startup.</p><p style="font-size: 0.8em; color: var(--gray-text);">${error.message}</p></div>`;
        }
    }
    init();
});