document.addEventListener('DOMContentLoaded', async function() {
    const state = { currentUser: null, spotifyAppToken: null, cropper: null };
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
        getSpotifySeveralArtists: (ids) => api.manager._spotifyRequest(`artists?ids=${ids.join(',')}`),
        getPopularArtists: () => api.manager._request('popular-artists', 'GET'),
        getSpotifyRelatedArtists: (artistId) => api.manager._spotifyRequest(`artists/${artistId}/related-artists`),
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
        async init() {
            if (localStorage.getItem('authToken')) {
                try {
                    const user = await api.manager.fetchUser();
                    user.name = user.name || 'User';
                    user.following = user.following || [];
                    user.badges = user.badges || [];
                    state.currentUser = user;
                } catch (e) {
                    this.logout();
                }
            }
        },
        async login(email, password) { const data = await api.manager.login(email, password); localStorage.setItem('authToken', data.token); state.currentUser = await api.manager.fetchUser(); },
        async register(name, email, password) { const data = await api.manager.register(name, email, password); localStorage.setItem('authToken', data.token); state.currentUser = await api.manager.fetchUser(); },
        logout() { localStorage.removeItem('authToken'); state.currentUser = null; },
        isFollowing: (id) => state.currentUser?.following.some(a => a.id === id),
        async toggleFollow(artist) {
            if (!state.currentUser || !artist) return;
            const artistData = { id: artist.id, name: artist.name, images: artist.images, genres: artist.genres };
            const followingList = state.currentUser.following || [];
            const isCurrentlyFollowing = followingList.some(a => a.id === artist.id);
            let updatedFollowingList;
            if (isCurrentlyFollowing) {
                updatedFollowingList = followingList.filter(a => a.id !== artist.id);
            } else {
                const limit = getFollowLimit(state.currentUser);
                if (followingList.length >= limit) {
                    if (limit === 50) throw new Error(`You've reached your follow limit of ${limit} artists. Upgrade to Premium for a higher limit!`);
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
            themeToggleBtn: document.getElementById('themeToggleBtn'), badgeTooltip: document.getElementById('badgeTooltip')
        },
        updateForAuthState() {
            const u = state.currentUser;
            this.dom.loginPromptBtn.style.display = u ? 'none' : 'block';
            this.dom.userProfile.style.display = u ? 'flex' : 'none';
            if (u) {
                const savedAvatar = localStorage.getItem(`userAvatar_${u.email}`);
                this.dom.userAvatar.innerHTML = '';
                if (savedAvatar) {
                    this.dom.userAvatar.style.backgroundColor = 'transparent';
                    this.dom.userAvatar.innerHTML = `<img src="${savedAvatar}" alt="User Avatar" class="profile-picture">`;
                } else {
                    const avatarColors = ['#e53935', '#1e88e5', '#43a047', '#f4511e', '#5e35b1', '#00acc1', '#d81b60'];
                    let hash = 0;
                    for (let i = 0; i < u.name.length; i++) { hash = u.name.charCodeAt(i) + ((hash << 5) - hash); }
                    const colorIndex = Math.abs(hash % avatarColors.length);
                    this.dom.userAvatar.style.backgroundColor = avatarColors[colorIndex];
                    this.dom.userAvatar.textContent = u.name.charAt(0).toUpperCase();
                }
                
                let badgesHTML = '';
                if (u.badges && u.badges.length > 0) {
                    badgesHTML += '<div class="user-badges">';
                    const uniqueBadges = [...new Set(u.badges)];
                    uniqueBadges.forEach(badgeKey => {
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
        switchContent(id) { 
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active')); 
            document.getElementById(id).classList.add('active'); 
            document.querySelectorAll('.nav-item').forEach(n => {
                n.classList.toggle('active', n.dataset.target === id);
            });
            this.dom.mainContent.scrollTop = 0; 
        },
        renderMusicCard(item) {
            const img = item.images?.[0]?.url || 'https://via.placeholder.com/150';
            const sub = item.type === 'artist' ? (item.genres?.[0] || 'Artist') : (item.artists.map(a => a.name).join(', '));
            return `<div class="music-card"><div class="music-card-content" data-type="${item.type}" data-id="${item.id}" data-name="${encodeURIComponent(item.name)}"><div class="music-img"><img src="${img}" alt="${item.name}"></div><div class="music-title">${item.name}</div><div class="music-artist">${sub}</div></div></div>`;
        },
        populateGrid(items, container) { if (!items || items.length === 0) { container.innerHTML = '<p class="search-message">Nothing to show here.</p>'; return; } container.innerHTML = items.filter(item => item).map(this.renderMusicCard).join(''); },
        renderLoader(message) { return `<div class="loading-container"><div class="spinner"></div><p>${message}</p></div>`; },
        applyTheme(theme) {
            if (theme === 'light') { document.body.classList.add('light-theme'); } else { document.body.classList.remove('light-theme'); }
            localStorage.setItem('lyricaTheme', theme);
        },
        openModal(modal) { this.clearModalMessages(modal); modal.classList.add('active'); },
        closeAllModals() { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); },
        showModalError(m, msg) { m.querySelector('.modal-error').textContent = msg; },
        clearModalMessages(m) { m.querySelector('.modal-error').textContent = ''; }
    };
    
    const formatDuration = (ms) => { const minutes = Math.floor(ms / 60000); const seconds = ((ms % 60000) / 1000).toFixed(0); return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`; };
    
    async function renderHomePage() {
        const homeContainer = document.getElementById('home-container');
        homeContainer.innerHTML = ui.manager.renderLoader('Loading...');
        let finalHTML = '';

        try {
            finalHTML += `<h2 class="section-title-main">Top 9 Popular Lyrica Artists</h2>`;
            const popularGrid = document.createElement('div');
            popularGrid.className = 'music-grid horizontal-music-grid';
            popularGrid.innerHTML = ui.manager.renderLoader('');
            finalHTML += popularGrid.outerHTML;

            const popularData = await api.manager.getPopularArtists();
            homeContainer.innerHTML = finalHTML;
            ui.manager.populateGrid(popularData?.artists || [], homeContainer.querySelector('.horizontal-music-grid'));

        } catch (e) {
            console.error("Failed to load popular artists:", e);
            homeContainer.innerHTML = `<h2 class="section-title-main">Top 9 Popular Lyrica Artists</h2><p class="search-message">Could not load this section.</p>`;
        }

        if (state.currentUser && state.currentUser.following.length > 0) {
            const recommendationsContainer = document.createElement('div');
            recommendationsContainer.innerHTML = `<h2 class="section-title-main">Featured For You</h2><div class="music-grid horizontal-music-grid" id="recommendations-grid">${ui.manager.renderLoader('')}</div>`;
            homeContainer.appendChild(recommendationsContainer);
            const recommendationsGrid = document.getElementById('recommendations-grid');

            try {
                const followedArtists = state.currentUser.following;
                const randomArtist = followedArtists[Math.floor(Math.random() * followedArtists.length)];
                
                const relatedData = await api.manager.getSpotifyRelatedArtists(randomArtist.id);

                if (relatedData && relatedData.artists && relatedData.artists.length > 0) {
                    ui.manager.populateGrid(relatedData.artists, recommendationsGrid);
                } else {
                    recommendationsGrid.innerHTML = `<p class="search-message">We couldn't find recommendations based on '${randomArtist.name}'. Try following more artists!</p>`;
                }

            } catch (e) {
                console.error("Failed to load recommendations:", e);
                recommendationsGrid.innerHTML = `<p class="search-message">Could not load recommendations at this time.</p>`;
            }
        }
    }

    async function renderArtistView(artistId, artistName) { /* ... (código inalterado, como na última versão) ... */ }
    async function renderAlbumView(albumId) { /* ... (código inalterado, como na última versão) ... */ }
    
    function renderProfilePage() { 
        if (!state.currentUser) return;
        const u = state.currentUser;
        const profileContainer = document.getElementById('profile');
        
        let avatarHTML = '';
        const savedAvatar = localStorage.getItem(`userAvatar_${u.email}`);
        if (savedAvatar) {
            avatarHTML = `<img src="${savedAvatar}" alt="User Avatar" class="profile-picture">`;
        } else {
            const avatarColors = ['#e53935', '#1e88e5', '#43a047', '#f4511e', '#5e35b1', '#00acc1', '#d81b60'];
            let hash = 0;
            for (let i = 0; i < u.name.length; i++) { hash = u.name.charCodeAt(i) + ((hash << 5) - hash); }
            const colorIndex = Math.abs(hash % avatarColors.length);
            avatarHTML = `<div class="profile-avatar-large" style="background-color: ${avatarColors[colorIndex]}">${u.name.charAt(0).toUpperCase()}</div>`;
        }

        let badgesHTML = '';
        if (u.badges && u.badges.length > 0) {
            const uniqueBadges = [...new Set(u.badges)];
            uniqueBadges.forEach(badgeKey => {
                if (badgeMap[badgeKey]) {
                    const badge = badgeMap[badgeKey];
                    badgesHTML += `<img src="${badge.src}" alt="${badge.title}" title="${badge.title}" class="badge-icon" data-badge-key="${badgeKey}">`;
                }
            });
        }

        const followingCount = u.following.length;
        const limit = getFollowLimit(u);

        const profileHeaderHTML = `
            <div class="profile-header-main">
                ${savedAvatar ? `<div class="profile-avatar-large">${avatarHTML}</div>` : avatarHTML}
                <div class="profile-info-main">
                    <h2>${u.name}</h2>
                    <div class="user-badges">${badgesHTML}</div>
                    <p class="following-stats">Following <strong>${followingCount}</strong> out of <strong>${limit}</strong> artists.</p>
                </div>
            </div>
            <h2 class="section-title-main">Artists You Follow</h2>
            <div class="music-grid" id="followed-artists-grid"></div>
        `;
        
        profileContainer.innerHTML = profileHeaderHTML;
        
        const followedArtistsGrid = document.getElementById('followed-artists-grid');
        const artistsToRender = u.following.map(a => ({...a, type: 'artist'}));
        ui.manager.populateGrid(artistsToRender, followedArtistsGrid); 
    }
    
    async function handleLoginSubmit(e) { /* ... (código inalterado) ... */ }
    async function handleRegisterSubmit(e) { /* ... (código inalterado) ... */ }
    async function handleNameChangeSubmit(e) { /* ... (código inalterado) ... */ }
    
    function initCropper(imageElement) {
        if (state.cropper) state.cropper.destroy();
        state.cropper = new Cropper(imageElement, {
            aspectRatio: 1, viewMode: 1, background: false, autoCropArea: 1,
            responsive: true, restore: false, checkOrientation: false, modal: false,
            guides: false, center: false, highlight: false, cropBoxMovable: false,
            cropBoxResizable: false, toggleDragModeOnDblclick: false,
        });
    }

    function handleAvatarChange() {
        const fileInput = document.getElementById('avatarFileInput');
        const file = fileInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return ui.manager.showModalError(ui.manager.dom.avatarChangeModal, 'Please select an image file (e.g., JPG, PNG).');
        if (file.size > 2 * 1024 * 1024) return ui.manager.showModalError(ui.manager.dom.avatarChangeModal, 'File is too large. Maximum size is 2MB.');
        
        const previewImage = document.getElementById('avatarPreviewImage');
        const reader = new FileReader();
        reader.onload = e => {
            previewImage.src = e.target.result;
            previewImage.style.opacity = 1;
            initCropper(previewImage);
        };
        reader.readAsDataURL(file);
        ui.manager.clearModalMessages(ui.manager.dom.avatarChangeModal);
    }
    
    function setupEventListeners() {
        document.body.addEventListener('mouseover', e => {
            const badgeIcon = e.target.closest('.badge-icon');
            if (badgeIcon) {
                const tooltip = ui.manager.dom.badgeTooltip;
                const badgeKey = badgeIcon.dataset.badgeKey;
                const badgeData = badgeMap[badgeKey];
                if (badgeData) {
                    document.getElementById('badgeTooltipTitle').textContent = badgeData.title;
                    document.getElementById('badgeTooltipDesc').textContent = badgeData.description;
                    const badgeRect = badgeIcon.getBoundingClientRect();
                    tooltip.classList.add('active');
                    tooltip.style.left = `${badgeRect.left + (badgeRect.width / 2) - (tooltip.offsetWidth / 2)}px`;
                    tooltip.style.top = `${badgeRect.bottom + 8}px`;
                }
            }
        });

        document.body.addEventListener('mouseout', e => {
            if (e.target.closest('.badge-icon')) {
                ui.manager.dom.badgeTooltip.classList.remove('active');
            }
        });

        document.body.addEventListener('click', async e => {
            const badgeIcon = e.target.closest('.badge-icon');
            if (badgeIcon) {
                e.stopPropagation();
                return;
            }

            if (e.target.closest('#userProfile')) return ui.manager.dom.userDropdown.classList.toggle('active');
            if (!e.target.closest('#userProfile')) ui.manager.dom.userDropdown.classList.remove('active');
            
            // ... (resto da lógica de clique inalterada)
        });
        
        // ... (resto dos listeners inalterados)
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