import { kv } from '@vercel/kv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const SECRET = process.env.JWT_SECRET;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function getSpotifyToken() {
    try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
            },
            body: 'grant_type=client_credentials'
        });
        if (!response.ok) {
            throw new Error(`Spotify token error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Failed to get Spotify token:", error);
        return null;
    }
}


export default async function handler(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    let decoded;

    if (token) {
        try {
            decoded = jwt.verify(token, SECRET);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }

    // --- GET Requests ---
    if (req.method === 'GET') {
        const { name, playlistsFor, playlistId } = req.query;

        // GET: Fetch a single public user profile by name
        if (name) {
            const user = await kv.get(name.toLowerCase());
            if (!user) return res.status(404).json({ error: 'User not found' });
            // Return only public data
            const { password, email, ...publicData } = user;
            return res.status(200).json(publicData);
        }
        
        // GET: Fetch public playlists for a user
        if (playlistsFor) {
            const user = await kv.get(playlistsFor.toLowerCase());
            if (!user) return res.status(404).json({ error: 'User not found' });
            const publicPlaylists = user.playlists?.filter(p => p.isPublic).map(p => ({
                id: p.id,
                name: p.name,
                owner: p.owner,
                trackCount: p.tracks?.length || 0,
                coverImage: p.tracks?.[0]?.albumImageUrl || null
            })) || [];
            return res.status(200).json(publicPlaylists);
        }
        
        // GET: Fetch details of a single playlist by its ID
        if (playlistId) {
            const ownerName = await kv.get(`playlist:${playlistId}`);
            if (!ownerName) return res.status(404).json({ error: 'Playlist not found' });
            
            const owner = await kv.get(ownerName.toLowerCase());
            if (!owner) return res.status(404).json({ error: 'Playlist owner not found' });

            const playlist = owner.playlists.find(p => p.id === playlistId);
            if (!playlist) return res.status(404).json({ error: 'Playlist not found in owner data' });

            // Check for privacy
            if (!playlist.isPublic && (!decoded || decoded.name.toLowerCase() !== owner.name.toLowerCase())) {
                return res.status(403).json({ error: 'This playlist is private' });
            }
            return res.status(200).json(playlist);
        }

        // GET: Default - fetch the logged-in user's full profile
        if (!decoded) return res.status(401).json({ error: 'Authentication required' });
        const user = await kv.get(decoded.name.toLowerCase());
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const { password, ...userData } = user;
        return res.status(200).json(userData);
    }
    
    // --- PUT Request (Update User) ---
    if (req.method === 'PUT') {
        if (!decoded) return res.status(401).json({ error: 'Authentication required' });
        
        const user = await kv.get(decoded.name.toLowerCase());
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { name, ...updateData } = req.body;

        if (name && name.toLowerCase() !== user.name.toLowerCase()) {
            return res.status(400).json({ error: 'Username change is not allowed via this method.' });
        }
        
        const updatedUser = { ...user, ...updateData };
        await kv.set(user.name.toLowerCase(), updatedUser);
        
        const { password, ...returnData } = updatedUser;
        return res.status(200).json(returnData);
    }

    // --- POST Requests (Actions) ---
    if (req.method === 'POST') {
        const { action, userNames, badge, payload } = req.body;

        // POST: Get online statuses for multiple users
        if (action === 'getStatuses') {
            if (!userNames || !Array.isArray(userNames)) return res.status(400).json({ error: 'Usernames array is required' });
            const statuses = {};
            for (const name of userNames) {
                const user = await kv.get(name.toLowerCase());
                statuses[name] = user?.lastSeen || null;
            }
            return res.status(200).json(statuses);
        }
        
        if (!decoded) return res.status(401).json({ error: 'Authentication required for this action' });
        const user = await kv.get(decoded.name.toLowerCase());
        if (!user) return res.status(404).json({ error: 'User not found' });

        // POST: Update user's personality badge
        if (action === 'updateBadge') {
            user.badges = user.badges.filter(b => !['discoverer', 'collector', 'explorer'].includes(b));
            user.badges.push(badge);
            await kv.set(user.name.toLowerCase(), user);
            const { password, ...returnData } = user;
            return res.status(200).json(returnData);
        }

        // --- PLAYLIST ACTIONS ---

        if (action === 'playlist_create') {
            if (!payload.name) return res.status(400).json({ error: "Playlist name is required." });
            const newPlaylist = {
                id: randomUUID(),
                name: payload.name,
                description: payload.description || '',
                owner: user.name,
                isPublic: payload.isPublic,
                tracks: [],
                createdAt: new Date().toISOString()
            };
            user.playlists = user.playlists || [];
            user.playlists.unshift(newPlaylist);
            await kv.set(user.name.toLowerCase(), user);
            await kv.set(`playlist:${newPlaylist.id}`, user.name);
            return res.status(201).json(newPlaylist);
        }

        if (action === 'playlist_edit') {
            if (!payload.id || !payload.name) return res.status(400).json({ error: "Playlist ID and name are required." });
            const playlistIndex = user.playlists.findIndex(p => p.id === payload.id);
            if (playlistIndex === -1) return res.status(404).json({ error: "Playlist not found." });

            user.playlists[playlistIndex].name = payload.name;
            user.playlists[playlistIndex].description = payload.description;
            user.playlists[playlistIndex].isPublic = payload.isPublic;
            await kv.set(user.name.toLowerCase(), user);
            return res.status(200).json(user.playlists[playlistIndex]);
        }
        
        if (action === 'playlist_addTrack') {
            const { playlistId, trackId } = payload;
            if (!playlistId || !trackId) return res.status(400).json({ error: "Playlist ID and Track ID are required." });
            
            const playlistIndex = user.playlists.findIndex(p => p.id === playlistId);
            if (playlistIndex === -1) return res.status(404).json({ error: "Playlist not found." });

            if (user.playlists[playlistIndex].tracks.some(t => t.id === trackId)) {
                return res.status(409).json({ error: "Track already in playlist." });
            }

            const spotifyToken = await getSpotifyToken();
            if (!spotifyToken) return res.status(503).json({ error: "Could not connect to Spotify service." });

            const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
                headers: { 'Authorization': `Bearer ${spotifyToken}` }
            });
            if (!trackResponse.ok) return res.status(404).json({ error: "Track not found on Spotify." });
            
            const trackData = await trackResponse.json();
            const formattedTrack = {
                id: trackData.id,
                name: trackData.name,
                artistName: trackData.artists[0].name,
                artistId: trackData.artists[0].id,
                duration_ms: trackData.duration_ms,
                albumImageUrl: trackData.album.images[0]?.url || null,
                addedAt: new Date().toISOString()
            };

            user.playlists[playlistIndex].tracks.push(formattedTrack);
            await kv.set(user.name.toLowerCase(), user);
            return res.status(200).json(user.playlists[playlistIndex]);
        }

        if (action === 'playlist_removeTrack') {
            const { playlistId, trackId } = payload;
            if (!playlistId || !trackId) return res.status(400).json({ error: "Playlist ID and Track ID are required." });
            
            const playlistIndex = user.playlists.findIndex(p => p.id === playlistId);
            if (playlistIndex === -1) return res.status(404).json({ error: "Playlist not found." });

            user.playlists[playlistIndex].tracks = user.playlists[playlistIndex].tracks.filter(t => t.id !== trackId);
            await kv.set(user.name.toLowerCase(), user);
            return res.status(200).json({ success: true });
        }
        
        if (action === 'playlist_delete') {
             if (!payload.id) return res.status(400).json({ error: "Playlist ID is required." });
             user.playlists = user.playlists.filter(p => p.id !== payload.id);
             await kv.del(`playlist:${payload.id}`);
             await kv.set(user.name.toLowerCase(), user);
             return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}