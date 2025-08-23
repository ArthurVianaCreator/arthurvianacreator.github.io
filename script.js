document.addEventListener('DOMContentLoaded', function() {
    // --- ELEMENTOS DO DOM ---
    const playerTitle = document.querySelector('.current-song .music-title');
    const playerArtist = document.querySelector('.current-song .music-artist');
    const playerImg = document.querySelector('.current-song .music-img img');
    const playBtn = document.querySelector('.play-btn');
    const timeCurrentEl = document.querySelector('.time-current');
    const timeTotalEl = document.querySelector('.time-total');
    const settingsBtn = document.getElementById('settingsBtn');
    const themePicker = document.getElementById('themePicker');
    const colorSwatches = document.querySelectorAll('.color-swatch');
    const userProfile = document.getElementById('userProfile');
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const playerFavoriteBtn = document.getElementById('playerFavoriteBtn');
    const playerDislikeBtn = document.getElementById('playerDislikeBtn');
    const favoritesList = document.getElementById('favoritesList');
    const mainContent = document.querySelector('.main-content');
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const albumViewContainer = document.getElementById('album-view');

    // Player Controls
    const progressBar = document.querySelector('.progress-bar');
    const progressFill = document.querySelector('.progress-fill');
    const volumeBar = document.querySelector('.volume-bar');
    const volumeFill = document.querySelector('.volume-fill');
    
    // --- ESTADO DO APLICATIVO ---
    let isPlaying = true;
    let progressInterval = null;
    let currentSeconds = 0;
    let totalSeconds = 301;
    let currentTrack = { title: "Smells Like Teen Spirit", artist: "Nirvana", img: "img/NirvanaNevermindalbumcover.jpg", duration: "5:01", album: "Nevermind" };
    let favorites = [];
    let disliked = [];
    let allTracks = [];

    // --- CARREGAR DADOS E ESTADO ---
    function fetchAllTracks() {
        const tracks = new Map();
        document.querySelectorAll('.music-item').forEach(item => {
            const trackData = item.dataset;
            const trackId = `${trackData.title}-${trackData.artist}`;
            if (!tracks.has(trackId)) {
                tracks.set(trackId, {
                    title: trackData.title,
                    artist: trackData.artist,
                    img: trackData.img,
                    duration: trackData.duration || '0:00',
                    album: trackData.album
                });
            }
        });
        allTracks = Array.from(tracks.values());
    }

    function loadState() {
        const savedTheme = localStorage.getItem('vianaTheme') || '#E50914';
        applyTheme(savedTheme);
        const savedName = localStorage.getItem('vianaUserName') || 'Arthur';
        updateUserName(savedName);
        favorites = JSON.parse(localStorage.getItem('vianaFavorites')) || [];
        disliked = JSON.parse(localStorage.getItem('vianaDisliked')) || [];
        updateActionButtons();
    }

    // --- FUNCIONALIDADE DE TEMA ---
    function applyTheme(color) { document.documentElement.style.setProperty('--primary-color', color); }
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

    // --- FUNCIONALIDADE DE FAVORITOS E DISLIKES ---
    function renderFavorites() {
        favoritesList.innerHTML = '';
        if (favorites.length === 0) {
            favoritesList.innerHTML = '<p class="no-favorites-message">Você ainda não favoritou nenhuma música.</p>';
            return;
        }
        favorites.forEach((track, index) => {
            favoritesList.innerHTML += createMusicItemHTML(track, index + 1);
        });
    }

    function updateActionButtons() {
        const isFavorited = favorites.some(fav => fav.title === currentTrack.title && fav.artist === currentTrack.artist);
        const isDisliked = disliked.some(dis => dis.title === currentTrack.title && dis.artist === currentTrack.artist);
        playerFavoriteBtn.innerHTML = `<i class="${isFavorited ? 'fas' : 'far'} fa-heart"></i>`;
        playerDislikeBtn.innerHTML = `<i class="${isDisliked ? 'fas' : 'far'} fa-thumbs-down"></i>`;
    }

    playerFavoriteBtn.addEventListener('click', () => {
        handlePreference(favorites, disliked);
    });

    playerDislikeBtn.addEventListener('click', () => {
        handlePreference(disliked, favorites);
    });
    
    function handlePreference(primaryList, secondaryList) {
        const trackIdentifier = (t) => t.title === currentTrack.title && t.artist === currentTrack.artist;
        const trackIndex = primaryList.findIndex(trackIdentifier);

        if (trackIndex > -1) {
            primaryList.splice(trackIndex, 1);
        } else {
            primaryList.push(currentTrack);
            const secondaryIndex = secondaryList.findIndex(trackIdentifier);
            if (secondaryIndex > -1) secondaryList.splice(secondaryIndex, 1);
        }
        localStorage.setItem('vianaFavorites', JSON.stringify(favorites));
        localStorage.setItem('vianaDisliked', JSON.stringify(disliked));
        updateActionButtons();
    }


    // --- FUNÇÕES DO PLAYER ---
    function togglePlay() {
        isPlaying = !isPlaying;
        playBtn.querySelector('i').className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        if (isPlaying) {
            simulatePlayback();
        } else {
            clearInterval(progressInterval);
        }
    }

    function updatePlayer(trackData) {
        currentTrack = trackData;
        playerTitle.textContent = trackData.title;
        playerArtist.textContent = trackData.artist;
        playerImg.src = trackData.img;

        const [min, sec] = (trackData.duration || "0:0").split(':').map(Number);
        totalSeconds = (min * 60) + sec;
        currentSeconds = 0;

        progressFill.style.width = '0%';
        updateTimeDisplay();
        
        if (!isPlaying) {
            togglePlay();
        } else {
            simulatePlayback();
        }
        updateActionButtons();
    }

    function simulatePlayback() {
        clearInterval(progressInterval);
        if (!isPlaying) return;

        progressInterval = setInterval(() => {
            if (currentSeconds < totalSeconds) {
                currentSeconds++;
                updateTimeDisplay();
            } else {
                clearInterval(progressInterval);
                isPlaying = false;
                playBtn.querySelector('i').className = 'fas fa-play';
            }
        }, 1000);
    }
    
    function updateTimeDisplay() {
        const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
        timeCurrentEl.textContent = formatTime(currentSeconds);
        timeTotalEl.textContent = formatTime(totalSeconds);
        progressFill.style.width = `${(currentSeconds / totalSeconds) * 100}%`;
    }

    // --- CONTROLES INTERATIVOS (VOLUME E PROGRESSO) ---
    function setSongProgress(e) {
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const percentage = clickX / width;
        currentSeconds = Math.floor(totalSeconds * percentage);
        updateTimeDisplay();
        simulatePlayback();
    }
    
    function setVolume(e) {
        const rect = volumeBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        let percentage = (clickX / width) * 100;
        if (percentage < 0) percentage = 0;
        if (percentage > 100) percentage = 100;
        volumeFill.style.width = `${percentage}%`;
    }

    progressBar.addEventListener('click', setSongProgress);
    volumeBar.addEventListener('click', setVolume);

    // --- EVENTOS GERAIS E NAVEGAÇÃO ---
    playBtn.addEventListener('click', togglePlay);
    mainContent.addEventListener('click', function(e) {
        const clickedItem = e.target.closest('.music-item');
        if (clickedItem) {
            updatePlayer(clickedItem.dataset);
            return;
        }

        const clickedAlbum = e.target.closest('.music-card[data-is-album="true"]');
        if (clickedAlbum) {
            renderAlbumView(clickedAlbum.dataset);
            return;
        }

        const clickedArtist = e.target.closest('.music-card:not([data-is-album="true"])');
        if (clickedArtist) {
            updatePlayer(clickedArtist.dataset);
        }
    });

    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    const mainContainer = document.querySelector('.main-container');
    const menuBtn = document.getElementById('menuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');

    menuBtn.addEventListener('click', () => mainContainer.classList.add('sidebar-open'));
    closeSidebarBtn.addEventListener('click', () => mainContainer.classList.remove('sidebar-open'));

    function switchContent(targetId) {
        contentSections.forEach(section => {
            section.classList.toggle('active', section.id === targetId);
        });
        navItems.forEach(nav => {
            nav.classList.toggle('active', nav.dataset.target === targetId);
        });
        if (targetId === 'favoritas') {
            renderFavorites();
        }
        mainContainer.classList.remove('sidebar-open');
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => switchContent(item.dataset.target));
    });

    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const category = tab.getAttribute('data-category');
            document.querySelectorAll('.music-card').forEach(card => {
                card.style.display = (category === 'Todos' || card.getAttribute('data-category') === category) ? 'block' : 'none';
            });
        });
    });

    // --- FUNCIONALIDADE DE BUSCA ---
    function renderSearchResults(results) {
        searchResultsContainer.innerHTML = '';
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<p class="search-message">Nenhum resultado encontrado.</p>';
            return;
        }
        results.forEach((track, index) => {
            searchResultsContainer.innerHTML += createMusicItemHTML(track, index + 1);
        });
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query) {
            switchContent('buscar');
            const results = allTracks.filter(track => 
                track.title.toLowerCase().includes(query) || 
                track.artist.toLowerCase().includes(query) ||
                track.album.toLowerCase().includes(query)
            );
            renderSearchResults(results);
        } else {
            switchContent('inicio');
        }
    });
    
    // --- VISUALIZAÇÃO DE ÁLBUM ---
    function renderAlbumView(albumData) {
        const albumTitle = albumData.title;
        const albumSongs = allTracks.filter(track => track.album === albumTitle);
        
        let albumHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="album-view-header">
                <div class="album-view-img">
                    <img src="${albumData.img}" alt="${albumTitle}">
                </div>
                <div class="album-view-info">
                    <h2>${albumTitle}</h2>
                    <p>${albumData.artist}</p>
                </div>
            </div>
            <div class="music-list">
        `;

        if (albumSongs.length > 0) {
            albumSongs.forEach((song, index) => {
                albumHTML += createMusicItemHTML(song, index + 1);
            });
        } else {
            albumHTML += '<p class="search-message">Nenhuma música encontrada para este álbum.</p>';
        }

        albumHTML += '</div>';
        albumViewContainer.innerHTML = albumHTML;
        
        albumViewContainer.querySelector('.back-btn').addEventListener('click', () => switchContent('inicio'));

        switchContent('album-view');
    }
    
    function createMusicItemHTML(track, number) {
        return `
            <div class="music-item" data-title="${track.title}" data-artist="${track.artist}" data-img="${track.img}" data-duration="${track.duration}" data-album="${track.album}">
                <div class="music-number">${number}</div>
                <div class="music-img-small"><img src="${track.img}" alt="${track.title}"></div>
                <div class="music-info">
                    <div class="music-title">${track.title}</div>
                    <div class="music-artist">${track.artist}</div>
                </div>
                <div class="music-duration">${track.duration}</div>
            </div>`;
    }


    // --- INICIALIZAÇÃO ---
    fetchAllTracks();
    loadState();
    simulatePlayback();
});