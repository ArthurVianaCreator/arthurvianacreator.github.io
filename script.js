document.addEventListener('DOMContentLoaded', async function() {
    const state = { currentUser: null, spotifyAppToken: null, lastView: 'inicio', artistContextId: null, cameraStream: null };
    const api = {}, auth = {}, ui = {};

    // 1. Translation System
    const translations = {
        en: {
            home: 'Home', friends: 'Friends', profile: 'Profile', searchInputPlaceholder: 'Search for artists, albums, or users...',
            login: 'Login', logout: 'Log Out', changeName: 'Change Name', changePicture: 'Change Picture',
            dontHaveAccount: "Don't have an account?", signUp: 'Sign Up', alreadyHaveAccount: 'Already have an account?',
            createAccount: 'Create Account', yourName: 'Your Name', email: 'Email', password: 'Password', changeYourName: 'Change Your Name',
            newName: 'New name', cancel: 'Cancel', save: 'Save', changeProfilePicture: 'Change Profile Picture', uploadImage: 'Upload Image',
            remove: 'Remove', saveAndClose: 'Save & Close', zoomInfo: 'Use the mouse wheel to zoom.', loading: 'Loading...', takePhoto: 'Take Photo', capture: 'Capture',
            searchResults: 'Search Results', topArtists: 'Top 9 Popular Lyrica Artists', couldNotLoadSection: 'Could not load this section.',
            loadingArtist: 'Loading Artist...', loadingAlbum: 'Loading Album...', following: 'Following', follow: 'Follow', loginToFollow: 'Log in to Follow',
            biography: 'Biography', discography: 'Discography', noAlbumsFound: 'No albums found for this artist.', noBioAvailable: 'No biography available for this artist.',
            couldNotLoadArtist: 'Could not load artist information. {0}', tracks: 'Tracks', listenOnSpotify: 'Listen on Spotify',
            couldNotLoadAlbum: 'Could not load album information. {0}', artistsYouFollow: 'Artists You Follow',
            emptyFollowedArtists: "You haven't followed any artists yet. Use the search to find and follow your favorites!",
            friendRequests: 'Friend Requests', wantsToBeYourFriend: '{0} wants to be your friend.', accept: 'Accept', decline: 'Decline',
            yourFriends: 'Your Friends', emptyFriends: "You haven't added any friends yet. Use the search to find other users!",
            loadingProfile: "Loading {0}'s profile...", removeFriend: 'Remove Friend', requestSent: 'Request Sent',
            sentYouRequest: 'Sent you a request', addFriend: 'Add Friend', followingCount: 'Following ({0})', friendsCount: 'Friends ({0})',
            isNotFollowing: "{0} isn't following any artists.", hasNoFriends: '{0} has no friends yet.',
            couldNotLoadProfile: 'Could not load profile. {0}', loggingIn: 'Logging in...', creating: 'Creating...', saving: 'Saving...',
            allFieldsRequired: 'All fields are required.', nameLengthError: 'Name must be more than 4 characters long.',
            nameCharsError: 'Name can only contain letters, numbers, hyphens, and underscores.', invalidEmailError: 'Please enter a valid email address.',
            passwordLengthError: 'Password must be more than 4 characters long.', errorFollowing: 'Please log in to follow artists.',
            errorFollowLimit: "You've reached your follow limit of {0} artists.", errorFileInvalid: 'Please select a valid image file.',
            errorFileTooLarge: 'File is too large (max 2MB).', searchFailed: 'Search failed. Please try again.', noResultsFound: 'No results found for your search.',
            users: 'Users', artists: 'Artists', albums: 'Albums',
            badgeAdminTitle: 'Lyrica Administrator', badgeAdminDesc: 'Reserved for the creators and managers of the project.',
            badgeSupporterTitle: 'Lyrica Supporter', badgeSupporterDesc: 'Granted to users of the Premium plan.',
            badgeVeteranTitle: 'Veteran', badgeVeteranDesc: 'For members who participated in the beta version.',
            badgeDiscovererTitle: 'Discoverer', badgeDiscovererDesc: 'Awarded for discovering new and emerging artists.',
            badgeCollectorTitle: 'Collector', badgeCollectorDesc: 'For users with a large collection of followed artists.',
            badgeExplorerTitle: 'Explorer', badgeExplorerDesc: 'Recognizes users who delve deep into artist discographies.',
            noDescription: 'No description provided.', editDescription: 'Edit Description', saveDescription: 'Save Description', cancelEdit: 'Cancel',
            descriptionCharCount: '{0}/200 characters', followLimitTitle: 'Artist Follow Limit',
        },
        pt: {
            home: 'Início', friends: 'Amigos', profile: 'Perfil', searchInputPlaceholder: 'Pesquise por artistas, álbuns ou usuários...',
            login: 'Entrar', logout: 'Sair', changeName: 'Mudar Nome', changePicture: 'Mudar Foto', dontHaveAccount: 'Não tem uma conta?',
            signUp: 'Cadastre-se', alreadyHaveAccount: 'Já tem uma conta?', createAccount: 'Criar Conta', yourName: 'Seu Nome', email: 'E-mail',
            password: 'Senha', changeYourName: 'Mude seu Nome', newName: 'Novo nome', cancel: 'Cancelar', save: 'Salvar',
            changeProfilePicture: 'Mudar Foto de Perfil', uploadImage: 'Carregar Imagem', remove: 'Remover', saveAndClose: 'Salvar & Fechar',
            zoomInfo: 'Use a roda do mouse para dar zoom.', loading: 'Carregando...', takePhoto: 'Tirar Foto', capture: 'Capturar',
            searchResults: 'Resultados da Pesquisa', topArtists: 'Top 9 Artistas Populares no Lyrica', couldNotLoadSection: 'Não foi possível carregar esta seção.',
            loadingArtist: 'Carregando Artista...', loadingAlbum: 'Carregando Álbum...', following: 'Seguindo', follow: 'Seguir',
            loginToFollow: 'Faça login para Seguir', biography: 'Biografia', discography: 'Discografia',
            noAlbumsFound: 'Nenhum álbum encontrado para este artista.', noBioAvailable: 'Nenhuma biografia disponível para este artista.',
            couldNotLoadArtist: 'Não foi possível carregar as informações do artista. {0}', tracks: 'Faixas', listenOnSpotify: 'Ouça no Spotify',
            couldNotLoadAlbum: 'Não foi possível carregar as informações do álbum. {0}', artistsYouFollow: 'Artistas que Você Segue',
            emptyFollowedArtists: 'Você ainda não seguiu nenhum artista. Use a busca para encontrar e seguir seus favoritos!',
            friendRequests: 'Pedidos de Amizade', wantsToBeYourFriend: '{0} quer ser seu amigo.', accept: 'Aceitar', decline: 'Recusar',
            yourFriends: 'Seus Amigos', emptyFriends: 'Você ainda não adicionou amigos. Use a busca para encontrar outros usuários!',
            loadingProfile: 'Carregando perfil de {0}...', removeFriend: 'Remover Amigo', requestSent: 'Pedido Enviado',
            sentYouRequest: 'Enviou-lhe um pedido', addFriend: 'Adicionar Amigo', followingCount: 'Seguindo ({0})',
            friendsCount: 'Amigos ({0})', isNotFollowing: '{0} não está seguindo nenhum artista.', hasNoFriends: '{0} ainda não tem amigos.',
            couldNotLoadProfile: 'Não foi possível carregar o perfil. {0}', loggingIn: 'Entrando...', creating: 'Criando...',
            saving: 'Salvando...', allFieldsRequired: 'Todos os campos são obrigatórios.', nameLengthError: 'O nome deve ter mais de 4 caracteres.',
            nameCharsError: 'O nome só pode conter letras, números, hífen e sublinhado.', invalidEmailError: 'Por favor, insira um e-mail válido.',
            passwordLengthError: 'A senha deve ter mais de 4 caracteres.', errorFollowing: 'Por favor, faça login para seguir artistas.',
            errorFollowLimit: 'Você atingiu seu limite de {0} artistas para seguir.', errorFileInvalid: 'Por favor, selecione um arquivo de imagem válido.',
            errorFileTooLarge: 'O arquivo é muito grande (máx 2MB).', searchFailed: 'A busca falhou. Por favor, tente novamente.',
            noResultsFound: 'Nenhum resultado encontrado para sua busca.', users: 'Usuários', artists: 'Artistas', albums: 'Álbuns',
            badgeAdminTitle: 'Administrador Lyrica', badgeAdminDesc: 'Reservado para os criadores e gerentes do projeto.',
            badgeSupporterTitle: 'Apoiador Lyrica', badgeSupporterDesc: 'Concedido a usuários do plano Premium.',
            badgeVeteranTitle: 'Veterano', badgeVeteranDesc: 'Para membros que participaram da versão beta.',
            badgeDiscovererTitle: 'Descobridor', badgeDiscovererDesc: 'Premiado por descobrir artistas novos e emergentes.',
            badgeCollectorTitle: 'Colecionador', badgeCollectorDesc: 'Para usuários com uma grande coleção de artistas seguidos.',
            badgeExplorerTitle: 'Explorador', badgeExplorerDesc: 'Reconhece usuários que mergulham fundo nas discografias dos artistas.',
            noDescription: 'Nenhuma descrição fornecida.', editDescription: 'Editar Descrição', saveDescription: 'Salvar Descrição', cancelEdit: 'Cancelar',
            descriptionCharCount: '{0}/200 caracteres', followLimitTitle: 'Artistas seguidos',
        }
    };
    const getLanguage = () => { const lang = navigator.language.split('-')[0]; return translations[lang] ? lang : 'en'; };
    const currentTranslations = translations[getLanguage()];
    const t = (key, ...args) => {
        let text = currentTranslations[key] || key;
        args.forEach((arg, index) => { text = text.replace(`{${index}}`, arg); });
        return text;
    };
    const translateUI = () => {
        document.querySelectorAll('[data-translate-key]').forEach(el => el.textContent = t(el.getAttribute('data-translate-key')));
        document.querySelectorAll('[data-translate-placeholder-key]').forEach(el => el.placeholder = t(el.getAttribute('data-translate-placeholder-key')));
    };

    const badgeMap = {
        admin: { src: 'img/Admin.png', titleKey: 'badgeAdminTitle', descriptionKey: 'badgeAdminDesc' },
        supporter: { src: 'img/Supporter.png', titleKey: 'badgeSupporterTitle', descriptionKey: 'badgeSupporterDesc' },
        veteran: { src: 'img/BetaMember.png', titleKey: 'badgeVeteranTitle', descriptionKey: 'badgeVeteranDesc' },
        discoverer: { src: 'img/Discoverer.png', titleKey: 'badgeDiscovererTitle', descriptionKey: 'badgeDiscovererDesc' },
        collector: { src: 'img/Collector.png', titleKey: 'badgeCollectorTitle', descriptionKey: 'badgeCollectorDesc' },
        explorer: { src: 'img/Explorer.png', titleKey: 'badgeExplorerTitle', descriptionKey: 'badgeExplorerDesc' }
    };

    const getFollowLimit = (user) => 100;

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
            if (!state.spotifyAppToken) await this.fetchSpotifyAppToken();
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
            } catch (error) { console.error("Error fetching Spotify app token:", error); }
        },
        login: (e, p) => api.manager._request('login', 'POST', { email: e, password: p }),
        register: (n, e, p) => api.manager._request('register', 'POST', { name: n, email: e, password: p }),
        fetchUser: () => api.manager._request('user', 'GET'),
        updateUser: (d) => api.manager._request('user', 'PUT', d),
        manageFriend: (targetName, action) => api.manager._request('friends', 'POST', { targetName, action }),
        fetchPublicProfile: (name) => api.manager._request(`user-profile?name=${encodeURIComponent(name)}`),
        searchUsers: (query) => api.manager._request(`search-users?query=${encodeURIComponent(query)}`),
        getArtistBio: (artistName) => api.manager._request(`artist-bio?artistName=${encodeURIComponent(artistName)}`),
        searchSpotify: (q, t, l = 12) => api.manager._spotifyRequest(`search?q=${encodeURIComponent(q)}&type=${t}&limit=${l}`),
        getSpotifyArtist: (id) => api.manager._spotifyRequest(`artists/${id}`),
        getSpotifyArtistAlbums: (id) => api.manager._spotifyRequest(`artists/${id}/albums?include_groups=album,single&limit=20`),
        getSpotifyAlbum: (id) => api.manager._spotifyRequest(`albums/${id}`),
        getPopularArtists: () => api.manager._request('popular-artists', 'GET'),
    };
    
    auth.manager = {
        async init() {
            if (localStorage.getItem('authToken')) {
                try { state.currentUser = await api.manager.fetchUser(); } 
                catch (e) { this.logout(); }
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
        logout() { localStorage.removeItem('authToken'); state.currentUser = null; },
        isFollowing: (id) => state.currentUser?.following?.some(a => a.id === id),
        async toggleFollow(artist) {
            if (!state.currentUser) throw new Error(t('errorFollowing'));
            if (!artist) return;
            const artistData = { id: artist.id, name: artist.name, images: artist.images || [], genres: artist.genres || [] };
            const followingList = state.currentUser.following || [];
            const isCurrentlyFollowing = followingList.some(a => a.id === artist.id);
            let updatedFollowingList;
            if (isCurrentlyFollowing) {
                updatedFollowingList = followingList.filter(a => a.id !== artist.id);
            } else {
                const limit = getFollowLimit(state.currentUser);
                if (followingList.length >= limit) throw new Error(t('errorFollowLimit', limit));
                updatedFollowingList = [...followingList, artistData];
            }
            state.currentUser = await api.manager.updateUser({ following: updatedFollowingList });
            if (document.getElementById('profile').classList.contains('active')) {
                renderProfilePage();
            }
            return !isCurrentlyFollowing;
        }
    };
    
    ui.manager = {
        dom: {
            appLoader: document.getElementById('app-loader'), mainContainer: document.querySelector('.main-container'), searchInput: document.getElementById('searchInput'),
            loginPromptBtn: document.getElementById('loginPromptBtn'), userProfile: document.getElementById('userProfile'), userInfo: document.getElementById('userInfo'), userAvatar: document.getElementById('userAvatar'), userDropdown: document.getElementById('userDropdown'), detailsView: document.getElementById('details-view'),
            loginModal: document.getElementById('loginModal'), registerModal: document.getElementById('registerModal'), nameChangeModal: document.getElementById('nameChangeModal'), avatarChangeModal: document.getElementById('avatarChangeModal'),
            searchResultsContainer: document.getElementById('searchResultsContainer'), homeContainer: document.getElementById('home-container'),
            themeToggleBtn: document.getElementById('themeToggleBtn'), badgeTooltip: document.getElementById('badgeTooltip'),
            profileContainer: document.getElementById('profile'), socialContainer: document.getElementById('social'),
        },
        updateForAuthState() {
            const u = state.currentUser;
            this.dom.loginPromptBtn.style.display = u ? 'none' : 'block';
            this.dom.userProfile.style.display = u ? 'flex' : 'none';
            if (u) {
                this.dom.userAvatar.innerHTML = '';
                if (u.avatar) {
                    this.dom.userAvatar.style.backgroundColor = 'transparent';
                    this.dom.userAvatar.innerHTML = `<img src="${u.avatar}" alt="User Avatar" class="profile-picture">`;
                } else {
                    this.dom.userAvatar.style.backgroundColor = this.getAvatarColor(u.name);
                    this.dom.userAvatar.textContent = u.name.charAt(0).toUpperCase();
                }
                let badgesHTML = '';
                if (u.badges && u.badges.length > 0) {
                    badgesHTML += '<div class="user-badges">';
                    [...new Set(u.badges)].forEach(badgeKey => {
                        if (badgeMap[badgeKey]) badgesHTML += `<img src="${badgeMap[badgeKey].src}" alt="${t(badgeMap[badgeKey].titleKey)}" class="badge-icon" data-badge-key="${badgeKey}">`;
                    });
                    badgesHTML += '</div>';
                }
                this.dom.userInfo.innerHTML = `<span id="userName">${u.name}</span>${badgesHTML}`;
            }
            if(document.getElementById('profile').classList.contains('active')) renderProfilePage();
            if(document.getElementById('social').classList.contains('active')) renderSocialPage();
        },
        getAvatarColor(name) {
            const avatarColors = ['#e53935', '#1e88e5', '#43a047', '#f4511e', '#5e35b1', '#00acc1', '#d81b60'];
            let hash = 0;
            for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
            return avatarColors[Math.abs(hash % avatarColors.length)];
        },
        switchContent(id) { 
            const currentActiveId = document.querySelector('.content-section.active')?.id;
            if (id !== currentActiveId) state.lastView = currentActiveId || 'inicio';
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active')); 
            const targetSection = document.getElementById(id);
            if(targetSection) targetSection.classList.add('active'); 
            document.querySelectorAll('.main-nav .nav-item, .main-nav-mobile .nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === id));
        },
        renderMusicCard(item, index = 0, ranking = null) {
            const img = item.images?.[0]?.url || 'https://via.placeholder.com/150';
            const sub = item.type === 'artist' ? (item.genres?.[0] || t('artists')) : (item.artists?.map(a => a.name).join(', ') || t('albums'));
            const rankingHTML = ranking ? `<div class="ranking-badge">${ranking}</div>` : '';
            return `<div class="music-card" style="animation-delay: ${index * 50}ms">
                        ${rankingHTML}
                        <div class="music-card-content" data-type="${item.type}" data-id="${item.id}">
                            <div class="music-img"><img src="${img}" alt="${item.name}"></div>
                            <div class="music-title">${item.name}</div>
                            <div class="music-artist">${sub}</div>
                        </div>
                    </div>`;
        },
        renderUserCard(user, index = 0) {
            let avatarHTML = user.avatar ? `<img src="${user.avatar}" alt="${user.name}" class="profile-picture">` : `<div class="user-card-placeholder" style="background-color:${this.getAvatarColor(user.name)}">${user.name.charAt(0).toUpperCase()}</div>`;
            return `<div class="user-card" style="animation-delay: ${index * 50}ms" data-username="${user.name}"><div class="user-card-avatar">${avatarHTML}</div><div class="user-card-name">${user.name}</div></div>`;
        },
        populateGrid(container, items, renderFunc, emptyMessage = 'Nothing to show here.') { 
            if(!container) return;
            container.innerHTML = items && items.length > 0 ? items.map((item, index) => renderFunc(item, index)).join('') : `<p class="search-message">${emptyMessage}</p>`; 
        },
        renderLoader(message) { return `<div class="loading-container"><div class="spinner"></div><p>${message}</p></div>`; },
        applyTheme(theme) { document.body.classList.toggle('light-theme', theme === 'light'); localStorage.setItem('lyricaTheme', theme); },
        openModal(modal) { this.clearModalMessages(modal); modal.classList.add('active'); },
        closeAllModals() { 
            stopCamera();
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); 
        },
        showModalError(m, msg) { m.querySelector('.modal-error').textContent = msg; },
        clearModalMessages(m) { m.querySelector('.modal-error').textContent = ''; }
    };
    
    async function renderHomePage() {
        ui.manager.switchContent('inicio');
        ui.manager.dom.homeContainer.innerHTML = ui.manager.renderLoader(t('loading'));
        try {
            const popularData = await api.manager.getPopularArtists();
            const gridHTML = popularData.artists && popularData.artists.length > 0 ? popularData.artists.map((artist, index) => ui.manager.renderMusicCard(artist, index, index + 1)).join('') : `<p class="search-message">${t('couldNotLoadSection')}</p>`;
            ui.manager.dom.homeContainer.innerHTML = `<h2 class="section-title-main">${t('topArtists')}</h2><div class="music-grid horizontal-music-grid">${gridHTML}</div>`;
        } catch (e) {
            ui.manager.dom.homeContainer.innerHTML = `<h2 class="section-title-main">${t('topArtists')}</h2><p class="search-message">${t('couldNotLoadSection')}</p>`;
        }
    }

    async function renderArtistView(artistId) {
        state.artistContextId = null; 
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader(t('loadingArtist'));
        try {
            const artist = await api.manager.getSpotifyArtist(artistId);
            const [albumsData, bioData] = await Promise.all([api.manager.getSpotifyArtistAlbums(artistId), api.manager.getArtistBio(artist.name)]);
            const isFollowing = state.currentUser ? auth.manager.isFollowing(artistId) : false;
            const followBtnHTML = state.currentUser 
                ? `<button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-id="${artist.id}"><i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i><span>${isFollowing ? t('following') : t('follow')}</span></button>` 
                : `<button class="follow-btn" disabled>${t('loginToFollow')}</button>`;
            const discographyHTML = albumsData?.items?.length > 0 ? `<div class="music-grid horizontal-music-grid">${albumsData.items.map((album, index) => ui.manager.renderMusicCard({ ...album, type: 'album' }, index)).join('')}</div>` : `<p class="search-message">${t('noAlbumsFound')}</p>`;
            let metaInfo = artist.genres.join(', ');
            if (bioData.origin) metaInfo += ` &bull; ${bioData.origin}`;
            ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="details-header"><div class="details-img band-img"><img src="${artist.images[0]?.url || 'https://via.placeholder.com/200'}" alt="${artist.name}"></div><div class="details-info"><h2>${artist.name}</h2><p class="meta-info">${metaInfo}</p>${followBtnHTML}</div></div><div class="artist-bio-container"><h3 class="section-title-main">${t('biography')}</h3><p class="artist-bio">${bioData.bio || t('noBioAvailable')}</p></div><h3 class="section-title-main">${t('discography')}</h3>${discographyHTML}`;
        } catch (e) {
            ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><p class="search-message">${t('couldNotLoadArtist', e.message)}</p>`;
        }
    }

    async function renderAlbumView(albumId) {
        ui.manager.switchContent('details-view');
        ui.manager.dom.detailsView.innerHTML = ui.manager.renderLoader(t('loadingAlbum'));
        try {
            const album = await api.manager.getSpotifyAlbum(albumId);
            if (album.artists && album.artists[0]) state.artistContextId = album.artists[0].id; 
            const tracksHTML = album.tracks.items.map((track, index) => `<li><span class="track-number">${index + 1}.</span><span class="track-name">${track.name}</span><span class="track-duration">${new Date(track.duration_ms).toISOString().substr(14, 5)}</span></li>`).join('');
            ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="details-header album-details-header"><div class="details-img album-img"><img src="${album.images[0]?.url || 'https://via.placeholder.com/200'}" alt="${album.name}"></div><div class="details-info"><h2>${album.name}</h2><p class="meta-info">${album.artists.map(a => `<span class="artist-link" data-id="${a.id}">${a.name}</span>`).join(', ')} &bull; ${new Date(album.release_date).getFullYear()}</p></div></div><div class="album-content-layout"><div class="track-list-container"><h3 class="section-title-main">${t('tracks')}</h3><ol class="track-list">${tracksHTML}</ol></div><div class="spotify-embed-container"><h3 class="section-title-main">${t('listenOnSpotify')}</h3><iframe style="border-radius:12px" src="https://open.spotify.com/embed/album/${album.id}?utm_source=generator" width="100%" height="540" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div></div>`;
        } catch (e) {
             ui.manager.dom.detailsView.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><p class="search-message">${t('couldNotLoadAlbum', e.message)}</p>`;
        }
    }

    function renderProfilePage() { 
        if (!state.currentUser) { ui.manager.switchContent('inicio'); ui.manager.openModal(ui.manager.dom.loginModal); return; }
        ui.manager.switchContent('profile');
        const u = state.currentUser;
        let avatarHTML = u.avatar ? `<img src="${u.avatar}" alt="User Avatar" class="profile-picture">` : `<div class="profile-avatar-large-placeholder" style="background-color:${ui.manager.getAvatarColor(u.name)}">${u.name.charAt(0).toUpperCase()}</div>`;
        let badgesHTML = '';
        if (u.badges && u.badges.length > 0) {
            [...new Set(u.badges)].forEach(badgeKey => {
                if (badgeMap[badgeKey]) badgesHTML += `<img src="${badgeMap[badgeKey].src}" alt="${t(badgeMap[badgeKey].titleKey)}" class="badge-icon" data-badge-key="${badgeKey}">`;
            });
        }
        const descriptionHTML = `<div class="profile-description-container" id="profile-description-container">
            <p class="profile-description">${u.description || t('noDescription')}</p>
            <button class="edit-description-btn" title="${t('editDescription')}"><i class="fas fa-pencil-alt"></i></button>
        </div>`;
        
        const followCount = u.following?.length || 0;
        const followLimit = getFollowLimit(u);
        const percentage = (followCount / followLimit) * 100;
        const followTrackerHTML = `
            <div class="follow-limit-tracker">
                <h3>${t('followLimitTitle')}</h3>
                <div class="progress-info">
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
                    </div>
                    <span class="limit-text">${followCount} / ${followLimit}</span>
                </div>
            </div>`;

        ui.manager.dom.profileContainer.innerHTML = `
            <div class="profile-header-main">
                <div class="profile-avatar-large">${avatarHTML}</div>
                <div class="profile-info-main">
                    <h2>${u.name}</h2>
                    <div class="user-badges">${badgesHTML}</div>
                </div>
            </div>
            ${descriptionHTML}
            ${followTrackerHTML}
            <h2 class="section-title-main">${t('artistsYouFollow')}</h2>
            <div class="music-grid" id="followed-artists-grid"></div>`;
        ui.manager.populateGrid(document.getElementById('followed-artists-grid'), u.following?.map(a => ({...a, type: 'artist'})), (item, index) => ui.manager.renderMusicCard(item, index), t('emptyFollowedArtists'));
    }

    function renderSocialPage() {
        if (!state.currentUser) { ui.manager.switchContent('inicio'); ui.manager.openModal(ui.manager.dom.loginModal); return; }
        ui.manager.switchContent('social');
        const u = state.currentUser;
        let friendRequestsHTML = '';
        if (u.friendRequestsReceived && u.friendRequestsReceived.length > 0) {
            friendRequestsHTML = `<h2 class="section-title-main">${t('friendRequests')}</h2><div class="friend-requests-list">` +
            u.friendRequestsReceived.map(name => `<div class="friend-request-item"><span><strong class="user-link" data-username="${name}">${name}</strong> ${t('wantsToBeYourFriend', '')}</span><div class="friend-request-actions"><button class="btn-friend-action accept" data-action="accept" data-target-name="${name}"><i class="fas fa-check"></i> ${t('accept')}</button><button class="btn-friend-action reject" data-action="reject" data-target-name="${name}"><i class="fas fa-times"></i> ${t('decline')}</button></div></div>`).join('') + `</div>`;
        }
        ui.manager.dom.socialContainer.innerHTML = `${friendRequestsHTML}<h2 class="section-title-main">${t('yourFriends')}</h2><div class="user-grid" id="friends-grid"></div>`;
        ui.manager.populateGrid(document.getElementById('friends-grid'), u.friends?.map(name => ({name})), (item, index) => ui.manager.renderUserCard(item, index), t('emptyFriends'));
    }
    
    async function renderPublicProfileView(userName) {
        if (state.currentUser && userName === state.currentUser.name) return renderProfilePage();
        ui.manager.switchContent('profile');
        ui.manager.dom.profileContainer.innerHTML = ui.manager.renderLoader(t('loadingProfile', userName));
        try {
            const u = await api.manager.fetchPublicProfile(userName);
            let avatarHTML = u.avatar ? `<img src="${u.avatar}" alt="User Avatar" class="profile-picture">` : `<div class="profile-avatar-large-placeholder" style="background-color:${ui.manager.getAvatarColor(u.name)}">${u.name.charAt(0).toUpperCase()}</div>`;
            let badgesHTML = '';
            if (u.badges && u.badges.length > 0) {
                [...new Set(u.badges)].forEach(badgeKey => {
                    if (badgeMap[badgeKey]) badgesHTML += `<img src="${badgeMap[badgeKey].src}" alt="${t(badgeMap[badgeKey].titleKey)}" class="badge-icon" data-badge-key="${badgeKey}">`;
                });
            }
            let friendStatusHTML = '';
            if (state.currentUser) {
                if (state.currentUser.friends?.includes(u.name)) friendStatusHTML = `<button class="btn-friend-action remove" data-action="remove" data-target-name="${u.name}"><i class="fas fa-user-minus"></i> ${t('removeFriend')}</button>`;
                else if (state.currentUser.friendRequestsSent?.includes(u.name)) friendStatusHTML = `<button class="btn-friend-action" disabled><i class="fas fa-paper-plane"></i> ${t('requestSent')}</button>`;
                else if (state.currentUser.friendRequestsReceived?.includes(u.name)) friendStatusHTML = `<div class="friend-request-actions public-profile"><span>${t('sentYouRequest')}</span><button class="btn-friend-action accept" data-action="accept" data-target-name="${u.name}"><i class="fas fa-check"></i></button><button class="btn-friend-action reject" data-action="reject" data-target-name="${u.name}"><i class="fas fa-times"></i></button></div>`;
                else friendStatusHTML = `<button class="btn-friend-action" data-action="request" data-target-name="${u.name}"><i class="fas fa-user-plus"></i> ${t('addFriend')}</button>`;
            }
            const descriptionHTML = u.description ? `<div class="profile-description-container"><p class="profile-description">${u.description}</p></div>` : '';

            ui.manager.dom.profileContainer.innerHTML = `
                <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
                <div class="profile-header-main">
                    <div class="profile-avatar-large">${avatarHTML}</div>
                    <div class="profile-info-main">
                        <h2>${u.name}</h2>
                        <div class="user-badges">${badgesHTML}</div>
                        <div class="friend-status-container">${friendStatusHTML}</div>
                    </div>
                </div>
                ${descriptionHTML}
                <div class="profile-tabs">
                    <button class="tab-link active" data-tab="artists">${t('followingCount', u.following?.length || 0)}</button>
                    <button class="tab-link" data-tab="friends">${t('friendsCount', u.friends?.length || 0)}</button>
                </div>
                <div id="artists" class="tab-content active"><div class="music-grid"></div></div>
                <div id="friends" class="tab-content"><div class="user-grid"></div></div>`;
            ui.manager.populateGrid(document.querySelector('#artists .music-grid'), u.following?.map(a => ({...a, type: 'artist'})), (item, index) => ui.manager.renderMusicCard(item, index), t('isNotFollowing', u.name));
            ui.manager.populateGrid(document.querySelector('#friends .user-grid'), u.friends?.map(name => ({name})), (item, index) => ui.manager.renderUserCard(item, index), t('hasNoFriends', u.name));
        } catch(e) {
            ui.manager.dom.profileContainer.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><p class="search-message">${t('couldNotLoadProfile', e.message)}</p>`;
        }
    }
    
    async function handleLoginSubmit(e) {
        const btn = e.target, modal = ui.manager.dom.loginModal;
        ui.manager.clearModalMessages(modal); btn.disabled = true; btn.textContent = t('loggingIn');
        try {
            await auth.manager.login(modal.querySelector('#loginEmail').value, modal.querySelector('#loginPassword').value);
            ui.manager.closeAllModals(); ui.manager.updateForAuthState(); renderHomePage();
        } catch (error) { ui.manager.showModalError(modal, error.message); } 
        finally { btn.disabled = false; btn.textContent = t('login'); }
    }
    
    async function handleRegisterSubmit(e) {
        const btn = e.target, modal = ui.manager.dom.registerModal;
        ui.manager.clearModalMessages(modal);
        const name = modal.querySelector('#registerName').value, email = modal.querySelector('#registerEmail').value, password = modal.querySelector('#registerPassword').value;
        if (!name || !email || !password) return ui.manager.showModalError(modal, t('allFieldsRequired'));
        if (name.trim().length <= 4) return ui.manager.showModalError(modal, t('nameLengthError'));
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) return ui.manager.showModalError(modal, t('nameCharsError'));
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ui.manager.showModalError(modal, t('invalidEmailError'));
        if (password.length <= 4) return ui.manager.showModalError(modal, t('passwordLengthError'));
        btn.disabled = true; btn.textContent = t('creating');
        try {
            await auth.manager.register(name, email, password);
            ui.manager.closeAllModals(); ui.manager.updateForAuthState(); renderHomePage();
        } catch (error) { ui.manager.showModalError(modal, error.message); } 
        finally { btn.disabled = false; btn.textContent = t('createAccount'); }
    }

    async function handleNameChangeSubmit(e) {
        const btn = e.target, modal = ui.manager.dom.nameChangeModal;
        const newName = modal.querySelector('#newNameInput').value.trim();
        if (newName.length <= 4) return ui.manager.showModalError(modal, t('nameLengthError'));
        if (!/^[a-zA-Z0-9_-]+$/.test(newName)) return ui.manager.showModalError(modal, t('nameCharsError'));
        btn.disabled = true; btn.textContent = t('saving');
        try {
            state.currentUser = await api.manager.updateUser({ name: newName });
            ui.manager.updateForAuthState(); ui.manager.closeAllModals();
        } catch (error) { ui.manager.showModalError(modal, error.message); } 
        finally { btn.disabled = false; btn.textContent = t('save'); }
    }
    
    async function handleAvatarSave() {
        const modal = ui.manager.dom.avatarChangeModal;
        const previewImage = document.getElementById('avatarPreviewImage');
        if (!previewImage.src || previewImage.src.endsWith('/')) {
            ui.manager.closeAllModals();
            return;
        }

        const btn = modal.querySelector('#saveAvatarBtn');
        btn.disabled = true; btn.textContent = t('saving');

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = async () => {
                ctx.drawImage(img, 0, 0, 256, 256);
                const avatarBase64 = canvas.toDataURL('image/png');
                state.currentUser = await api.manager.updateUser({ avatar: avatarBase64 });
                ui.manager.updateForAuthState();
                ui.manager.closeAllModals();
            };
            img.onerror = () => {
                ui.manager.showModalError(modal, "Failed to load image for saving.");
                btn.disabled = false; btn.textContent = t('saveAndClose');
            };
            img.src = previewImage.src;
        } catch (error) {
            ui.manager.showModalError(modal, error.message);
            btn.disabled = false; btn.textContent = t('saveAndClose');
        }
    }

    async function handleAvatarRemove() {
        const modal = ui.manager.dom.avatarChangeModal, btn = modal.querySelector('#removeAvatarBtn');
        btn.disabled = true;
        try {
            state.currentUser = await api.manager.updateUser({ avatar: null });
            ui.manager.updateForAuthState(); ui.manager.closeAllModals();
        } catch (error) { ui.manager.showModalError(modal, error.message); } 
        finally { btn.disabled = false; }
    }

    function handleAvatarChange(event) {
        const file = event.target.files[0], modal = ui.manager.dom.avatarChangeModal;
        ui.manager.clearModalMessages(modal);
        if (!file) return;
        if (!file.type.startsWith('image/')) return ui.manager.showModalError(modal, t('errorFileInvalid'));
        if (file.size > 2 * 1024 * 1024) return ui.manager.showModalError(modal, t('errorFileTooLarge'));
        
        const previewImage = document.getElementById('avatarPreviewImage');
        const reader = new FileReader();
        
        reader.onload = e => {
            document.getElementById('video-container').style.display = 'none';
            document.querySelector('.avatar-preview-container').style.display = 'flex';
            previewImage.src = e.target.result;
            previewImage.style.opacity = 1;
        };
        reader.readAsDataURL(file);
    }
    
    async function startCamera() {
        const modal = document.getElementById('avatarChangeModal');
        const videoContainer = document.getElementById('video-container');
        const video = document.getElementById('videoStream');
        const previewContainer = document.querySelector('.avatar-preview-container');
        try {
            if (state.cameraStream) stopCamera();
            state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = state.cameraStream;
            videoContainer.style.display = 'block';
            previewContainer.style.display = 'none';
            modal.querySelector('#avatar-actions').style.display = 'none';
            modal.querySelector('#capture-actions').style.display = 'block';
        } catch (err) {
            ui.manager.showModalError(modal, `Camera error: ${err.name}`);
            stopCamera();
        }
    }

    function stopCamera() {
        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(track => track.stop());
            state.cameraStream = null;
        }
        const modal = document.getElementById('avatarChangeModal');
        modal.querySelector('#video-container').style.display = 'none';
        modal.querySelector('.avatar-preview-container').style.display = 'flex';
        modal.querySelector('#avatar-actions').style.display = 'block';
        modal.querySelector('#capture-actions').style.display = 'none';
    }

    function capturePhoto() {
        const video = document.getElementById('videoStream');
        const previewImage = document.getElementById('avatarPreviewImage');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // Flip the image horizontally to fix the mirror effect
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        stopCamera();
        
        previewImage.src = canvas.toDataURL('image/png');
        previewImage.style.opacity = 1;
    }

    async function handleFriendAction(e) {
        const btn = e.target.closest('.btn-friend-action');
        if (!btn || btn.disabled) return;
        const { action, targetName } = btn.dataset;
        btn.disabled = true;
        try {
            const { user } = await api.manager.manageFriend(targetName, action);
            state.currentUser = user;
            if (document.getElementById('social').classList.contains('active')) renderSocialPage();
            else {
                const profileHeader = document.querySelector('.profile-info-main h2');
                if (profileHeader && profileHeader.textContent === targetName) renderPublicProfileView(targetName);
            }
        } catch (error) { alert(`Error: ${error.message}`); btn.disabled = false; }
    }
    
    function setupEventListeners() {
        document.body.addEventListener('click', async e => {
            const badgeIcon = e.target.closest('.badge-icon');
            if (badgeIcon) {
                if (badgeIcon.closest('.user-profile-area')) return; 

                const tooltip = ui.manager.dom.badgeTooltip, badgeKey = badgeIcon.dataset.badgeKey, badgeInfo = badgeMap[badgeKey];
                if (!badgeInfo) return;
                if (tooltip.classList.contains('active') && tooltip.dataset.currentBadge === badgeKey) { tooltip.classList.remove('active'); return; }
                
                const badgeRect = badgeIcon.getBoundingClientRect();
                document.getElementById('badgeTooltipTitle').textContent = t(badgeInfo.titleKey);
                document.getElementById('badgeTooltipDesc').textContent = t(badgeInfo.descriptionKey);
                tooltip.classList.add('active');
                tooltip.dataset.currentBadge = badgeKey; 
                
                const tooltipRect = tooltip.getBoundingClientRect();
                let left = badgeRect.left + (badgeRect.width / 2) - (tooltipRect.width / 2);
                let top = badgeRect.bottom + 8;
                if (left < 8) left = 8;
                if (left + tooltipRect.width > window.innerWidth - 8) left = window.innerWidth - tooltipRect.width - 8;
                if (top + tooltipRect.height > window.innerHeight - 8) top = badgeRect.top - tooltipRect.height - 8;
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
            } else if (!e.target.closest('.badge-tooltip')) {
                ui.manager.dom.badgeTooltip.classList.remove('active');
                delete ui.manager.dom.badgeTooltip.dataset.currentBadge;
            }

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
            
            const userCard = e.target.closest('.user-card[data-username]');
            if (userCard) return renderPublicProfileView(userCard.dataset.username);
            
            const userLink = e.target.closest('.user-link[data-username]');
            if (userLink) return renderPublicProfileView(userLink.dataset.username);

            const followBtn = e.target.closest('.follow-btn:not(:disabled)');
            if (followBtn) { 
                try {
                    const artist = await api.manager.getSpotifyArtist(followBtn.dataset.artistId); 
                    const isFollowing = await auth.manager.toggleFollow(artist);
                    followBtn.classList.toggle('following', isFollowing);
                    followBtn.querySelector('span').textContent = isFollowing ? t('following') : t('follow');
                    followBtn.querySelector('i').className = `fas ${isFollowing ? 'fa-check' : 'fa-plus'}`;
                } catch (error) { alert(error.message); }
            }

            const editDescBtn = e.target.closest('.edit-description-btn');
            if (editDescBtn) {
                const container = document.getElementById('profile-description-container');
                const currentDesc = state.currentUser.description || '';
                const editorHTML = `
                    <div class="description-editor">
                        <textarea id="description-textarea" maxlength="200" placeholder="${t('noDescription')}">${currentDesc}</textarea>
                        <div class="char-counter" id="char-counter">${t('descriptionCharCount', currentDesc.length)}</div>
                        <div class="editor-actions">
                            <button class="btn-secondary cancel-desc-btn">${t('cancelEdit')}</button>
                            <button class="btn-primary save-desc-btn">${t('saveDescription')}</button>
                        </div>
                    </div>`;
                container.innerHTML = editorHTML;
                document.getElementById('description-textarea').addEventListener('input', e => {
                    document.getElementById('char-counter').textContent = t('descriptionCharCount', e.target.value.length);
                });
            }

            if (e.target.closest('.cancel-desc-btn')) renderProfilePage();
            
            if (e.target.closest('.save-desc-btn')) {
                const newDesc = document.getElementById('description-textarea').value.trim();
                try {
                    state.currentUser = await api.manager.updateUser({ description: newDesc });
                    renderProfilePage();
                } catch (err) {
                    alert('Failed to save description.');
                    renderProfilePage();
                }
            }

            handleFriendAction(e);

            const tabLink = e.target.closest('.tab-link');
            if(tabLink) {
                document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tabLink.classList.add('active');
                document.getElementById(tabLink.dataset.tab).classList.add('active');
            }
            
            if (e.target.closest('.back-btn')) {
                if (document.getElementById('details-view').classList.contains('active') && state.artistContextId) {
                    const artistIdToReturnTo = state.artistContextId;
                    state.artistContextId = null;
                    return renderArtistView(artistIdToReturnTo);
                }
                const cameFromProfile = document.getElementById('profile').contains(e.target);
                if (cameFromProfile && state.lastView === 'social') return renderSocialPage();
                return ui.manager.switchContent(state.lastView);
            }

            if (e.target.closest('#switchToRegister')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.registerModal); }
            if (e.target.closest('#switchToLogin')) { ui.manager.closeAllModals(); ui.manager.openModal(ui.manager.dom.loginModal); }
            if (e.target.closest('.close-modal-btn') || e.target.matches('.modal-overlay') || e.target.closest('#cancelNameChangeBtn')) ui.manager.closeAllModals();

            const passToggle = e.target.closest('.password-toggle');
            if (passToggle) {
                const input = passToggle.previousElementSibling;
                input.type = input.type === 'password' ? 'text' : 'password';
                passToggle.className = `fas ${input.type === 'password' ? 'fa-eye' : 'fa-eye-slash'} password-toggle`;
            }
            
            if (e.target.closest('#loginPromptBtn')) ui.manager.openModal(ui.manager.dom.loginModal);
            if (e.target.closest('#changeNameBtn')) {
                const modal = ui.manager.dom.nameChangeModal;
                modal.querySelector('#newNameInput').value = state.currentUser?.name || '';
                ui.manager.openModal(modal);
            }
            if (e.target.closest('#changeAvatarBtn')) {
                const previewImage = document.getElementById('avatarPreviewImage');
                const userAvatar = state.currentUser.avatar;
                previewImage.src = userAvatar || "";
                previewImage.style.opacity = userAvatar ? 1 : 0;
                ui.manager.openModal(ui.manager.dom.avatarChangeModal);
            }
            if (e.target.closest('#uploadAvatarBtn')) document.getElementById('avatarFileInput').click();
            if (e.target.closest('#takePhotoBtn')) startCamera();
            if (e.target.closest('#captureBtn')) capturePhoto();
            if (e.target.closest('#removeAvatarBtn')) handleAvatarRemove();
            if (e.target.closest('#saveAvatarBtn')) handleAvatarSave();
        });
        
        ui.manager.dom.themeToggleBtn.addEventListener('click', () => ui.manager.applyTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light'));
        document.getElementById('loginSubmitBtn').addEventListener('click', handleLoginSubmit);
        document.getElementById('registerSubmitBtn').addEventListener('click', handleRegisterSubmit);
        document.getElementById('saveNameBtn').addEventListener('click', handleNameChangeSubmit);
        document.getElementById('avatarFileInput').addEventListener('change', handleAvatarChange);
        
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if (target === 'profile') renderProfilePage(); 
            else if (target === 'social') renderSocialPage();
            else renderHomePage();
        }));

        document.getElementById('logoutBtn').addEventListener('click', () => { auth.manager.logout(); ui.manager.updateForAuthState(); renderHomePage(); });
        
        let searchTimeout;
        ui.manager.dom.searchInput.addEventListener('input', e => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (!query) { if (document.getElementById('buscar').classList.contains('active')) renderHomePage(); return; }
            ui.manager.switchContent('buscar');
            ui.manager.dom.searchResultsContainer.innerHTML = ui.manager.renderLoader(t('loading'));
            searchTimeout = setTimeout(async () => {
                try {
                    const [spotifyResults, userResults] = await Promise.all([api.manager.searchSpotify(query, 'artist,album', 10), api.manager.searchUsers(query)]);
                    let html = '';
                    if (userResults && userResults.length > 0) html += `<h2 class="section-title-main">${t('users')}</h2><div class="user-grid">${userResults.map((u, i) => ui.manager.renderUserCard(u, i)).join('')}</div>`;
                    if (spotifyResults.artists?.items.length > 0) html += `<h2 class="section-title-main">${t('artists')}</h2><div class="music-grid">${spotifyResults.artists.items.map((item, i) => ui.manager.renderMusicCard(item, i)).join('')}</div>`;
                    if (spotifyResults.albums?.items.length > 0) html += `<h2 class="section-title-main">${t('albums')}</h2><div class="music-grid">${spotifyResults.albums.items.map((item, i) => ui.manager.renderMusicCard(item, i)).join('')}</div>`;
                    ui.manager.dom.searchResultsContainer.innerHTML = html || `<p class="search-message">${t('noResultsFound')}</p>`;
                } catch (error) {
                    console.error("Search Error:", error);
                    ui.manager.dom.searchResultsContainer.innerHTML = `<p class="search-message">${t('searchFailed')}</p>`;
                }
            }, 500);
        });
    }

    async function init() {
        try {
            translateUI();
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