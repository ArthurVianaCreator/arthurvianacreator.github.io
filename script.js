document.addEventListener('DOMContentLoaded', async function() {
    const state = { currentUser: null, spotifyAppToken: null, cropper: null, lastView: 'inicio', artistContextId: null };
    const api = {}, auth = {}, ui = {};

    const badgeMap = {
        admin: { src: 'img/Admn.png', title: 'Administrator', description: 'Reserved for Lyrica creators and managers.' },
        supporter: { src: 'img/Apoiad.png', title: 'Lyrica Supporter', description: 'Granted to all Premium version users.' },
        veteran: { src: 'img/Vetern.png', title: 'Beta Member', description: 'Unlocked by members of the beta version.' }
    };

    const getFollowLimit = (user) => {
        if (!user || !Array.isArray(user.badges)) return 50;
        if (user.badges.includes('admin')) return 1000;
        if (user.badges.includes('supporter')) return 150;
        return 50;
    };

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
            if (!state.spotifyAppToken) {
                await this.fetchSpotifyAppToken();
            }
            const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, { headers: { 'Authorization': `Bearer ${state.spotifyAppToken}` } });
            if (response.status === 401) {
                await this.fetchSpotifyAppToken();
                return this._spotifyRequest(endpoint);
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown Spotify API Error' }));
                throw new Error(errorData.error?.message || `Spotify API Error: ${response.status}`);
            }
            return response.json();
        },
        fetchSpotifyAppToken: async () => { 
            try {
                const data = await (await fetch('/api/getToken')).json(); 
                state.spotifyAppToken = data.access_token; 
            } catch (error) {
                console.error("Error fetching Spotify app token:", error);
            }
        },
        login: (e, p) => api.manager._request('login', 'POST', { email: e, password: p }),
        register: (n, e, p) => api.manager._request('register', 'POST', { name: n, email: e, password: p }),
        fetchUser: () => api.manager._request('user', 'GET'),
        updateUser: (d) => api.manager._request('user', 'PUT', d),
        searchSpotify: (q, t) => api.manager._spotifyRequest(`search?q=${encodeURIComponent(q)}&type=${t}&limit=12`),
        getSpotifyArtist: (id) => api.manager._spotifyRequest(`artists/${id}`),
        getSpotifyArtistAlbums: (id) => api.manager._spotifyRequest(`artists/${id}/albums?include_groups=album,single&limit=20`),
        getSpotifyAlbum: (id) => api.manager._spotifyRequest(`albums/${id}`),
        getPopularArtists: () => api.manager._request('popular-artists', 'GET'),
    };
    
    auth.manager = {
        async init() {
            if (localStorage.getItem('authToken')) {
                try {
                    state.currentUser = await api.manager.fetchUser();
                } catch (e) {
                    this.logout();
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
        isFollowing: (id) => state.currentUser?.following?.some(a => a.id === id),
        async toggleFollow(artist) {
            if (!state.currentUser) throw new Error("Please log in to follow artists.");
            if (!artist) return;

            const artistData = { 
                id: artist.id, 
                name: artist.name, 
                images: artist.images || [], 
                genres: artist.genres || [] 
            };
            const followingList = state.currentUser.following || [];
            const isCurrentlyFollowing = followingList.some(a => a.id === artist.id);
            let updatedFollowingList;

            if (isCurrentlyFollowing) {
                updatedFollowingList = followingList.filter(a => a.id !== artist.id);
            } else {
                const limit = getFollowLimit(state.currentUser);
                if (followingList.length >= limit) {
                    throw new Error(`You've reached your follow limit of ${limit} artists.`);
                }
                updatedFollowingList = [...followingList, artistData];
            }
            state.currentUser = await api.manager.updateUser({ following: updatedFollowingList });
            return !isCurrentlyFollowing;
        }
    };
    
    ui.manager = {
        dom: {
            appLoader: document.getElementById('app-loader'), mainContainer: document.querySelector('.main-container'), mainContent: document.querySelector('.main-content'), searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'), userProfile: document.getElementById('userProfile'), userInfo: document.getElementById('userInfo'), userAvatar: document.getElementById('userAvatar'), userDropdown: document.getElementById('userDropdown'), detailsView: document.getElementById('details-view'),
            loginModal: document.getElementById('loginModal'), registerModal: document.getElementById('registerModal'), nameChangeModal: document.getElementById('nameChangeModal'), avatarChangeModal: document.getElementById('avatarChangeModal'),
            searchResultsContainer: document.getElementById('searchResultsContainer'),
            homeContainer: document.getElementById('home-container'),
            themeToggleBtn: document.getElementById('themeToggleBtn'), badgeTooltip: document.getElementById('badgeTooltip'),
            profileContainer: document.getElementById('profile'),
        },
        updateForAuthState() {
            const u = state.currentUser;
            this.dom.loginPromptBtn.style.display = u ? 'none' : 'block';
            this.dom.userProfile.style.display = u ? 'flex' : 'none';
            if (u) {
                const savedAvatar = localStorage.getItem(`userAvatar_${u.email}`);
                this.dom.userAvatar.innerHTML = '';
                if (savedAvatar && savedAvatar !== "null") {
                    this.dom.userAvatar.style.backgroundColor = 'transparent';
                    this.dom.userAvatar.innerHTML = `<img src="${savedAvatar}" alt="User Avatar" class="profile-picture">`;
                } else {
                    this.dom.userAvatar.style.backgroundColor = this.getAvatarColor(u.name);
                    this.dom.userAvatar.textContent = u.name.charAt(0).toUpperCase();
                }
                let badgesHTML = '';
                if (u.badges && u.badges.length > 0) {
                    badgesHTML += '<div class="user-badges">';
                    [...new Set(u.badges)].forEach(badgeKey => {
                        if (badgeMap[badgeKey]) {
                            badgesHTML += `<img src="${badgeMap[badgeKey].src}" alt="${badgeMap[badgeKey].title}" class="badge-icon" data-badge-key="${badgeKey}">`;
                        }
                    });
                    badgesHTML += '</div>';
                }
                this.dom.userInfo.innerHTML = `<span id="userName">${u.name}</span>${badgesHTML}`;
            }
        },
        getAvatarColor(name) {
            const avatarColors = ['#e53935', '#1e88e5', '#43a047', '#f4511e', '#5e35b1', '#00acc1', '#d81b60'];
            let hash = 0;
            for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
            return avatarColors[Math.abs(hash % avatarColors.length)];
        },
        switchContent(id) { 
            const currentActiveId = document.querySelector('.content-section.active')?.id;
            if (id !== currentActiveId) {
                state.lastView = currentActiveId || 'inicio';
            }
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active')); 
            const targetSection = document.getElementById(id);
            if(targetSection) targetSection.classList.add('active'); 
            
            document.querySelectorAll('.main-nav .nav-item, .main-nav-mobile .nav-item').forEach(n => {
                n.classList.toggle('active', n.dataset.target === id);
            });
        },
        renderMusicCard(item) {
            const img = item.images?.[0]?.url || 'https://via.placeholder.com/150';
            const sub = item.type === 'artist' 
                ? (item.genres?.[0] || 'Artist') 
                : (item.artists?.map(a => a.name).join(', ') || 'Album');
            return `<div class="music-card">
                        <div class="music-card-content" data-type="${item.type}" data-id="${item.id}">
                            <div class="music-img"><img src="${img}" alt="${item.name}"></div>
                            <div class="music-title">${item.name}</div>
                            <div class="music-artist">${sub}</div>
                        </div>
                    </div>`;
        },
        populateGrid(container, items, emptyMessage = 'Nothing to show here.') { 
            if(!container) return;
            container.innerHTML = items && items.length > 0 
                ? items.map(this.renderMusicCard).join('') 
                : `<p class="search-message">${emptyMessage}</p>`; 
        },
        renderLoader(message) { return `<div class="loading-container"><div class="spinner"></div><p>${message}</p></div>`; },
        applyTheme(theme) { 
            document.body.classList.toggle('light-theme', theme === 'light'); 
            localStorage.setItem('lyricaTheme', theme); 
        },
        openModal(modal) { 
            this.clearModalMessages(modal); 
            modal.classList.add('active'); 
        },
        closeAllModals() { 
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); 
            if (state.cropper) { 
                state.cropper.destroy(); 
                state.cropper = null; 
            } 
        },
        showModalError(m, msg) { m.querySelector('.modal-error').textContent = msg; },
        clearModalMessages(m) { m.querySelector('.modal-error').textContent = ''; }
    };
    
    async function renderHomePage() {
        ui.manager.switchContent('inicio');
        ui.manager.dom.homeContainer.innerHTML = ui.manager.renderLoader('Loading...');
        try {
            const popularData = await api.manager.getPopularArtists();
            const gridHTML = popularData.artists && popularData.artists.length > 0 ? popularData.artists.map(ui.manager.renderMusicCard).join('') : '<p class="search-message">Could not load this section.</p>';
            ui.manager.dom.homeContainer.innerHTML = `<h2 class="section-title-main">Top 9 Popular Lyrica Artists</h2><div class="music-grid horizontal-music-grid">${gridHTML}</div>`;
        } catch (e) {
            ui.manager.dom.homeContainer.innerHTML = `<h2 class="section-title-main">Top 9 Popular Lyrica Artists</h2><p class="search-message">Could not load this section.</p>`;
        }
    }

    async function renderArtistView(artistId) {
        state.artistContextId = null; // Clear context when landing on an artist page.
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Artist...');
        try {
            const [artist, albumsData] = await Promise.all([
                api.manager.getSpotifyArtist(artistId),
                api.manager.getSpotifyArtistAlbums(artistId)
            ]);
            const isFollowing = state.currentUser ? auth.manager.isFollowing(artistId) : false;
            const followBtnHTML = state.currentUser 
                ? `<button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-id="${artist.id}"><i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i><span>${isFollowing ? 'Following' : 'Follow'}</span></button>` 
                : `<button class="follow-btn" disabled>Log in to Follow</button>`;
            
            const discographyHTML = albumsData?.items?.length > 0
                ? `<div class="music-grid horizontal-music-grid">${albumsData.items.map(album => ui.manager.renderMusicCard({ ...album, type: 'album' })).join('')}</div>`
                : '<p class="search-message">No albums found for this artist.</p>';

            ui.manager.dom.detailsView.innerHTML = `
                <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
                <div class="details-header">
                    <div class="details-img band-img"><img src="${artist.images[0]?.url || 'https://via.placeholder.com/200'}" alt="${artist.name}"></div>
                    <div class="details-info">
                        <h2>${artist.name}</h2>
                        <p class="meta-info">${artist.genres.join(', ')}</p>
                        ${followBtnHTML}
                    </div>
                </div>
                <h3 class="section-title-main">Discography</h3>
                ${discographyHTML}`;
        } catch (e) {
            ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><p class="search-message">Could not load artist information. ${e.message}</p>`;
        }
    }

    async function renderAlbumView(albumId) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader('Loading Album...');
        try {
            const album = await api.manager.getSpotifyAlbum(albumId);
            if (album.artists && album.artists[0]) {
                state.artistContextId = album.artists[0].id; // Set context from album's artist
            }
            const tracksHTML = album.tracks.items.map((track, index) => 
                `<li>
                    <span class="track-number">${index + 1}.</span>
                    <span class="track-name">${track.name}</span>
                    <span class="track-duration">${new Date(track.duration_ms).toISOString().substr(14, 5)}</span>
                </li>`
            ).join('');

            ui.manager.dom.detailsView.innerHTML = `
                <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
                <div class="details-header album-details-header">
                    <div class="details-img album-img"><img src="${album.images[0]?.url || 'https://via.placeholder.com/200'}" alt="${album.name}"></div>
                    <div class="details-info">
                        <h2>${album.name}</h2>
                        <p class="meta-info">
                            ${album.artists.map(a => `<span class="artist-link" data-id="${a.id}">${a.name}</span>`).join(', ')} &bull; ${new Date(album.release_date).getFullYear()}
                        </p>
                    </div>
                </div>
                <div class="album-content-layout">
                    <div class="track-list-container">
                        <h3 class="section-title-main">Tracks</h3>
                        <ol class="track-list">${tracksHTML}</ol>
                    </div>
                    <div class="spotify-embed-container">
                         <h3 class="section-title-main">Listen on Spotify</h3>
                        <iframe style="border-radius:12px" src="https://open.spotify.com/embed/album/${album.id}?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
                    </div>
                </div>`;
        } catch (e) {
             ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><p class="search-message">Could not load album information. ${e.message}</p>`;
        }
    }

    function renderProfilePage() { 
        if (!state.currentUser) {
            ui.manager.switchContent('inicio');
            ui.manager.openModal(ui.manager.dom.loginModal);
            return;
        }
        ui.manager.switchContent('profile');
        const u = state.currentUser;
        const savedAvatar = localStorage.getItem(`userAvatar_${u.email}`);
        let avatarHTML = (savedAvatar && savedAvatar !== "null") 
            ? `<img src="${savedAvatar}" alt="User Avatar" class="profile-picture">` 
            : `<div class="profile-avatar-large-placeholder">${u.name.charAt(0).toUpperCase()}</div>`;
        
        let badgesHTML = '';
        if (u.badges && u.badges.length > 0) {
            [...new Set(u.badges)].forEach(badgeKey => {
                if (badgeMap[badgeKey]) badgesHTML += `<img src="${badgeMap[badgeKey].src}" alt="${badgeMap[badgeKey].title}" class="badge-icon" data-badge-key="${badgeKey}">`;
            });
        }
        ui.manager.dom.profileContainer.innerHTML = `
            <div class="profile-header-main">
                <div class="profile-avatar-large">${avatarHTML}</div>
                <div class="profile-info-main">
                    <h2>${u.name}</h2>
                    <div class="user-badges">${badgesHTML}</div>
                    <p class="following-stats">Following <strong>${u.following?.length || 0}</strong> out of <strong>${getFollowLimit(u)}</strong> artists.</p>
                </div>
            </div>
            <h2 class="section-title-main">Artists You Follow</h2>
            <div class="music-grid" id="followed-artists-grid"></div>`;
        
        ui.manager.populateGrid(
            document.getElementById('followed-artists-grid'), 
            u.following?.map(a => ({...a, type: 'artist'})),
            "You haven't followed any artists yet. Use the search to find and follow your favorites!"
        );
    }
    
    async function handleLoginSubmit(e) {
        const btn = e.target, modal = ui.manager.dom.loginModal;
        ui.manager.clearModalMessages(modal); btn.disabled = true; btn.textContent = 'Logging in...';
        try {
            await auth.manager.login(modal.querySelector('#loginEmail').value, modal.querySelector('#loginPassword').value);
            ui.manager.closeAllModals(); 
            ui.manager.updateForAuthState(); 
            if (document.getElementById('profile').classList.contains('active')) {
                renderProfilePage();
            } else {
                renderHomePage();
            }
        } catch (error) { 
            ui.manager.showModalError(modal, error.message); 
        } finally { 
            btn.disabled = false; btn.textContent = 'Login'; 
        }
    }
    
    async function handleRegisterSubmit(e) {
        const btn = e.target, modal = ui.manager.dom.registerModal;
        ui.manager.clearModalMessages(modal);
        const name = modal.querySelector('#registerName').value, email = modal.querySelector('#registerEmail').value, password = modal.querySelector('#registerPassword').value;
        if (!name || !email || !password) return ui.manager.showModalError(modal, 'All fields are required.');
        if (name.trim().length <= 4) return ui.manager.showModalError(modal, 'Name must be more than 4 characters long.');
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) return ui.manager.showModalError(modal, 'Name can only contain letters, numbers, hyphens, and underscores.');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return ui.manager.showModalError(modal, 'Please enter a valid email address.');
        if (password.length <= 4) return ui.manager.showModalError(modal, 'Password must be more than 4 characters long.');
        btn.disabled = true; btn.textContent = 'Creating...';
        try {
            await auth.manager.register(name, email, password);
            ui.manager.closeAllModals(); 
            ui.manager.updateForAuthState(); 
            renderHomePage();
        } catch (error) { 
            ui.manager.showModalError(modal, error.message); 
        } finally { 
            btn.disabled = false; btn.textContent = 'Create Account'; 
        }
    }

    async function handleNameChangeSubmit(e) {
        const btn = e.target, modal = ui.manager.dom.nameChangeModal;
        const newName = modal.querySelector('#newNameInput').value;
        if (newName.trim().length <= 4) return ui.manager.showModalError(modal, 'Name must be more than 4 characters long');
        if (!/^[a-zA-Z0-9_-]+$/.test(newName)) return ui.manager.showModalError(modal, 'Name can only contain letters, numbers, hyphens, and underscores.');
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            state.currentUser = await api.manager.updateUser({ name: newName });
            ui.manager.updateForAuthState(); 
            ui.manager.closeAllModals();
        } catch (error) { 
            ui.manager.showModalError(modal, error.message); 
        } finally { 
            btn.disabled = false; btn.textContent = 'Save'; 
        }
    }
    
    function initCropper(imageElement) {
        if (state.cropper) state.cropper.destroy();
        state.cropper = new Cropper(imageElement, { aspectRatio: 1, viewMode: 1, background: false, autoCropArea: 1, responsive: true, checkOrientation: false });
    }

    function handleAvatarChange(event) {
        const file = event.target.files[0];
        const modal = ui.manager.dom.avatarChangeModal;
        if (!file) return;
        if (!file.type.startsWith('image/')) return ui.manager.showModalError(modal, 'Please select a valid image file.');
        if (file.size > 2 * 1024 * 1024) return ui.manager.showModalError(modal, 'File is too large (max 2MB).');
        
        const previewImage = document.getElementById('avatarPreviewImage');
        const reader = new FileReader();
        reader.onload = e => { 
            previewImage.src = e.target.result; 
            previewImage.style.opacity = 1; 
            initCropper(previewImage); 
        };
        reader.readAsDataURL(file);
    }
    
    function setupEventListeners() {
        document.body.addEventListener('mouseover', e => {
            const badgeIcon = e.target.closest('.badge-icon');
            if (badgeIcon) {
                const tooltip = ui.manager.dom.badgeTooltip;
                const badgeKey = badgeIcon.dataset.badgeKey;
                const badgeInfo = badgeMap[badgeKey];
                if (!badgeInfo) return;
                const badgeRect = badgeIcon.getBoundingClientRect();
                document.getElementById('badgeTooltipTitle').textContent = badgeInfo.title;
                document.getElementById('badgeTooltipDesc').textContent = badgeInfo.description;
                tooltip.classList.add('active');
                
                const tooltipRect = tooltip.getBoundingClientRect();
                let left = badgeRect.left + (badgeRect.width / 2) - (tooltipRect.width / 2);
                let top = badgeRect.bottom + 8;

                if (left < 8) left = 8;
                if (left + tooltipRect.width > window.innerWidth - 8) left = window.innerWidth - tooltipRect.width - 8;
                if (top + tooltipRect.height > window.innerHeight - 8) top = badgeRect.top - tooltipRect.height - 8;

                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
            }
        });
        document.body.addEventListener('mouseout', e => { 
            if (e.target.closest('.badge-icon')) ui.manager.dom.badgeTooltip.classList.remove('active'); 
        });

        document.body.addEventListener('click', async e => {
            if (e.target.closest('#userProfile')) return ui.manager.dom.userDropdown.classList.toggle('active');
            if (!e.target.closest('.user-dropdown')) ui.manager.dom.userDropdown.classList.remove('active');

            const cardContent = e.target.closest('.music-card-content');
            if (cardContent) {
                const { type, id } = cardContent.dataset;
                if (type === 'artist') return renderArtistView(id);
                if (type === 'album') return renderAlbumView(id);
            }
            const artistLink = e.target.closest('.artist-link');
            if(artistLink) return renderArtistView(artistLink.dataset.id);

            const followBtn = e.target.closest('.follow-btn:not(:disabled)');
            if (followBtn) { 
                try {
                    const artist = await api.manager.getSpotifyArtist(followBtn.dataset.artistId); 
                    const isFollowing = await auth.manager.toggleFollow(artist);
                    followBtn.classList.toggle('following', isFollowing);
                    followBtn.querySelector('span').textContent = isFollowing ? 'Following' : 'Follow';
                    followBtn.querySelector('i').className = `fas ${isFollowing ? 'fa-check' : 'fa-plus'}`;
                } catch (error) { alert(error.message); }
            }
            
            if (e.target.closest('.back-btn')) {
                if (document.getElementById('details-view').classList.contains('active') && state.artistContextId) {
                    const artistIdToReturnTo = state.artistContextId;
                    state.artistContextId = null;
                    return renderArtistView(artistIdToReturnTo);
                }
                return ui.manager.switchContent(state.lastView);
            }

            if (e.target.closest('#switchToRegister')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.registerModal); }
            if (e.target.closest('#switchToLogin')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.loginModal); }
            if (e.target.closest('.close-modal-btn') || e.target.matches('.modal-overlay')) ui.manager.closeAllModals();

            const passToggle = e.target.closest('.password-toggle');
            if (passToggle) {
                const input = passToggle.previousElementSibling;
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                passToggle.className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`;
            }
            
            if (e.target.closest('#loginPromptBtn')) ui.manager.openModal(ui.manager.dom.loginModal);
            if (e.target.closest('#changeNameBtn')) ui.manager.openModal(ui.manager.dom.nameChangeModal);
            if (e.target.closest('#changeAvatarBtn')) {
                const previewImage = document.getElementById('avatarPreviewImage');
                const savedAvatar = localStorage.getItem(`userAvatar_${state.currentUser.email}`);
                previewImage.src = savedAvatar || "";
                previewImage.style.opacity = savedAvatar ? 1 : 0;
                ui.manager.openModal(ui.manager.dom.avatarChangeModal);
                if (savedAvatar) {
                    previewImage.onload = () => initCropper(previewImage);
                }
            }
            if (e.target.closest('#uploadAvatarBtn')) document.getElementById('avatarFileInput').click();
            if (e.target.closest('#removeAvatarBtn')) {
                localStorage.removeItem(`userAvatar_${state.currentUser.email}`);
                ui.manager.updateForAuthState(); 
                ui.manager.closeAllModals();
            }
            if (e.target.closest('#saveAvatarBtn')) {
                if (state.cropper && state.cropper.getCroppedCanvas()) {
                    localStorage.setItem(`userAvatar_${state.currentUser.email}`, state.cropper.getCroppedCanvas({ width: 256, height: 256 }).toDataURL('image/png'));
                    ui.manager.updateForAuthState();
                }
                ui.manager.closeAllModals();
            }
        });
        
        ui.manager.dom.themeToggleBtn.addEventListener('click', () => ui.manager.applyTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light'));
        document.getElementById('loginSubmitBtn').addEventListener('click', handleLoginSubmit);
        document.getElementById('registerSubmitBtn').addEventListener('click', handleRegisterSubmit);
        document.getElementById('saveNameBtn').addEventListener('click', handleNameChangeSubmit);
        document.getElementById('avatarFileInput').addEventListener('change', handleAvatarChange);
        
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if (target === 'profile') {
                renderProfilePage();
            } else {
                ui.manager.switchContent(target);
            }
        }));

        document.getElementById('logoutBtn').addEventListener('click', () => { 
            auth.manager.logout(); 
            ui.manager.updateForAuthState(); 
            renderHomePage(); 
        });
        
        let searchTimeout;
        ui.manager.dom.searchInput.addEventListener('input', e => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (!query) { 
                renderHomePage();
                return; 
            }
            ui.manager.switchContent('buscar');
            ui.manager.dom.searchResultsContainer.innerHTML = ui.manager.renderLoader('Searching...');
            searchTimeout = setTimeout(async () => {
                try {
                    const results = await api.manager.searchSpotify(query, 'artist,album');
                    let html = '';
                    if (results.artists?.items.length) html += `<h2 class="section-title-main">Artists</h2><div class="music-grid">${results.artists.items.map(ui.manager.renderMusicCard).join('')}</div>`;
                    if (results.albums?.items.length) html += `<h2 class="section-title-main">Albums</h2><div class="music-grid">${results.albums.items.map(ui.manager.renderMusicCard).join('')}</div>`;
                    ui.manager.dom.searchResultsContainer.innerHTML = html || '<p class="search-message">No results found.</p>';
                } catch (error) { 
                    ui.manager.dom.searchResultsContainer.innerHTML = `<p class="search-message">Search failed. ${error.message}</p>`; 
                }
            }, 500);
        });
    }

    async function init() {
        try {
            await api.manager.fetchSpotifyAppToken();
            await auth.manager.init();
            ui.manager.updateForAuthState();
            ui.manager.applyTheme(localStorage.getItem('lyricaTheme') || 'dark');
            setupEventListeners();
            await renderHomePage();
        } catch (error) {
            console.error("Initialization failed:", error);
            ui.manager.dom.appLoader.innerHTML = `<div style="text-align: center; color: white;"><h2>Oops!</h2><p>Something went wrong during startup. Please refresh the page.</p></div>`;
        } finally {
            ui.manager.dom.appLoader.style.display = 'none';
            ui.manager.dom.mainContainer.style.display = 'flex';
        }
    }
    
    init();
});