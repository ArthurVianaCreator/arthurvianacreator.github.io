document.addEventListener('DOMContentLoaded', function() {
    // --- DOM ELEMENTS ---
    const mainContent = document.querySelector('.main-content');
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const detailsViewContainer = document.getElementById('details-view');
    const followedArtistsGrid = document.getElementById('followed-artists-grid');
    const discoverArtistsGrid = document.getElementById('discover-artists-grid');
    const discoverAlbumsGrid = document.getElementById('discover-albums-grid');
    const settingsBtn = document.getElementById('settingsBtn');
    const themePicker = document.getElementById('themePicker');
    const colorSwatches = document.querySelectorAll('.color-swatch');
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const userProfile = document.getElementById('userProfile');
    // Modal Elements
    const nameChangeModal = document.getElementById('nameChangeModal');
    const newNameInput = document.getElementById('newNameInput');
    const saveNameBtn = document.getElementById('saveNameBtn');
    const cancelNameBtn = document.getElementById('cancelNameBtn');
    
    // --- APPLICATION STATE ---
    let followedArtists = [];
    
    // --- ENCYCLOPEDIA DATABASE ---
    const database = {
        bands: {
            'Nirvana': {
                img: 'img/nirvana.band.jpg', category: 'Grunge', origin: 'Aberdeen, Washington, USA',
                bio: 'Nirvana was an American rock band formed in 1987. With a sound that blended punk and metal, the band became one of the biggest names in the Seattle grunge movement.',
                members: ['Kurt Cobain (Vocals, Guitar)', 'Krist Novoselic (Bass)', 'Dave Grohl (Drums)'],
                discography: ['Nevermind']
            },
            'Megadeth': {
                img: 'img/megadeth.jpg', category: 'Thrash Metal', origin: 'Los Angeles, California, USA',
                bio: 'Megadeth is a pioneering American thrash metal band. Known for its technical complexity and fast guitars, the band is led by vocalist and guitarist Dave Mustaine.',
                members: ['Dave Mustaine (Vocals, Guitar)', 'David Ellefson (Bass)', 'Kiko Loureiro (Guitar)', 'Dirk Verbeuren (Drums)'],
                discography: ['Rust in Peace', 'Countdown to Extinction']
            },
            'Mayhem': {
                img: 'img/mayhem.band.jpg', category: 'Black Metal', origin: 'Oslo, Norway',
                bio: 'Mayhem is a controversial and influential Norwegian black metal band formed in 1984. They are one of the founding bands of the Norwegian black metal scene.',
                members: ['Necrobutcher (Bass)', 'Hellhammer (Drums)', 'Attila Csihar (Vocals)', 'Teloch (Guitar)'],
                discography: ['De Mysteriis Dom Sathanas']
            },
            'Aventrum': {
                img: 'img/aventrum.jpg', category: 'Black Metal', origin: 'Brazil',
                bio: 'Aventrum is a Brazilian atmospheric and romantic black metal solo project led by Arthur Viana. It creates a dark and immersive sound, addressing deep and emotional themes through a raw atmosphere.',
                members: ['Arthur Viana (Composer, Vocals)'], 
                discography: []
            },
            'Entropia': {
                img: 'img/Entropia.jpg', category: 'Thrash Metal', origin: 'Brazil',
                bio: 'Entropia is a Brazilian thrash metal band known for its aggressive riffs and complex rhythms, exploring themes of chaos and existence.',
                members: ['Luiz Henrick (Cunhe) (Guitars, Vocals)', 'Arthur Rambo (Drums)'],
                discography: ['Chaos and Entropy']
            }
        },
        artists: {
            'Rove Braki': {
                img: 'img/ALTO MAR_track_cover.jpg', category: 'Rap', origin: 'Brazil',
                bio: 'Rove Braki is the independent artist project of composer and vocalist Henrique Roveratii, creating music using a cell phone with a focus on introspective lyrics and melodic beats.',
                members: ['Henrique Roveratii (Composer, Vocals)'],
                discography: ['Alto Mar']
            }
        },
        albums: {
            'Nevermind': { artist: 'Nirvana', year: 1991, img: 'img/NirvanaNevermindalbumcover.jpg', category: 'Grunge', description: 'Nirvana\'s second studio album, "Nevermind" was responsible for popularizing alternative rock and grunge worldwide.', tracklist: ['Smells Like Teen Spirit', 'In Bloom', 'Come as You Are', 'Breed', 'Lithium', 'Polly', 'Territorial Pissings', 'Drain You', 'Lounge Act', 'Stay Away', 'On a Plain', 'Something in the Way'] },
            'Rust in Peace': { artist: 'Megadeth', year: 1990, img: 'img/Megadeth-RustInPeace.jpg', category: 'Thrash Metal', description: 'Considered one of the most important albums in thrash metal, "Rust in Peace" is famous for its complex riffs and virtuosic solos.', tracklist: ['Holy Wars... The Punishment Due', 'Hangar 18', 'Take No Prisoners', 'Five Magics', 'Poison Was the Cure', 'Lucretia', 'Tornado of Souls', 'Dawn Patrol', 'Rust in Peace... Polaris'] },
            'Countdown to Extinction': { artist: 'Megadeth', year: 1992, img: 'img/Countdown_album_cover.jpg', category: 'Thrash Metal', description: 'This album marked a shift to a more accessible and commercial sound, becoming Megadeth\'s most successful album.', tracklist: ['Skin o\' My Teeth', 'Symphony of Destruction', 'Architecture of Aggression', 'Foreclosure of a Dream', 'Sweating Bullets', 'This Was My Life', 'Countdown to Extinction', 'High Speed Dirt', 'Psychotron', 'Captive Honour', 'Ashes in Your Mouth'] },
            'De Mysteriis Dom Sathanas': { artist: 'Mayhem', year: 1994, img: 'img/Mayhem_demysteriisdomsathanas.jpg', category: 'Black Metal', description: 'An iconic and dark album in the history of black metal, surrounded by controversy and considered a masterpiece of the genre.', tracklist: ['Funeral Fog', 'Freezing Moon', 'Cursed in Eternity', 'Pagan Fears', 'Life Eternal', 'From the Dark Past', 'Buried by Time and Dust', 'De Mysteriis Dom Sathanas'] },
            'Chaos and Entropy': { artist: 'Entropia', year: 2025, img: 'img/chaos and entropy.jpg', category: 'Thrash Metal', description: '???', tracklist: ['Chaos and entropy'] },
            'Alto Mar': { artist: 'Rove Braki', year: 2025, img: 'img/ALTO MAR_track_cover.jpg', category: 'Rap', description: '???', tracklist: ['Alto Mar'] }
        }
    };

    // --- FOLLOW LOGIC ---
    
    function saveFollowedState() {
        localStorage.setItem('avrenpediaFollowed', JSON.stringify(followedArtists));
    }

    function handleFollowClick(e) {
        const button = e.target.closest('.follow-btn');
        const artistName = button.dataset.artistName;
        const icon = button.querySelector('i');
        const span = button.querySelector('span');
        const artistIndex = followedArtists.indexOf(artistName);

        if (artistIndex === -1) {
            followedArtists.push(artistName);
            button.classList.add('following');
            icon.className = 'fas fa-check';
            span.textContent = 'Following';
        } else {
            followedArtists.splice(artistIndex, 1);
            button.classList.remove('following');
            icon.className = 'fas fa-plus';
            span.textContent = 'Follow';
        }
        saveFollowedState();
    }
    
    function renderFollowedArtists() {
        if (followedArtists.length === 0) {
            followedArtistsGrid.innerHTML = '';
            return;
        }
        const allArtists = {...database.bands, ...database.artists};
        const followedHTML = followedArtists.map(artistName => {
            const artist = allArtists[artistName];
            if (!artist) return '';
            return `
                <div class="music-card" data-type="${database.bands[artistName] ? 'band' : 'artist'}" data-name="${artistName}">
                    <div class="music-img"><img src="${artist.img}" alt="${artistName}"></div>
                    <div class="music-title">${artistName}</div>
                    <div class="music-artist">${artist.category}</div>
                </div>
            `;
        }).join('');
        followedArtistsGrid.innerHTML = followedHTML;
    }

    // --- RENDER LOGIC ---
    
    function renderDiscoverPage() {
        const allArtists = {...database.bands, ...database.artists};
        const allAlbums = database.albums;

        // Embaralha e pega 4 artistas aleatórios
        const randomArtists = Object.keys(allArtists).sort(() => 0.5 - Math.random()).slice(0, 4);
        // Embaralha e pega 4 álbuns aleatórios
        const randomAlbums = Object.keys(allAlbums).sort(() => 0.5 - Math.random()).slice(0, 4);

        let artistsHTML = '';
        randomArtists.forEach(name => {
            const artist = allArtists[name];
            artistsHTML += `
                <div class="music-card" data-type="${database.bands[name] ? 'band' : 'artist'}" data-name="${name}">
                    <div class="music-img"><img src="${artist.img}" alt="${name}"></div>
                    <div class="music-title">${name}</div>
                    <div class="music-artist">${artist.category}</div>
                </div>`;
        });

        let albumsHTML = '';
        randomAlbums.forEach(name => {
            const album = allAlbums[name];
            albumsHTML += `
                <div class="music-card" data-type="album" data-name="${name}" data-artist="${album.artist}">
                    <div class="music-img"><img src="${album.img}" alt="${name}"></div>
                    <div class="music-title">${name}</div>
                    <div class="music-artist">${album.artist} • ${album.year}</div>
                </div>`;
        });
        
        discoverArtistsGrid.innerHTML = artistsHTML;
        discoverAlbumsGrid.innerHTML = albumsHTML;
    }

    function renderArtistView(artistName) {
        const artist = database.bands[artistName] || database.artists[artistName];
        if (!artist) return;
        const isFollowing = followedArtists.includes(artistName);
        const discographyHTML = artist.discography.map(albumName => {
            const album = database.albums[albumName];
            if (!album) return '';
            return `
                <div class="music-card" data-type="album" data-name="${albumName}" data-artist="${album.artist}">
                    <div class="music-img"><img src="${album.img}" alt="${albumName}"></div>
                    <div class="music-title">${albumName}</div>
                    <div class="music-artist">${album.artist} • ${album.year}</div>
                </div>
            `;
        }).join('');
        detailsViewContainer.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header">
                <div class="details-img ${database.bands[artistName] ? 'band-img' : ''}"><img src="${artist.img}" alt="${artistName}"></div>
                <div class="details-info">
                    <h2>${artistName}</h2>
                    <p class="meta-info">${artist.origin}</p>
                    <button class="follow-btn ${isFollowing ? 'following' : ''}" data-artist-name="${artistName}">
                        <i class="fas ${isFollowing ? 'fa-check' : 'fa-plus'}"></i>
                        <span>${isFollowing ? 'Following' : 'Follow'}</span>
                    </button>
                </div>
            </div>
            <div class="details-body">
                <h3>Biography</h3>
                <p class="bio">${artist.bio}</p>
                ${artist.members ? `<h3>Members</h3><ul class="member-list">${artist.members.map(m => `<li>${m}</li>`).join('')}</ul>` : ''}
                <h3>Discography</h3>
                <div class="music-grid">${discographyHTML || '<p>No albums found.</p>'}</div>
            </div>
        `;
        switchContent('details-view');
    }

    function renderAlbumView(albumName) {
        const album = database.albums[albumName];
        if (!album) return;
        detailsViewContainer.innerHTML = `
            <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
            <div class="details-header">
                <div class="details-img"><img src="${album.img}" alt="${albumName}"></div>
                <div class="details-info">
                    <h2>${albumName}</h2>
                    <p>${album.artist} • ${album.year}</p>
                </div>
            </div>
            <div class="details-body">
                <h3>About the Album</h3>
                <p class="bio">${album.description}</p>
                <h3>Tracklist</h3>
                <ol class="track-list">${album.tracklist.map(track => `<li>${track}</li>`).join('')}</ol>
            </div>
        `;
        switchContent('details-view');
    }

    // --- UI & NAVIGATION LOGIC ---
    
    function loadState() {
        applyTheme(localStorage.getItem('avrenpediaTheme') || '#E50914');
        updateUserName(localStorage.getItem('avrenpediaUserName') || 'Arthur');
        followedArtists = JSON.parse(localStorage.getItem('avrenpediaFollowed')) || [];
    }

    function applyTheme(color) { document.documentElement.style.setProperty('--primary-color', color); }
    settingsBtn.addEventListener('click', () => themePicker.classList.toggle('active'));
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color;
            applyTheme(color);
            localStorage.setItem('avrenpediaTheme', color);
            themePicker.classList.remove('active');
        });
    });
    
    function updateUserName(name) {
        userNameEl.textContent = name;
        userAvatarEl.textContent = name.charAt(0).toUpperCase();
    }
    
    // --- New Modal Logic ---
    function showNameModal() {
        newNameInput.value = userNameEl.textContent;
        nameChangeModal.style.display = 'flex';
        newNameInput.focus();
    }
    function hideNameModal() {
        nameChangeModal.style.display = 'none';
    }

    userProfile.addEventListener('click', showNameModal);
    cancelNameBtn.addEventListener('click', hideNameModal);
    nameChangeModal.addEventListener('click', (e) => {
        if (e.target === nameChangeModal) hideNameModal(); // Close if clicking overlay
    });
    saveNameBtn.addEventListener('click', () => {
        const newName = newNameInput.value.trim();
        if (newName) {
            updateUserName(newName);
            localStorage.setItem('avrenpediaUserName', newName);
            hideNameModal();
        }
    });


    function switchContent(targetId) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === targetId));
        mainContent.scrollTop = 0;
        
        if (targetId === 'seguindo') {
            renderFollowedArtists();
        } else if (targetId === 'descobrir') {
            renderDiscoverPage();
        }
        
        document.querySelector('.main-container').classList.remove('sidebar-open');
        document.body.style.overflow = 'auto'; // Garante que o scroll volte ao normal
    }
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchContent(item.dataset.target)));
    
    // Correção do Bug Mobile
    document.getElementById('menuBtn').addEventListener('click', () => {
        document.querySelector('.main-container').classList.add('sidebar-open');
        document.body.style.overflow = 'hidden'; // Impede o scroll do conteúdo principal
    });
    document.getElementById('closeSidebarBtn').addEventListener('click', () => {
        document.querySelector('.main-container').classList.remove('sidebar-open');
        document.body.style.overflow = 'auto'; // Permite o scroll novamente
    });

    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const category = tab.dataset.category;
            document.querySelectorAll('#inicio .music-card').forEach(card => {
                card.style.display = (category === 'All' || card.dataset.category === category) ? 'block' : 'none';
            });
        });
    });

    // Pesquisa Melhorada
    searchInput.addEventListener('input', e => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) { switchContent('inicio'); return; }

        const allArtists = {...database.bands, ...database.artists};
        const artistResults = Object.keys(allArtists).filter(name => name.toLowerCase().includes(query));
        const albumResults = Object.keys(database.albums).filter(name => name.toLowerCase().includes(query));
        
        let resultsHTML = '';

        if (artistResults.length > 0) {
            resultsHTML += `<h2 class="section-title-main">Bands & Artists</h2><div class="music-grid">`;
            artistResults.forEach(name => {
                const artist = allArtists[name];
                resultsHTML += `<div class="music-card" data-type="${database.bands[name] ? 'band' : 'artist'}" data-name="${name}"><div class="music-img"><img src="${artist.img}" alt="${name}"></div><div class="music-title">${name}</div><div class="music-artist">${artist.category}</div></div>`;
            });
            resultsHTML += `</div>`;
        }

        if (albumResults.length > 0) {
            resultsHTML += `<h2 class="section-title-main">Albums</h2><div class="music-grid">`;
            albumResults.forEach(name => {
                const album = database.albums[name];
                resultsHTML += `<div class="music-card" data-type="album" data-name="${name}" data-artist="${album.artist}"><div class="music-img"><img src="${album.img}" alt="${name}"></div><div class="music-title">${name}</div><div class="music-artist">${album.artist}</div></div>`;
            });
            resultsHTML += `</div>`;
        }

        searchResultsContainer.innerHTML = resultsHTML || '<p class="search-message">No results found.</p>';
        switchContent('buscar');
    });

    mainContent.addEventListener('click', e => {
        if (e.target.closest('.back-btn')) { switchContent('inicio'); return; }
        if (e.target.closest('.follow-btn')) { handleFollowClick(e); return; }
        const card = e.target.closest('.music-card');
        if (card) {
            const type = card.dataset.type;
            const name = card.dataset.name;
            if (type === 'band' || type === 'artist') {
                renderArtistView(name);
            } else if (type === 'album') {
                renderAlbumView(name);
            }
        }
    });

    // --- INITIALIZATION ---
    loadState();
    renderDiscoverPage(); // Popula a página "Descobrir" na primeira carga
});