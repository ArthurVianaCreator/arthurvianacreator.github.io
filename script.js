document.addEventListener('DOMContentLoaded', function() {
    // --- ELEMENTOS DO DOM ---
    const playerTitle = document.querySelector('.current-song .music-title');
    const playerArtist = document.querySelector('.current-song .music-artist');
    const playerImg = document.querySelector('.current-song .music-img img');
    const playBtn = document.querySelector('.play-btn');
    const progressFill = document.querySelector('.progress-fill');
    const timeCurrentEl = document.querySelector('.time-current');
    const timeTotalEl = document.querySelector('.time-total');
    const settingsBtn = document.getElementById('settingsBtn');
    const themePicker = document.getElementById('themePicker');
    const colorSwatches = document.querySelectorAll('.color-swatch');
    const userProfile = document.getElementById('userProfile');
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const playerFavoriteBtn = document.getElementById('playerFavoriteBtn');
    const favoritesList = document.getElementById('favoritesList');
    
    // --- ESTADO DO APLICATIVO ---
    let isPlaying = true;
    let progressInterval = null;
    let currentTrack = { title: "Smells Like Teen Spirit", artist: "Nirvana" }; // Faixa inicial
    let favorites = [];

    // --- CARREGAR ESTADO SALVO (LOCALSTORAGE) ---
    function loadState() {
        const savedTheme = localStorage.getItem('vianaTheme') || '#E50914';
        applyTheme(savedTheme);
        const savedName = localStorage.getItem('vianaUserName') || 'Arthur';
        updateUserName(savedName);
        favorites = JSON.parse(localStorage.getItem('vianaFavorites')) || [];
        updateFavoriteIcon();
    }

    // --- FUNCIONALIDADE DE TEMA ---
    function applyTheme(color) {
        document.documentElement.style.setProperty('--primary-color', color);
    }
    settingsBtn.addEventListener('click', () => themePicker.classList.toggle('active'));
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color;
            applyTheme(color);
            localStorage.setItem('vianaTheme', color);
            themePicker.classList.remove('active');
        });
    });

    // --- FUNCIONALIDADE DE NOME DE USUÁRIO ---
    function updateUserName(name) {
        userNameEl.textContent = name;
        userAvatarEl.textContent = name.charAt(0).toUpperCase();
    }
    userProfile.addEventListener('click', () => {
        const newName = prompt("Digite seu novo nome:", userNameEl.textContent);
        if (newName && newName.trim() !== "") {
            updateUserName(newName);
            localStorage.setItem('vianaUserName', newName);
        }
    });

    // --- FUNCIONALIDADE DE FAVORITOS ---
    function renderFavorites() {
        favoritesList.innerHTML = '';
        if (favorites.length === 0) {
            favoritesList.innerHTML = '<p class="no-favorites-message">Você ainda não favoritou nenhuma música.</p>';
            return;
        }
        favorites.forEach((track, index) => {
            const musicItemHTML = `
                <div class="music-item" data-title="${track.title}" data-artist="${track.artist}" data-img="${track.img}">
                    <div class="music-number">${index + 1}</div>
                    <div class="music-img-small"><img src="${track.img}" alt="${track.title}"></div>
                    <div class="music-info">
                        <div class="music-title">${track.title}</div>
                        <div class="music-artist">${track.artist}</div>
                    </div>
                </div>`;
            favoritesList.innerHTML += musicItemHTML;
        });
        document.querySelectorAll('#favoritesList .music-item').forEach(item => {
            item.addEventListener('click', function() {
                updatePlayer(this.dataset);
            });
        });
    }

    function updateFavoriteIcon() {
        // CORRIGIDO: Verifica por título E artista para evitar bugs.
        const isFavorited = favorites.some(fav => fav.title === currentTrack.title && fav.artist === currentTrack.artist);
        playerFavoriteBtn.innerHTML = `<i class="${isFavorited ? 'fas' : 'far'} fa-heart"></i>`;
    }

    playerFavoriteBtn.addEventListener('click', () => {
        // CORRIGIDO: Busca na lista de favoritos usando título E artista.
        const trackIndex = favorites.findIndex(fav => fav.title === currentTrack.title && fav.artist === currentTrack.artist);
        if (trackIndex > -1) {
            favorites.splice(trackIndex, 1);
        } else {
            favorites.push(currentTrack);
        }
        localStorage.setItem('vianaFavorites', JSON.stringify(favorites));
        updateFavoriteIcon();
    });

    // --- FUNÇÕES DO PLAYER ---
    function togglePlay() {
        isPlaying = !isPlaying;
        playBtn.querySelector('i').className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        if (isPlaying) simulatePlayback();
        else clearInterval(progressInterval);
    }

    function updatePlayer(trackData) {
        currentTrack = trackData;
        playerTitle.textContent = trackData.title;
        playerArtist.textContent = trackData.artist;
        playerImg.src = trackData.img;
        progressFill.style.width = '0%';
        if (!isPlaying) togglePlay();
        else simulatePlayback();
        updateFavoriteIcon();
    }

    function simulatePlayback() {
        clearInterval(progressInterval);
        const totalSeconds = 301;
        let currentSeconds = 0;
        updateTimeDisplay(currentSeconds, totalSeconds);
        progressInterval = setInterval(() => {
            if (isPlaying && currentSeconds < totalSeconds) {
                currentSeconds++;
                progressFill.style.width = `${(currentSeconds / totalSeconds) * 100}%`;
                updateTimeDisplay(currentSeconds, totalSeconds);
            } else if (currentSeconds >= totalSeconds) {
                clearInterval(progressInterval);
                isPlaying = false;
                playBtn.querySelector('i').className = 'fas fa-play';
            }
        }, 1000);
    }
    
    function updateTimeDisplay(current, total) {
        const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
        timeCurrentEl.textContent = formatTime(current);
        timeTotalEl.textContent = formatTime(total);
    }

    // --- EVENTOS GERAIS ---
    playBtn.addEventListener('click', togglePlay);
    document.querySelectorAll('.music-card, .music-item').forEach(card => {
        card.addEventListener('click', function() {
            updatePlayer(this.dataset);
        });
    });

    // --- NAVEGAÇÃO E FILTRO ---
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    const categoryTabs = document.querySelectorAll('.category-tab');
    const musicCards = document.querySelectorAll('.music-card');
    const mainContainer = document.querySelector('.main-container');
    const menuBtn = document.getElementById('menuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');

    menuBtn.addEventListener('click', () => mainContainer.classList.add('sidebar-open'));
    closeSidebarBtn.addEventListener('click', () => mainContainer.classList.remove('sidebar-open'));

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            contentSections.forEach(section => {
                section.classList.toggle('active', section.id === target);
            });
            // CORRIGIDO: Garante que a lista de favoritos é renderizada ao clicar na aba.
            if (target === 'favoritas') {
                renderFavorites();
            }
            mainContainer.classList.remove('sidebar-open');
        });
    });

    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const category = tab.getAttribute('data-category');
            musicCards.forEach(card => {
                card.style.display = (category === 'Todos' || card.getAttribute('data-category') === category) ? 'block' : 'none';
            });
        });
    });

    // --- INICIALIZAÇÃO ---
    loadState();
    simulatePlayback();
});