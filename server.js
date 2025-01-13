const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files from public directory
app.use(express.static('public'));

// Game state storage
const rooms = new Map();
// Store player names and their last room
const playerSessions = new Map();

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function selectRandomWord(wordList) {
    return wordList.words[Math.floor(Math.random() * wordList.words.length)];
}

function selectImposter(players) {
    return players[Math.floor(Math.random() * players.length)];
}

function resetRoom(room) {
    room.isGameStarted = false;
    room.currentWord = null;
    room.imposter = null;
    room.spectators = [];
    return room;
}

function assignNewHost(room) {
    if (room.players.length > 0) {
        // Randomly select a new host from remaining players
        const randomIndex = Math.floor(Math.random() * room.players.length);
        const newHost = room.players[randomIndex].id;
        room.host = newHost;
        return newHost;
    }
    return null;
}

io.on('connection', (socket) => {
    console.log('A user connected');

    // Check for existing session
    socket.on('checkSession', ({ playerName, roomCode }) => {
        const sessionKey = `${playerName}-${roomCode}`;
        const room = rooms.get(roomCode);
        
        if (room && playerSessions.get(sessionKey)) {
            const existingPlayer = room.players.find(p => p.name === playerName);
            
            if (existingPlayer) {
                existingPlayer.id = socket.id;
                socket.join(roomCode);
                
                // If there's no host, assign one
                if (!room.host || !room.players.find(p => p.id === room.host)) {
                    room.host = assignNewHost(room);
                }

                socket.emit('rejoinedRoom', {
                    roomCode,
                    isHost: room.host === socket.id
                });

                if (room.isGameStarted) {
                    const isImposter = room.imposter && room.imposter.name === playerName;
                    socket.emit('gameStarted', { 
                        word: isImposter ? null : room.currentWord,
                        isImposter: isImposter
                    });
                }
                
                io.to(roomCode).emit('updatePlayers', {
                    players: room.players,
                    hostId: room.host,
                    spectators: room.spectators
                });
            }
        }
    });

    socket.on('leaveGame', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);
        if (room) {
            // Remove player from both lists
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.spectators) {
                room.spectators = room.spectators.filter(p => p.id !== socket.id);
            }

            // If the leaving player was the host, assign a new one
            if (socket.id === room.host) {
                const newHost = assignNewHost(room);
                if (newHost) {
                    io.to(roomCode).emit('hostChanged', newHost);
                }
            }

            // Remove session
            playerSessions.delete(`${playerName}-${roomCode}`);

            // Clean up empty room or update players
            if (room.players.length === 0) {
                rooms.delete(roomCode);
            } else {
                io.to(roomCode).emit('updatePlayers', {
                    players: room.players,
                    hostId: room.host,
                    spectators: room.spectators
                });
            }

            socket.leave(roomCode);
        }
    });

    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        const newRoom = {
            host: socket.id,
            players: [{id: socket.id, name: playerName}],
            currentWord: null,
            imposter: null,
            isGameStarted: false,
            spectators: []
        };
        
        rooms.set(roomCode, newRoom);
        playerSessions.set(`${playerName}-${roomCode}`, true);
        
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('updatePlayers', {
            players: newRoom.players,
            hostId: newRoom.host
        });
    });

    socket.on('joinRoom', ({roomCode, playerName}) => {
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        // Remove any existing sessions for this player
        Array.from(playerSessions.keys()).forEach(key => {
            if (key.startsWith(`${playerName}-`)) {
                playerSessions.delete(key);
            }
        });

        // Store new session
        playerSessions.set(`${playerName}-${roomCode}`, true);
        
        // Check if player name is already taken in this room
        const existingPlayer = [...room.players, ...room.spectators]
            .find(p => p.name.toLowerCase() === playerName.toLowerCase());
            
        if (existingPlayer) {
            socket.emit('error', 'Name already taken in this room');
            return;
        }

        socket.join(roomCode);

        if (room.isGameStarted) {
            room.spectators.push({id: socket.id, name: playerName});
            socket.emit('joinedAsSpectator', roomCode);
        } else {
            room.players.push({id: socket.id, name: playerName});
            socket.emit('joinedRoom', roomCode);
        }

        io.to(roomCode).emit('updatePlayers', {
            players: room.players,
            hostId: room.host,
            spectators: room.spectators
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        rooms.forEach((room, roomCode) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            const wasHost = socket.id === room.host;

            if (playerIndex !== -1) {
                // Don't remove the player immediately, give them a chance to reconnect
                setTimeout(() => {
                    const currentRoom = rooms.get(roomCode);
                    if (currentRoom) {
                        const player = currentRoom.players.find(p => p.id === socket.id);
                        if (player) {
                            currentRoom.players = currentRoom.players.filter(p => p.id !== socket.id);
                            
                            // If the room is empty, delete it
                            if (currentRoom.players.length === 0) {
                                rooms.delete(roomCode);
                                return;
                            }
                            
                            // If this was the host, assign a new one
                            if (wasHost) {
                                const newHost = assignNewHost(currentRoom);
                                if (newHost) {
                                    io.to(roomCode).emit('hostChanged', newHost);
                                }
                            }

                            io.to(roomCode).emit('updatePlayers', {
                                players: currentRoom.players,
                                hostId: currentRoom.host,
                                spectators: currentRoom.spectators
                            });
                        }
                    }
                }, 5000); // 5 second grace period for reconnection
            }

            // Handle spectator disconnection immediately
            if (room.spectators) {
                const spectatorIndex = room.spectators.findIndex(p => p.id === socket.id);
                if (spectatorIndex !== -1) {
                    room.spectators.splice(spectatorIndex, 1);
                    io.to(roomCode).emit('updatePlayers', {
                        players: room.players,
                        hostId: room.host,
                        spectators: room.spectators
                    });
                }
            }
        });
    });

    // Start Game
    socket.on('startGame', async (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && socket.id === room.host) {
            room.isGameStarted = true;
            
            // Move any spectators to players for next round
            if (room.spectators.length > 0) {
                room.players = [...room.players, ...room.spectators];
                room.spectators = [];
            }
            
            const wordList = require('./wordlist.json');
            room.currentWord = selectRandomWord(wordList);
            room.imposter = selectImposter(room.players);

            // Send word to players (except imposter)
            room.players.forEach(player => {
                if (player.id === room.imposter.id) {
                    io.to(player.id).emit('gameStarted', { word: null, isImposter: true });
                } else {
                    io.to(player.id).emit('gameStarted', { word: room.currentWord, isImposter: false });
                }
            });
        }
    });

    // Next Turn
    socket.on('nextTurn', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && socket.id === room.host) {
            // Move any spectators to players for next round
            if (room.spectators.length > 0) {
                room.players = [...room.players, ...room.spectators];
                room.spectators = [];
            }

            const wordList = require('./wordlist.json');
            room.currentWord = selectRandomWord(wordList);
            room.imposter = selectImposter(room.players);

            io.to(roomCode).emit('updatePlayers', {
                players: room.players,
                hostId: room.host
            });

            room.players.forEach(player => {
                if (player.id === room.imposter.id) {
                    io.to(player.id).emit('newTurn', { word: null, isImposter: true });
                } else {
                    io.to(player.id).emit('newTurn', { word: room.currentWord, isImposter: false });
                }
            });
        }
    });

});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
