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
        resetPassword: (token, newPassword) => api.manager._request('reset-password', 'POST', { token, newPassword }), // NOVO
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
        getWikipediaInfo: async (artistName) => { /* ... (código sem alterações) ... */ }
    };
    
    // ===================================================================================
    // AUTH MANAGER
    // ===================================================================================
    auth.manager = {
        async init() { if (localStorage.getItem('authToken')) { try { state.currentUser = await api.manager.fetchUser(); } catch (e) { this.logout(); }}},
        async login(email, password) { const data = await api.manager.login(email, password); localStorage.setItem('authToken', data.token); state.currentUser = await api.manager.fetchUser(); },
        async register(name, email, password) { return api.manager.register(name, email, password); }, // MODIFICADO
        logout() { localStorage.removeItem('authToken'); state.currentUser = null; },
        isFollowing: (id) => state.currentUser?.following.some(a => a.id === id)
    };
    
    // ===================================================================================
    // UI MANAGER
    // ===================================================================================
    ui.manager = {
        dom: {
            appLoader: document.getElementById('app-loader'), mainContainer: document.querySelector('.main-container'), mainContent: document.querySelector('.main-content'), searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'), userProfile: document.getElementById('userProfile'), userName: document.getElementById('userName'), libraryNavItem: document.getElementById('libraryNavItem'), userDropdown: document.getElementById('userDropdown'), detailsView: document.getElementById('details-view'),
            loginModal: document.getElementById('loginModal'), registerModal: document.getElementById('registerModal'), nameChangeModal: document.getElementById('nameChangeModal'), forgotPasswordModal: document.getElementById('forgotPasswordModal'),
            resetPasswordModal: document.getElementById('resetPasswordModal'), // NOVO
            followedArtistsGrid: document.getElementById('followed-artists-grid'), searchResultsContainer: document.getElementById('searchResultsContainer'),
            homeAlbumsGrid: document.getElementById('home-albums-grid'), homeArtistsGrid: document.getElementById('home-artists-grid')
        },
        updateForAuthState() { /* ... (código sem alterações) ... */ },
        switchContent(id) { /* ... (código sem alterações) ... */ },
        renderMusicCard(item) { /* ... (código sem alterações) ... */ },
        populateGrid(items, container) { /* ... (código sem alterações) ... */ },
        renderLoader(message) { /* ... (código sem alterações) ... */ },
        applyTheme(color) { /* ... (código sem alterações) ... */ },
        openModal(modal) { /* ... (código sem alterações) ... */ },
        closeAllModals() { /* ... (código sem alterações) ... */ },
        showModalError(m, msg) { /* ... (código sem alterações) ... */ },
        showModalSuccess(m, msg) { /* ... (código sem alterações) ... */ },
        clearModalMessages(m) { /* ... (código sem alterações) ... */ }
    };
    
    // ===================================================================================
    // PAGE RENDER FUNCTIONS
    // ===================================================================================
    async function enrichItemsWithVotes(items) { /* ... (código sem alterações) ... */ }
    function formatDuration(ms) { /* ... (código sem alterações) ... */ }
    async function renderHomePage() { /* ... (código sem alterações) ... */ }
    async function renderArtistView(artistId, artistName) { /* ... (código sem alterações) ... */ }
    async function renderAlbumView(albumId) { /* ... (código sem alterações) ... */ }
    async function renderFollowingPage() { /* ... (código sem alterações) ... */ }

    // ===================================================================================
    // EVENT LISTENERS AND HANDLERS
    // ===================================================================================
    function setupEventListeners() {
        document.body.addEventListener('click', async e => { /* ... (lógica de cliques sem alterações) ... */ });
        document.getElementById('loginSubmitBtn').addEventListener('click', handleLoginSubmit);
        document.getElementById('registerSubmitBtn').addEventListener('click', handleRegisterSubmit);
        document.getElementById('saveNameBtn').addEventListener('click', handleNameChangeSubmit);
        document.getElementById('forgotSubmitBtn').addEventListener('click', handleForgotSubmit);
        document.getElementById('resetPasswordSubmitBtn').addEventListener('click', handleResetPasswordSubmit); // NOVO
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => { const target = item.dataset.target; if (target === 'seguindo') renderFollowingPage(); ui.manager.switchContent(target); }));
        document.querySelectorAll('.color-swatch').forEach(swatch => swatch.addEventListener('click', () => ui.manager.applyTheme(swatch.dataset.color)));
        document.getElementById('logoutBtn').addEventListener('click', () => { auth.manager.logout(); ui.manager.updateForAuthState(); ui.manager.switchContent('inicio'); location.reload(); });
        let searchTimeout;
        ui.manager.dom.searchInput.addEventListener('input', (e) => { /* ... (código de busca sem alterações) ... */ });
    }

    async function handleLoginSubmit(e) { 
        const btn = e.target; 
        const modal = ui.manager.dom.loginModal; 
        ui.manager.clearModalMessages(modal); 
        btn.disabled = true; 
        btn.textContent = 'Logging in...'; 
        try { 
            await auth.manager.login(modal.querySelector('#loginEmail').value, modal.querySelector('#loginPassword').value); 
            ui.manager.closeAllModals(); 
            ui.manager.updateForAuthState(); 
            renderHomePage(); 
        } catch (error) { 
            // MODIFICADO: Lida com erro de e-mail não verificado
            if (error.message.includes('verify your email')) {
                ui.manager.showModalError(modal, 'Please verify your email before logging in.');
            } else {
                ui.manager.showModalError(modal, error.message); 
            }
        } finally { 
            btn.disabled = false; 
            btn.textContent = 'Login'; 
        } 
    }

    async function handleRegisterSubmit(e) {
        const btn = e.target;
        const modal = ui.manager.dom.registerModal;
        ui.manager.clearModalMessages(modal);
        const name = modal.querySelector('#registerName').value;
        const email = modal.querySelector('#registerEmail').value;
        const password = modal.querySelector('#registerPassword').value;
        
        // Validação no frontend
        if (name.length < 4) { return ui.manager.showModalError(modal, 'Name must be at least 4 characters long'); }
        if (/\s/.test(name)) { return ui.manager.showModalError(modal, 'Name cannot contain spaces'); }
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$/;
        if (!passwordRegex.test(password)) { return ui.manager.showModalError(modal, 'Password: 4+ chars, 1 letter, 1 number, 1 special char.'); }

        btn.disabled = true;
        btn.textContent = 'Creating...';
        try {
            // MODIFICADO: Lida com a nova resposta da API
            const response = await auth.manager.register(name, email, password);
            modal.querySelector('input[type="text"]').value = '';
            modal.querySelector('input[type="email"]').value = '';
            modal.querySelector('input[type="password"]').value = '';
            ui.manager.showModalSuccess(modal, response.message);
        } catch (error) {
            ui.manager.showModalError(modal, error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    }
    
    async function handleNameChangeSubmit(e) { /* ... (código sem alterações) ... */ }
    async function handleForgotSubmit(e) { /* ... (código sem alterações) ... */ }

    // NOVO: Handler para o formulário de redefinição de senha
    async function handleResetPasswordSubmit(e) {
        const btn = e.target;
        const modal = ui.manager.dom.resetPasswordModal;
        ui.manager.clearModalMessages(modal);
        const token = modal.dataset.token;
        const newPassword = modal.querySelector('#newPassword').value;

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$/;
        if (!passwordRegex.test(newPassword)) {
            return ui.manager.showModalError(modal, 'Password: 4+ chars, 1 letter, 1 number, 1 special char.');
        }

        btn.disabled = true;
        btn.textContent = 'Resetting...';
        try {
            const response = await api.manager.resetPassword(token, newPassword);
            ui.manager.showModalSuccess(modal, response.message + " You can now log in.");
            btn.style.display = 'none'; // Esconde o botão após o sucesso
            setTimeout(() => {
                ui.manager.closeAllModals();
                ui.manager.openModal(ui.manager.dom.loginModal);
            }, 3000);
        } catch (error) {
            ui.manager.showModalError(modal, error.message);
        } finally {
            if (btn.style.display !== 'none') {
                btn.disabled = false;
                btn.textContent = 'Set New Password';
            }
        }
    }

    async function init() {
        try {
            await api.manager.fetchSpotifyAppToken();
            await auth.manager.init();
            ui.manager.updateForAuthState();
            ui.manager.applyTheme(localStorage.getItem('avrenpediaTheme') || '#E50914');
            setupEventListeners();
            await renderHomePage();
            
            // NOVO: Verifica se há um token de redefinição na URL
            const urlParams = new URLSearchParams(window.location.search);
            const resetToken = urlParams.get('resetToken');
            if (resetToken) {
                const modal = ui.manager.dom.resetPasswordModal;
                modal.dataset.token = resetToken;
                ui.manager.openModal(modal);
                // Limpa a URL para que o modal não reapareça ao recarregar
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            
            ui.manager.dom.appLoader.style.display = 'none';
            ui.manager.dom.mainContainer.style.display = 'flex';
        } catch (error) {
            console.error("Initialization failed:", error);
            ui.manager.dom.appLoader.innerHTML = `<div style="text-align: center; color: white;"><h2>Oops!</h2><p>Something went wrong during startup.</p><p style="font-size: 0.8em; color: var(--gray-text);">${error.message}</p></div>`;
        }
    }
    init();
});```

---

### 4. Arquivos da API (/api/)

Aqui estão os arquivos da sua pasta `/api/` com todas as modificações e os novos arquivos necessários.

##### `register.js` (Atualizado)
```javascript
// /api/register.js
import { createClient } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }
  
  const { name, email, password } = req.body;
  
  // Validação no backend
  if (!name || !email || !password) { return res.status(400).json({ error: 'All fields are required' }); }
  if (name.trim().length < 4) { return res.status(400).json({ error: 'Name must be at least 4 characters long' }); }
  if (/\s/.test(name)) { return res.status(400).json({ error: 'Name cannot contain spaces' }); }
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$/;
  if (!passwordRegex.test(password)) { return res.status(400).json({ error: 'Password does not meet requirements.' }); }

  const kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

  const normalizedName = name.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const [existingUser, nameTaken] = await Promise.all([ kv.get(`user:${normalizedEmail}`), kv.get(`name:${normalizedName}`) ]);
  
  if (existingUser) { return res.status(409).json({ error: 'Email already in use' }); }
  if (nameTaken) { return res.status(409).json({ error: 'Name already taken (case-insensitive)' }); }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { name: name.trim(), email: normalizedEmail, password: hashedPassword, following: [], votes: {}, isVerified: false };
  
  await kv.set(`user:${normalizedEmail}`, user);
  await kv.set(`name:${normalizedName}`, 1);

  const verificationToken = jwt.sign({ email: normalizedEmail }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/verify-email?token=${verificationToken}`;

  try {
    await resend.emails.send({
      from: 'Avrenpedia <onboarding@resend.dev>',
      to: normalizedEmail,
      subject: 'Verify Your Avrenpedia Account',
      html: `<h1>Welcome to Avrenpedia!</h1><p>Please click the link below to verify your email address:</p><a href="${verificationUrl}" style="color: #E50914;">Verify Email</a><p>This link will expire in 24 hours.</p>`
    });
    res.status(201).json({ message: 'Registration successful! Please check your email to verify your account.' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ error: 'Could not send verification email.' });
  }
}