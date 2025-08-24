document.addEventListener('DOMContentLoaded', function() {
    // Managers for different app functionalities
    const api = {}; // Will hold all API logic
    const auth = {}; // User authentication logic
    const ui = {}; // UI updates and rendering
    const quizz = {}; // Discover Quizz logic
    const state = { currentUser: null }; // Global app state

    // ===================================================================================
    // API SERVICE: Centralized fetch calls
    // ===================================================================================
    api.service = {
        async get(endpoint) {
            return await this.request(endpoint, 'GET');
        },
        async post(endpoint, body) {
            return await this.request(endpoint, 'POST', body);
        },
        async put(endpoint, body) {
            return await this.request(endpoint, 'PUT', body);
        },
        async request(endpoint, method, body = null) {
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('authToken');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const config = { method, headers };
            if (body) config.body = JSON.stringify(body);

            try {
                const response = await fetch(`/api/${endpoint}`, config);
                if (response.status === 204) return { success: true };
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'API request failed');
                return data;
            } catch (error) {
                console.error(`API Error on ${method} ${endpoint}:`, error);
                return { error: error.message };
            }
        }
    };

    // ===================================================================================
    // AUTH MANAGER: Handles user login, registration, and state
    // ===================================================================================
    auth.manager = {
        async init() {
            const token = localStorage.getItem('authToken');
            if (token) await this.fetchCurrentUser();
        },
        async login(email, password) {
            const data = await api.service.post('login', { email, password });
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                await this.fetchCurrentUser();
                return true;
            }
            return data.error || 'Login failed';
        },
        async register(name, email, password) {
            const data = await api.service.post('register', { name, email, password });
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                await this.fetchCurrentUser();
                return true;
            }
            return data.error || 'Registration failed';
        },
        logout() {
            localStorage.removeItem('authToken');
            state.currentUser = null;
        },
        async fetchCurrentUser() {
            const data = await api.service.get('user');
            if (!data.error) state.currentUser = data;
            else { this.logout(); } // Token is invalid, so log out
        },
        async updateUser(data) {
            const updatedUser = await api.service.put('user', data);
            if (!updatedUser.error) state.currentUser = updatedUser;
            return updatedUser;
        },
        isFollowing(artistId) {
            return state.currentUser?.following.some(a => a.id === artistId);
        },
        async toggleFollow(artist) {
            if (!state.currentUser) return;
            const isFollowing = this.isFollowing(artist.id);
            let updatedFollowing;
            if (isFollowing) {
                updatedFollowing = state.currentUser.following.filter(a => a.id !== artist.id);
            } else {
                updatedFollowing = [...state.currentUser.following, artist];
            }
            await this.updateUser({ following: updatedFollowing });
            return !isFollowing;
        },
        async recoverPassword(email) {
            return await api.service.post('recover-password', { email });
        }
    };
    
    // ... Continue with other managers and initialization ...

    // ===================================================================================
    // UI MANAGER: Handles DOM manipulation and rendering
    // ===================================================================================
    ui.manager = {
        dom: { /* Select all DOM elements here for cleaner code */
            appLoader: document.getElementById('app-loader'),
            mainContainer: document.querySelector('.main-container'),
            mainContent: document.querySelector('.main-content'),
            searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'),
            userProfile: document.getElementById('userProfile'),
            userName: document.getElementById('userName'),
            librarySection: document.getElementById('librarySection'),
            userDropdown: document.getElementById('userDropdown'),
            detailsView: document.getElementById('details-view'),
            // Modals
            loginModal: document.getElementById('loginModal'),
            registerModal: document.getElementById('registerModal'),
            nameChangeModal: document.getElementById('nameChangeModal'),
            forgotPasswordModal: document.getElementById('forgotPasswordModal'),
            // Quizz
            quizzContainer: document.getElementById('quizz-container'),
            quizzIntro: document.getElementById('quizz-intro'),
            quizzQuestions: document.getElementById('quizz-questions'),
            discoverResults: document.getElementById('discover-results'),
            discoverGrid: document.getElementById('discover-grid'),
        },
        updateForAuthState() {
            if (state.currentUser) {
                this.dom.loginPromptBtn.style.display = 'none';
                this.dom.userProfile.style.display = 'flex';
                this.dom.userName.textContent = state.currentUser.name;
                this.dom.librarySection.style.display = 'block';
            } else {
                this.dom.loginPromptBtn.style.display = 'block';
                this.dom.userProfile.style.display = 'none';
                this.dom.librarySection.style.display = 'none';
            }
        },
        switchContent(targetId) { /* ... same as before ... */ },
        renderMusicCard(item) { /* ... same as before ... */ },
        populateGrid(gridElement, items) { /* ... same as before ... */ },
        applyTheme(color) { /* ... same as before ... */ },
        openModal(modal) { modal.classList.add('active'); },
        closeAllModals() { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); }
    };
    
    // ===================================================================================
    // QUIZZ MANAGER
    // ===================================================================================
    quizz.manager = {
        currentQuestionIndex: 0,
        answers: {},
        questions: [
            { id: 'mood', text: "How are you feeling right now?", options: { 'Happy 😃': { target_valence: 0.8 }, 'Energetic ⚡️': { target_energy: 0.8 }, 'Chill 😌': { target_energy: 0.3 }, 'Sad 😢': { target_valence: 0.2 } } },
            { id: 'genre', text: "Pick a core sound:", options: { 'Pop Vocals': { seed_genres: 'pop' }, 'Rock Guitar': { seed_genres: 'rock' }, 'Hip-Hop Beats': { seed_genres: 'hip-hop' }, 'Electronic Synths': { seed_genres: 'electronic' } } },
            { id: 'dance', text: "Do you feel like dancing?", options: { 'Absolutely!': { target_danceability: 0.9 }, "Maybe a little": { target_danceability: 0.6 }, 'Not at all': { target_acousticness: 0.8 } } }
        ],
        start() {
            this.currentQuestionIndex = 0;
            this.answers = {};
            ui.manager.dom.quizzIntro.style.display = 'none';
            ui.manager.dom.quizzQuestions.style.display = 'block';
            ui.manager.dom.discoverResults.style.display = 'none';
            this.renderQuestion();
        },
        renderQuestion() {
            const question = this.questions[this.currentQuestionIndex];
            let optionsHTML = '';
            for (const [text, value] of Object.entries(question.options)) {
                optionsHTML += `<div class="quizz-option" data-value='${JSON.stringify(value)}'>${text}</div>`;
            }
            ui.manager.dom.quizzQuestions.innerHTML = `<h3>${question.text}</h3><div class="quizz-options">${optionsHTML}</div>`;
        },
        handleAnswer(value) {
            Object.assign(this.answers, JSON.parse(value));
            this.currentQuestionIndex++;
            if (this.currentQuestionIndex < this.questions.length) {
                this.renderQuestion();
            } else {
                this.finish();
            }
        },
        async finish() {
            ui.manager.dom.quizzQuestions.innerHTML = `<p class="search-message">Finding recommendations...</p>`;
            let params = new URLSearchParams();
            if (this.answers.seed_genres) params.append('seed_genres', this.answers.seed_genres);
            else params.append('seed_genres', 'pop,rock,hip-hop'); // Default seed
            
            for(const [key, value] of Object.entries(this.answers)) {
                if(key !== 'seed_genres') params.append(key, value);
            }
            
            const recommendations = await spotifyApi.getRecommendations(params.toString());
            ui.manager.populateGrid(ui.manager.dom.discoverGrid, recommendations?.tracks.map(t => ({...t.album, type: 'album'})) || []);
            ui.manager.dom.quizzQuestions.style.display = 'none';
            ui.manager.dom.discoverResults.style.display = 'block';
        }
    };
    
    // ... Other functions (initializeApp, renderHomePage, etc.) and event listeners
    
    async function initializeApp() {
        const appToken = await api.service.get('getToken');
        if (!appToken.access_token) {
            ui.manager.dom.appLoader.innerHTML = '<p>Error connecting to services.</p>';
            return;
        }
        // This is a simplified approach; in a real app, you'd manage token expiry
        window.spotifyAppToken = appToken.access_token;
    
        await auth.manager.init();
        ui.manager.updateForAuthState();
        setupEventListeners();
        renderHomePage();
    
        ui.manager.dom.appLoader.style.display = 'none';
        ui.manager.dom.mainContainer.style.display = 'grid';
    }
    
    initializeApp();
    
    // NOTE: This is a simplified script. You'd need to add the full render functions (renderHomePage, renderArtistView, etc.)
    // and the setupEventListeners function. The provided snippets for auth, ui, and quizz managers should be integrated
    // into your existing script structure. The core logic for handling real DB-backed users and the quizz is here.
});