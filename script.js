document.addEventListener('DOMContentLoaded', async function() {
    // App State and Managers
    const state = { currentUser: null, spotifyAppToken: null };
    const api = {};
    const auth = {};
    const ui = {};
    const quizz = {};

    // ===================================================================================
    // API MANAGER: Handles all backend and external API calls
    // ===================================================================================
    api.manager = {
        async _request(endpoint, method = 'GET', body = null) {
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('authToken');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const config = { method, headers };
            if (body) config.body = JSON.stringify(body);
            
            const response = await fetch(`/api/${endpoint}`, config);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `API Error: ${response.status}`);
            return data;
        },
        async _spotifyRequest(endpoint) {
            if (!state.spotifyAppToken) throw new Error("Spotify App Token not available.");
            const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
                headers: { 'Authorization': `Bearer ${state.spotifyAppToken}` }
            });
            if (response.status === 401) { // Token expired
                await this.fetchSpotifyAppToken();
                return this._spotifyRequest(endpoint);
            }
            if (!response.ok) throw new Error(`Spotify API Error: ${response.status}`);
            return response.json();
        },
        fetchSpotifyAppToken: async () => {
            const data = await (await fetch('/api/getToken')).json();
            state.spotifyAppToken = data.access_token;
        },
        // User API
        login: (email, password) => api.manager._request('login', 'POST', { email, password }),
        register: (name, email, password) => api.manager._request('register', 'POST', { name, email, password }),
        recoverPassword: (email) => api.manager._request('recover-password', 'POST', { email }),
        fetchUser: () => api.manager._request('user', 'GET'),
        updateUser: (userData) => api.manager._request('user', 'PUT', userData),
        // Spotify API
        searchSpotify: (q, type) => api.manager._spotifyRequest(`search?q=${encodeURIComponent(q)}&type=${type}&limit=12`),
        getSpotifyArtist: (id) => api.manager._spotifyRequest(`artists/${id}`),
        getSpotifyArtistAlbums: (id) => api.manager._spotifyRequest(`artists/${id}/albums?include_groups=album,single&limit=20`),
        getSpotifyAlbum: (id) => api.manager._spotifyRequest(`albums/${id}`),
        getSpotifyNewReleases: () => api.manager._spotifyRequest(`browse/new-releases?limit=12`),
        getSpotifySeveralArtists: (ids) => api.manager._spotifyRequest(`artists?ids=${ids.join(',')}`),
        getSpotifyRecommendations: (params) => api.manager._spotifyRequest(`recommendations?${params}`),
        // Wikipedia API
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
    
    // ===================================================================================
    // AUTH MANAGER: Handles all user session logic
    // ===================================================================================
    auth.manager = {
        async init() {
            if (localStorage.getItem('authToken')) {
                try {
                    state.currentUser = await api.manager.fetchUser();
                } catch (e) {
                    this.logout(); // Token is invalid or expired
                }
            }
        },
        async login(email, password) {
            const data = await api.manager.login(email, password);
            localStorage.setItem('authToken', data.token);
            state.currentUser = await api.manager.fetchUser();
        },
        async register(name, email, password) {
            const data = await api.manager.register(name, email, password);
            localStorage.setItem('authToken', data.token);
            state.currentUser = await api.manager.fetchUser();
        },
        logout() {
            localStorage.removeItem('authToken');
            state.currentUser = null;
        },
        isFollowing: (artistId) => state.currentUser?.following.some(a => a.id === artistId),
        async toggleFollow(artist) {
            if (!state.currentUser) return;
            const isFollowing = this.isFollowing(artist.id);
            const updatedFollowing = isFollowing
                ? state.currentUser.following.filter(a => a.id !== artist.id)
                : [...state.currentUser.following, artist];
            
            const updatedUser = await api.manager.updateUser({ following: updatedFollowing });
            state.currentUser = updatedUser;
            return !isFollowing;
        }
    };
    
    // ... O resto do código (UI, QUIZZ, Eventos, Init) continua abaixo ...

    // ===================================================================================
    // UI MANAGER: DOM manipulation and rendering
    // ===================================================================================
    ui.manager = {
        dom: {
            appLoader: document.getElementById('app-loader'), mainContainer: document.querySelector('.main-container'), mainContent: document.querySelector('.main-content'), searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'), userProfile: document.getElementById('userProfile'), userName: document.getElementById('userName'), librarySection: document.getElementById('librarySection'), userDropdown: document.getElementById('userDropdown'), detailsView: document.getElementById('details-view'),
            loginModal: document.getElementById('loginModal'), registerModal: document.getElementById('registerModal'), nameChangeModal: document.getElementById('nameChangeModal'), forgotPasswordModal: document.getElementById('forgotPasswordModal'),
            quizzContainer: document.getElementById('quizz-container'), quizzIntro: document.getElementById('quizz-intro'), quizzQuestions: document.getElementById('quizz-questions'), discoverResults: document.getElementById('discover-results'), discoverGrid: document.getElementById('discover-grid'),
        },
        updateForAuthState() {
            const user = state.currentUser;
            this.dom.loginPromptBtn.style.display = user ? 'none' : 'block';
            this.dom.userProfile.style.display = user ? 'flex' : 'none';
            this.dom.librarySection.style.display = user ? 'block' : 'none';
            if (user) this.dom.userName.textContent = user.name;
        },
        switchContent(targetId) {
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === targetId));
            this.dom.mainContent.scrollTop = 0;
            document.querySelector('.main-container').classList.remove('sidebar-open');
        },
        renderMusicCard(item) {
            const imageUrl = item.images?.[0]?.url || 'https://via.placeholder.com/150';
            const subtext = item.type === 'artist' ? (item.genres?.[0] || 'Artist') : (item.artists.map(a => a.name).join(', '));
            return `<div class="music-card" data-type="${item.type}" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}"> <div class="music-img"><img src="${imageUrl}" alt="${item.name}"></div> <div class="music-title">${item.name}</div> <div class="music-artist">${subtext}</div> </div>`;
        },
        populateGrid(gridElement, items) {
            if (!items || items.length === 0) gridElement.innerHTML = '<p class="search-message">Nothing to show here.</p>';
            else gridElement.innerHTML = items.map(this.renderMusicCard).join('');
        },
        applyTheme(color) { 
            document.documentElement.style.setProperty('--primary-color', color);
            localStorage.setItem('avrenpediaTheme', color);
        },
        openModal(modal) { modal.classList.add('active'); },
        closeAllModals() { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); },
        showModalError(modal, message) { modal.querySelector('.modal-error').textContent = message; },
        showModalSuccess(modal, message) { modal.querySelector('.modal-success').textContent = message; }
    };

    // ===================================================================================
    // QUIZZ MANAGER
    // ===================================================================================
    quizz.manager = {
        currentQuestionIndex: 0, answers: {},
        questions: [
            { id: 'mood', text: "How are you feeling right now?", options: { 'Happy 😃': { target_valence: 0.8 }, 'Energetic ⚡️': { target_energy: 0.8 }, 'Chill 😌': { target_energy: 0.3 }, 'Sad 😢': { target_valence: 0.2 } } },
            { id: 'genre', text: "Pick a core sound:", options: { 'Pop Vocals': { seed_genres: 'pop' }, 'Rock Guitar': { seed_genres: 'rock' }, 'Hip-Hop Beats': { seed_genres: 'hip-hop' }, 'Electronic Synths': { seed_genres: 'electronic' } } },
            { id: 'dance', text: "Do you feel like dancing?", options: { 'Absolutely!': { target_danceability: 0.9 }, "Maybe a little": { target_danceability: 0.6 }, 'Not at all': { target_acousticness: 0.8 } } }
        ],
        start() {
            this.currentQuestionIndex = 0; this.answers = {};
            ui.manager.dom.quizzIntro.style.display = 'none';
            ui.manager.dom.quizzQuestions.style.display = 'block';
            ui.manager.dom.discoverResults.style.display = 'none';
            this.renderQuestion();
        },
        renderQuestion() {
            const question = this.questions[this.currentQuestionIndex];
            const optionsHTML = Object.entries(question.options).map(([text, value]) => `<div class="quizz-option" data-value='${JSON.stringify(value)}'>${text}</div>`).join('');
            ui.manager.dom.quizzQuestions.innerHTML = `<h3>${question.text}</h3><div class="quizz-options">${optionsHTML}</div>`;
        },
        handleAnswer(value) {
            Object.assign(this.answers, JSON.parse(value));
            this.currentQuestionIndex++;
            if (this.currentQuestionIndex < this.questions.length) this.renderQuestion();
            else this.finish();
        },
        async finish() {
            ui.manager.dom.quizzQuestions.innerHTML = `<p class="search-message">Finding recommendations...</p>`;
            let params = new URLSearchParams();
            params.append('seed_genres', this.answers.seed_genres || 'pop,rock,hip-hop');
            Object.entries(this.answers).forEach(([key, value]) => { if(key !== 'seed_genres') params.append(key, value); });
            
            const recommendations = await api.manager.getSpotifyRecommendations(params.toString());
            ui.manager.populateGrid(ui.manager.dom.discoverGrid, recommendations?.tracks.map(t => ({...t.album, type: 'album'})) || []);
            ui.manager.dom.quizzQuestions.style.display = 'none';
            ui.manager.dom.discoverResults.style.display = 'block';
        }
    };
    
    // ... Funções de renderização de página
    async function renderHomePage() {
        const newReleases = await api.manager.getSpotifyNewReleases();
        ui.manager.populateGrid(document.getElementById('home-albums-grid'), newReleases?.albums?.items);
        const artistIds = [...new Set(newReleases?.albums?.items.flatMap(a => a.artists.map(art => art.id)))].slice(0, 12);
        if (artistIds.length) {
            const artistsData = await api.manager.getSpotifySeveralArtists(artistIds);
            ui.manager.populateGrid(document.getElementById('home-artists-grid'), artistsData?.artists);
        }
    }

    async function renderArtistView(artistId, artistName) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Loading artist info...</p>`;
        
        const [artist, albumsData, wikiInfo] = await Promise.all([
            api.manager.getSpotifyArtist(artistId), api.manager.getSpotifyArtistAlbums(artistId), api.manager.getWikipediaInfo(artistName)
        ]);

        if (!artist) { ui.manager.dom.detailsView.innerHTML = `<p class="search-message">Artist not found.</p>`; return; }
        
        const followBtnHTML = state.currentUser ? `<button class="follow-btn ${auth.manager.isFollowing(artistId) ? 'following' : ''}" data-artist-id="${artist.id}"><i class="fas ${auth.manager.isFollowing(artistId) ? 'fa-check' : 'fa-plus'}"></i><span>${auth.manager.isFollowing(artistId) ? 'Following' : 'Follow'}</span></button>` : '';
        const membersHTML = wikiInfo?.members?.length > 0 ? `<div class="artist-sidebar"><h3>Members</h3><ul class="member-list">${wikiInfo.members.map(m => `<li>${m}</li>`).join('')}</ul></div>` : '';
        
        ui.manager.dom.detailsView.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header"><div class="details-img band-img"><img src="${artist.images[0]?.url}" alt="${artist.name}"></div><div class="details-info"><h2>${artist.name}</h2><p class="meta-info">${artist.genres.join(', ')}</p>${followBtnHTML}</div></div>
            <div class="artist-layout">
                <div class="artist-main-content">
                    ${wikiInfo?.summary ? `<h3>About ${artist.name}</h3><p class="bio">${wikiInfo.summary}</p>` : ''}
                    <h3>Discography</h3><div class="music-grid">${albumsData?.items.map(ui.manager.renderMusicCard).join('') || '<p>No albums found.</p>'}</div>
                </div>
                ${membersHTML}
            </div>`;
    }

    function setupEventListeners() {
        // Eventos de clique globais para modais, dropdowns, etc.
        document.body.addEventListener('click', e => {
            // Cards de música
            const card = e.target.closest('.music-card');
            if (card) {
                const { type, id, name } = card.dataset;
                if (type === 'artist') renderArtistView(id, decodeURIComponent(name));
                // else if (type === 'album') renderAlbumView(id); // Você pode adicionar a view de álbum aqui
                return;
            }

            // Botão de seguir
            const followBtn = e.target.closest('.follow-btn');
            if (followBtn) {
                const artistId = followBtn.dataset.artistId;
                const artistName = document.querySelector('.details-info h2').textContent;
                const artistImage = document.querySelector('.details-img img').src;
                auth.manager.toggleFollow({ id: artistId, name: artistName, images: [{url: artistImage}] }).then(isFollowing => {
                    followBtn.classList.toggle('following', isFollowing);
                    followBtn.querySelector('i').className = `fas ${isFollowing ? 'fa-check' : 'fa-plus'}`;
                    followBtn.querySelector('span').textContent = isFollowing ? 'Following' : 'Follow';
                });
                return;
            }

            // Botão de voltar
            if (e.target.closest('.back-btn')) {
                ui.manager.switchContent(ui.manager.dom.searchInput.value ? 'buscar' : 'inicio');
            }

            // Abrir modais
            if (e.target.closest('#loginPromptBtn')) ui.manager.openModal(ui.manager.dom.loginModal);
            if (e.target.closest('#changeNameBtn')) ui.manager.openModal(ui.manager.dom.nameChangeModal);
            if (e.target.closest('#switchToRegister')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.registerModal); }
            if (e.target.closest('#switchToLogin')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.loginModal); }
            if (e.target.closest('#switchToForgot')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.forgotPasswordModal); }
            if (e.target.closest('#backToLogin')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.loginModal); }
            if (e.target.closest('#closeNameBtn')) ui.manager.closeAllModals();

            // Fechar modais clicando no fundo
            if (e.target.classList.contains('modal-overlay')) ui.manager.closeAllModals();

            // Abrir/Fechar dropdowns
            if (e.target.closest('#userProfile')) ui.manager.dom.userDropdown.classList.toggle('active');
            else ui.manager.dom.userDropdown.classList.remove('active');
            
            // Seletor de tema
            if (e.target.closest('#settingsBtn')) ui.manager.dom.themePicker.classList.toggle('active');
            else if (!e.target.closest('.theme-picker')) ui.manager.dom.themePicker.classList.remove('active');
            
            // Quizz
            if(e.target.closest('.start-quizz-btn')) quizz.manager.start();
            if(e.target.closest('#retakeQuizzBtn')) quizz.manager.start();
            const quizzOption = e.target.closest('.quizz-option');
            if(quizzOption) quizz.manager.handleAnswer(quizzOption.dataset.value);

            // Submissão de Modais
            if (e.target.closest('#loginSubmitBtn')) handleLoginSubmit();
            if (e.target.closest('#registerSubmitBtn')) handleRegisterSubmit();
            if (e.target.closest('#saveNameBtn')) handleNameChangeSubmit();
            if (e.target.closest('#forgotSubmitBtn')) handleForgotSubmit();
        });
        
        // Navegação principal
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => {
            const target = item.dataset.target;
            if (target === 'seguindo') renderFollowingPage();
            ui.manager.switchContent(target);
        }));

        // Outros eventos
        document.querySelectorAll('.color-swatch').forEach(swatch => swatch.addEventListener('click', () => ui.manager.applyTheme(swatch.dataset.color)));
        document.getElementById('logoutBtn').addEventListener('click', () => { auth.manager.logout(); ui.manager.updateForAuthState(); });
    }
    
    // ... Funções de handler para submissão de formulários
    async function handleLoginSubmit() {
        const modal = ui.manager.dom.loginModal;
        const email = modal.querySelector('#loginEmail').value;
        const password = modal.querySelector('#loginPassword').value;
        try {
            await auth.manager.login(email, password);
            ui.manager.closeAllModals();
            ui.manager.updateForAuthState();
        } catch (error) {
            ui.manager.showModalError(modal, error.message);
        }
    }
    async function handleRegisterSubmit() {
        // Adicione a lógica aqui
    }
    // ... e outros handlers

    // ===================================================================================
    // INICIALIZAÇÃO DA APLICAÇÃO
    // ===================================================================================
    async function init() {
        try {
            await api.manager.fetchSpotifyAppToken();
            await auth.manager.init();
            ui.manager.updateForAuthState();
            ui.manager.applyTheme(localStorage.getItem('avrenpediaTheme') || '#E50914');
            setupEventListeners();
            renderHomePage();

            ui.manager.dom.appLoader.style.display = 'none';
            ui.manager.dom.mainContainer.style.display = 'grid';
        } catch (error) {
            console.error("Initialization failed:", error);
            ui.manager.dom.appLoader.innerHTML = `<div style="text-align: center; color: white;"><h2>Oops!</h2><p>Something went wrong during startup.</p><p style="font-size: 0.8em; color: var(--gray-text);">${error.message}</p></div>`;
        }
    }

    init();
});