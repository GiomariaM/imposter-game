const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files from public directory
app.use(express.static('public'));

// Game state storage
const rooms = new Map();

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function selectRandomWord(wordList) {
    return wordList.words[Math.floor(Math.random() * wordList.words.length)];
}

function selectImposter(players) {
    return players[Math.floor(Math.random() * players.length)];
}

io.on('connection', (socket) => {
    console.log('A user connected');

    // Create Room
    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        rooms.set(roomCode, {
            host: socket.id,
            players: [{id: socket.id, name: playerName}],
            currentWord: null,
            imposter: null,
            isGameStarted: false
        });
        
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        io.to(roomCode).emit('updatePlayers', {
            players: rooms.get(roomCode).players,
            hostId: rooms.get(roomCode).host
        });
    });

    // Join Room
    socket.on('joinRoom', ({roomCode, playerName}) => {
        const room = rooms.get(roomCode);
        if (room && !room.isGameStarted) {
            socket.join(roomCode);
            room.players.push({id: socket.id, name: playerName});
            io.to(roomCode).emit('updatePlayers', {
                players: room.players,
                hostId: room.host
            });
            socket.emit('joinedRoom', roomCode);
        } else {
            socket.emit('error', 'Room not found or game already started');
        }
    });

    // Start Game
    socket.on('startGame', async (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && socket.id === room.host) {
            room.isGameStarted = true;
            
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
            const wordList = require('./wordlist.json');
            room.currentWord = selectRandomWord(wordList);
            room.imposter = selectImposter(room.players);

            room.players.forEach(player => {
                if (player.id === room.imposter.id) {
                    io.to(player.id).emit('newTurn', { word: null, isImposter: true });
                } else {
                    io.to(player.id).emit('newTurn', { word: room.currentWord, isImposter: false });
                }
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        rooms.forEach((room, roomCode) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    rooms.delete(roomCode);
                } else if (socket.id === room.host) {
                    room.host = room.players[0].id;
                }
                io.to(roomCode).emit('updatePlayers', {
                    players: room.players,
                    hostId: room.host
                });
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
