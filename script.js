document.addEventListener('DOMContentLoaded', function() {
    // --- ELEMENTOS DO DOM ---
    const audioPlayer = document.getElementById('audioPlayer');
    const avatarUploadInput = document.getElementById('avatarUpload');
    const playerTitle = document.querySelector('.current-song .music-title');
    const playerArtist = document.querySelector('.current-song .music-artist');
    const playerImg = document.querySelector('.current-song .music-img img');
    const playBtn = document.querySelector('.play-btn');
    const timeCurrentEl = document.querySelector('.time-current');
    const timeTotalEl = document.querySelector('.time-total');
    const mainContent = document.querySelector('.main-content');
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const albumViewContainer = document.getElementById('album-view');
    const bandViewContainer = document.getElementById('band-view');
    const favoritesList = document.getElementById('favoritesList');
    const recentsList = document.getElementById('recentsList');
    const playerFavoriteBtn = document.getElementById('playerFavoriteBtn');
    const playerDislikeBtn = document.getElementById('playerDislikeBtn');
    const progressBar = document.querySelector('.progress-bar');
    const progressFill = document.querySelector('.progress-fill');
    const volumeBar = document.querySelector('.volume-bar');
    const volumeFill = document.querySelector('.volume-fill');
    const settingsBtn = document.getElementById('settingsBtn');
    const themePicker = document.getElementById('themePicker');
    const colorSwatches = document.querySelectorAll('.color-swatch');
    const userProfile = document.getElementById('userProfile');
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const speedBtn = document.getElementById('speedBtn');
    
    // --- BANCO DE DADOS E ESTADO ---
    const bandsData = {
        'Nirvana': { description: 'Nirvana foi uma banda de rock americana formada em Aberdeen, Washington, em 1987...', origin: 'Aberdeen, Washington, EUA' },
        'Megadeth': { description: 'Megadeth é uma banda americana de thrash metal de Los Angeles, Califórnia...', origin: 'Los Angeles, Califórnia, EUA' },
        'Mayhem': { description: 'Mayhem é uma banda norueguesa de black metal formada em 1984 em Oslo...', origin: 'Oslo, Noruega' },
        'Rove Braki': { description: 'Rove Braki é um artista emergente na cena do rap, conhecido por suas letras introspectivas...', origin: 'Brasil' }
    };
    let currentTrackData = {};
    let favorites = [], disliked = [], recents = [], allTracks = [], allAlbums = [];
    const speeds = [1, 1.25, 2, 0.5];
    let currentSpeedIndex = 0;

    // --- LÓGICA DO PLAYER REAL ---
    function playAudio() {
        if (!audioPlayer.src) return; // Não tenta tocar se não houver música carregada
        audioPlayer.play();
        playBtn.querySelector('i').className = 'fas fa-pause';
    }

    function pauseAudio() {
        audioPlayer.pause();
        playBtn.querySelector('i').className = 'fas fa-play';
    }

    function togglePlay() {
        if (audioPlayer.paused) {
            playAudio();
        } else {
            pauseAudio();
        }
    }

    function updatePlayer(trackData) {
        currentTrackData = trackData;
        playerTitle.textContent = trackData.title;
        playerArtist.textContent = trackData.artist;
        playerImg.src = trackData.img;
        
        audioPlayer.src = trackData.src;
        playAudio();

        updateActionButtons();
        addToRecents(trackData);
    }
    
    const formatTime = s => {
        if (isNaN(s)) return "0:00";
        const minutes = Math.floor(s / 60);
        const seconds = Math.floor(s % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    audioPlayer.addEventListener('loadedmetadata', () => {
        timeTotalEl.textContent = formatTime(audioPlayer.duration);
    });

    audioPlayer.addEventListener('timeupdate', () => {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = `${progressPercent}%`;
        timeCurrentEl.textContent = formatTime(audioPlayer.currentTime);
    });
    
    // --- LÓGICA DE TROCA DE FOTO DE PERFIL ---
    userAvatarEl.addEventListener('click', () => {
        avatarUploadInput.click(); // Abre o seletor de arquivos
    });
    
    avatarUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const imageUrl = event.target.result;
                localStorage.setItem('vianaUserAvatar', imageUrl); // Salva a imagem
                applyAvatar(imageUrl);
            }
            reader.readAsDataURL(file);
        }
    });

    function applyAvatar(imageUrl) {
        userAvatarEl.style.backgroundImage = `url(${imageUrl})`;
        userAvatarEl.textContent = ''; // Remove a letra
    }
    

    function setSongProgress(e) {
        const width = progressBar.clientWidth;
        const clickX = e.offsetX;
        audioPlayer.currentTime = (clickX / width) * audioPlayer.duration;
    }

    function setVolume(e) {
        const width = volumeBar.clientWidth;
        const clickX = e.offsetX;
        const volume = clickX / width;
        audioPlayer.volume = volume;
        volumeFill.style.width = `${volume * 100}%`;
    }
    
    function changeSpeed() {
        currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
        const newSpeed = speeds[currentSpeedIndex];
        audioPlayer.playbackRate = newSpeed;
        speedBtn.querySelector('span').textContent = `${newSpeed}x`;
    }


    // --- INICIALIZAÇÃO E CARREGAMENTO DE DADOS ---
    function fetchData() {
        allTracks = Array.from(document.querySelectorAll('#all-music-list .music-item')).map(item => item.dataset);
        allAlbums = Array.from(document.querySelectorAll('#inicio .music-card[data-is-album="true"]')).map(item => {
            const albumData = { ...item.dataset };
            albumData.cleanArtist = albumData.artist.split('•')[0].trim();
            return albumData;
        });
    }

    function loadState() {
        applyTheme(localStorage.getItem('vianaTheme') || '#E50914');
        updateUserName(localStorage.getItem('vianaUserName') || 'Arthur');
        favorites = JSON.parse(localStorage.getItem('vianaFavorites')) || [];
        disliked = JSON.parse(localStorage.getItem('vianaDisliked')) || [];
        recents = JSON.parse(localStorage.getItem('vianaRecents')) || [];
        
        const savedAvatar = localStorage.getItem('vianaUserAvatar');
        if (savedAvatar) {
            applyAvatar(savedAvatar);
        }

        updateActionButtons();
    }

    // --- UI: TEMA E USUÁRIO ---
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
    
    function updateUserName(name) {
        userNameEl.textContent = name;
        const savedAvatar = localStorage.getItem('vianaUserAvatar');
        if (!savedAvatar) { // Só atualiza a letra se não houver foto
            userAvatarEl.style.backgroundImage = 'none';
            userAvatarEl.textContent = name.charAt(0).toUpperCase();
        }
    }

    userNameEl.addEventListener('click', () => { // Mudou o listener para o nome
        const newName = prompt("Digite seu novo nome:", userNameEl.textContent);
        if (newName && newName.trim()) {
            updateUserName(newName);
            localStorage.setItem('vianaUserName', newName);
        }
    });

    // --- PREFERÊNCIAS: LIKE/DISLIKE ---
    function updateActionButtons() {
        if (!currentTrackData.title) return;
        const isFavorited = favorites.some(fav => fav.title === currentTrackData.title && fav.artist === currentTrackData.artist);
        const isDisliked = disliked.some(dis => dis.title === currentTrackData.title && dis.artist === currentTrackData.artist);
        playerFavoriteBtn.innerHTML = `<i class="${isFavorited ? 'fas' : 'far'} fa-heart"></i>`;
        playerDislikeBtn.innerHTML = `<i class="${isDisliked ? 'fas' : 'far'} fa-thumbs-down"></i>`;
    }
    playerFavoriteBtn.addEventListener('click', () => handlePreference(favorites, disliked));
    playerDislikeBtn.addEventListener('click', () => handlePreference(disliked, favorites));
    function handlePreference(primaryList, secondaryList) {
        if (!currentTrackData.title) return;
        const trackId = t => t.title === currentTrackData.title && t.artist === currentTrackData.artist;
        const index = primaryList.findIndex(trackId);
        if (index > -1) { primaryList.splice(index, 1); }
        else {
            primaryList.push(currentTrackData);
            const secondaryIndex = secondaryList.findIndex(trackId);
            if (secondaryIndex > -1) secondaryList.splice(secondaryIndex, 1);
        }
        localStorage.setItem('vianaFavorites', JSON.stringify(favorites));
        localStorage.setItem('vianaDisliked', JSON.stringify(disliked));
        updateActionButtons();
    }

    // --- LÓGICA DE RECENTES ---
    function addToRecents(trackData) {
        const existingIndex = recents.findIndex(t => t.title === trackData.title && t.artist === trackData.artist);
        if (existingIndex > -1) { recents.splice(existingIndex, 1); }
        recents.unshift(trackData);
        if (recents.length > 50) { recents.pop(); }
        localStorage.setItem('vianaRecents', JSON.stringify(recents));
    }

    // --- LISTENERS DE EVENTOS DO PLAYER ---
    progressBar.addEventListener('click', setSongProgress);
    volumeBar.addEventListener('click', setVolume);
    playBtn.addEventListener('click', togglePlay);
    speedBtn.addEventListener('click', changeSpeed);

    // --- NAVEGAÇÃO E RENDERIZAÇÃO DE CONTEÚDO ---
    function switchContent(targetId) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === targetId));
        if (targetId === 'favoritas') renderFavorites();
        if (targetId === 'recentes') renderRecents();
        document.querySelector('.main-container').classList.remove('sidebar-open');
    }
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchContent(item.dataset.target)));
    document.getElementById('menuBtn').addEventListener('click', () => document.querySelector('.main-container').classList.add('sidebar-open'));
    document.getElementById('closeSidebarBtn').addEventListener('click', () => document.querySelector('.main-container').classList.remove('sidebar-open'));

    // --- FILTRO DE CATEGORIA ---
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const category = tab.dataset.category;
            document.querySelectorAll('#inicio .music-card').forEach(card => {
                card.style.display = (category === 'Todos' || card.dataset.category === category) ? 'block' : 'none';
            });
        });
    });

    // --- BUSCA ---
    searchInput.addEventListener('input', e => {
        const query = e.target.value.toLowerCase().trim();
        if (query) {
            switchContent('buscar');
            const results = allTracks.filter(t => t.title.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query) || t.album.toLowerCase().includes(query));
            searchResultsContainer.innerHTML = results.length ? results.map((track, i) => createMusicItemHTML(track, i + 1)).join('') : '<p class="search-message">Nenhum resultado encontrado.</p>';
        } else {
            switchContent('inicio');
        }
    });

    // --- PÁGINAS DE BANDA E ÁLBUM ---
    function calculateBandRating(bandName) {
        const bandSongs = allTracks.filter(t => t.artist === bandName);
        let likes = 0, dislikes = 0;
        bandSongs.forEach(song => {
            if (favorites.some(fav => fav.title === song.title && fav.artist === song.artist)) likes++;
            if (disliked.some(dis => dis.title === song.title && dis.artist === song.artist)) dislikes++;
        });
        const totalVotes = likes + dislikes;
        if (totalVotes === 0) return { score: "Sem avaliação", votes: " " };
        const rating = (likes / totalVotes) * 5;
        return {
            score: `<i class="fas fa-star"></i> ${rating.toFixed(1)} / 5.0`,
            votes: `(${totalVotes} ${totalVotes > 1 ? 'votos' : 'voto'})`
        };
    }

    function renderBandView(bandData) {
        const bandName = bandData.artistName;
        const info = bandsData[bandName] || { description: "Nenhuma descrição disponível.", origin: "Origem desconhecida" };
        const rating = calculateBandRating(bandName);
        const bandAlbums = allAlbums.filter(a => a.cleanArtist === bandName);
        bandViewContainer.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="band-view-header"><div class="band-view-img"><img src="${bandData.img}" alt="${bandName}"></div><div class="band-view-info"><h2>${bandName}</h2><p class="origin">${info.origin}</p><p class="description">${info.description}</p><div class="band-rating"><div class="score">${rating.score}</div><div class="votes">${rating.votes}</div></div></div></div><h2 class="section-title-main">Álbuns</h2><div class="music-grid">${bandAlbums.length ? bandAlbums.map(createAlbumCardHTML).join('') : '<p class="search-message">Nenhum álbum encontrado.</p>'}</div>`;
        switchContent('band-view');
    }

    function renderAlbumView(albumData) {
        const albumSongs = allTracks.filter(t => t.album === albumData.title);
        albumViewContainer.innerHTML = `<button class="back-btn"><i class="fas fa-arrow-left"></i></button><div class="album-view-header"><div class="album-view-img"><img src="${albumData.img}" alt="${albumData.title}"></div><div class="album-view-info"><h2>${albumData.title}</h2><p>${albumData.artist}</p></div></div><div class="music-list">${albumSongs.length ? albumSongs.map((song, i) => createMusicItemHTML(song, i + 1)).join('') : '<p class="search-message">Nenhuma música encontrada.</p>'}</div>`;
        switchContent('album-view');
    }
    
    // --- HELPERS DE HTML E RENDERIZAÇÃO ---
    function createMusicItemHTML(track, number) { return `<div class="music-item" data-title="${track.title}" data-artist="${track.artist}" data-img="${track.img}" data-album="${track.album}" data-src="${track.src}"><div class="music-number">${number}</div><div class="music-img-small"><img src="${track.img}" alt="${track.title}"></div><div class="music-info"><div class="music-title">${track.title}</div><div class="music-artist">${track.artist}</div></div></div>`; }
    function createAlbumCardHTML(albumData) { return `<div class="music-card" data-is-album="true" data-category="${albumData.category}" data-title="${albumData.title}" data-artist="${albumData.artist}" data-img="${albumData.img}"><div class="music-img"><img src="${albumData.img}" alt="${albumData.title}"></div><div class="music-title">${albumData.title}</div><div class="music-artist">${albumData.artist}</div></div>`; }
    function renderFavorites() { favoritesList.innerHTML = favorites.length ? favorites.map((track, i) => createMusicItemHTML(track, i + 1)).join('') : '<p class="no-favorites-message">Você ainda não favoritou nenhuma música.</p>'; }
    function renderRecents() { recentsList.innerHTML = recents.length ? recents.map((track, i) => createMusicItemHTML(track, i + 1)).join('') : '<p class="no-recents-message">Você ainda não ouviu nenhuma música.</p>'; }

    // --- LISTENER DE CLIQUE PRINCIPAL ---
    mainContent.addEventListener('click', e => {
        const backBtn = e.target.closest('.back-btn');
        if (backBtn) { switchContent('inicio'); return; }
        const bandCard = e.target.closest('.music-card[data-is-band="true"]');
        if (bandCard) { renderBandView(bandCard.dataset); return; }
        const albumCard = e.target.closest('.music-card[data-is-album="true"]');
        if (albumCard) { renderAlbumView(albumCard.dataset); return; }
        const musicItem = e.target.closest('.music-item');
        if (musicItem) { updatePlayer(musicItem.dataset); return; }
    });

    // --- CHAMADAS INICIAIS ---
    fetchData();
    loadState();
});