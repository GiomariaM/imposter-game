const socket = io();

// DOM Elements
const initialScreen = document.getElementById('initial-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const roomCodeDisplay = document.getElementById('room-code-display');
const playersList = document.getElementById('players-list');
const hostControls = document.getElementById('host-controls');
const startGameBtn = document.getElementById('start-game-btn');
const nextTurnBtn = document.getElementById('next-turn-btn');
const gameStatus = document.getElementById('game-status');
const wordDisplay = document.getElementById('word-display');

// Create disconnect button
const disconnectBtn = document.createElement('button');
disconnectBtn.id = 'disconnect-btn';
disconnectBtn.className = 'primary-button warning';
disconnectBtn.textContent = 'Leave Game';
gameScreen.appendChild(disconnectBtn);

let currentRoom = null;
let isHost = false;
let currentPlayerName = null;

// Check for existing session on page load
window.addEventListener('load', () => {
    const savedName = localStorage.getItem('playerName');
    const savedRoom = localStorage.getItem('roomCode');
    
    if (savedName && savedRoom) {
        socket.emit('checkSession', {
            playerName: savedName,
            roomCode: savedRoom
        });
        currentPlayerName = savedName;
        playerNameInput.value = savedName;
    }
});

// Create Room
createRoomBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (playerName) {
        resetGameState(); // Reset state before creating new room
        currentPlayerName = playerName;
        localStorage.setItem('playerName', playerName);
        socket.emit('createRoom', playerName);
    } else {
        alert('Please enter your name');
    }
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (playerName && roomCode) {
        resetGameState(); // Reset state before joining room
        currentPlayerName = playerName;
        localStorage.setItem('playerName', playerName);
        localStorage.setItem('roomCode', roomCode);
        socket.emit('joinRoom', { roomCode, playerName });
    } else {
        alert('Please enter your name and room code');
    }
});

// Disconnect/Leave Game
disconnectBtn.addEventListener('click', () => {
    if (currentRoom) {
        socket.emit('leaveGame', { roomCode: currentRoom, playerName: currentPlayerName });
        localStorage.removeItem('playerName');
        localStorage.removeItem('roomCode');
        resetGameState();
        initialScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        playerNameInput.value = '';
        roomCodeInput.value = '';
    }
});

// Start Game
startGameBtn.addEventListener('click', () => {
    if (currentRoom && isHost) {
        socket.emit('startGame', currentRoom);
        startGameBtn.classList.add('hidden');
        nextTurnBtn.classList.remove('hidden');
    }
});

// Next Turn
nextTurnBtn.addEventListener('click', () => {
    if (currentRoom && isHost) {
        socket.emit('nextTurn', currentRoom);
    }
});

// Socket Events
socket.on('roomCreated', (roomCode) => {
    currentRoom = roomCode;
    isHost = true;
    localStorage.setItem('roomCode', roomCode);
    showGameScreen(roomCode);
    updateControlsVisibility();
});

socket.on('joinedRoom', (roomCode) => {
    currentRoom = roomCode;
    showGameScreen(roomCode);
    updateControlsVisibility();
});

socket.on('joinedAsSpectator', (roomCode) => {
    currentRoom = roomCode;
    isHost = false;
    showGameScreen(roomCode);
    updateControlsVisibility();
    wordDisplay.textContent = "Waiting for next round to join...";
    gameStatus.classList.remove('hidden');
});

socket.on('rejoinedRoom', ({ roomCode, isHost: hostStatus }) => {
    currentRoom = roomCode;
    isHost = hostStatus;
    showGameScreen(roomCode);
    updateControlsVisibility();
});

socket.on('updatePlayers', ({ players, hostId, spectators = [] }) => {
    playersList.innerHTML = '';
    
    // Regular players
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name + (player.id === hostId ? ' (Host)' : '');
        if (player.id === hostId) {
            isHost = (socket.id === hostId);
        }
        playersList.appendChild(li);
    });

    // Spectators
    if (spectators.length > 0) {
        const spectatorHeader = document.createElement('li');
        spectatorHeader.textContent = 'Spectators:';
        spectatorHeader.className = 'spectator-header';
        playersList.appendChild(spectatorHeader);
        
        spectators.forEach(spectator => {
            const li = document.createElement('li');
            li.textContent = spectator.name + ' (Waiting)';
            li.className = 'spectator';
            playersList.appendChild(li);
        });
    }

    updateControlsVisibility();
});

socket.on('gameStarted', ({ word, isImposter }) => {
    gameStatus.classList.remove('hidden');
    if (isImposter) {
        wordDisplay.textContent = "You are the Imposter!";
        wordDisplay.classList.add('imposter');
    } else {
        wordDisplay.textContent = `The word is: ${word}`;
        wordDisplay.classList.remove('imposter');
    }
});

socket.on('newTurn', ({ word, isImposter }) => {
    if (isImposter) {
        wordDisplay.textContent = "You are the Imposter!";
        wordDisplay.classList.add('imposter');
    } else {
        wordDisplay.textContent = `The word is: ${word}`;
        wordDisplay.classList.remove('imposter');
    }
});

socket.on('hostChanged', (newHostId) => {
    isHost = (socket.id === newHostId);
    updateControlsVisibility();
});

socket.on('error', (message) => {
    alert(message);
});

// Helper Functions
function resetGameState() {
    currentRoom = null;
    isHost = false;
    currentPlayerName = null;
    gameStatus.classList.add('hidden');
    wordDisplay.textContent = '';
    wordDisplay.classList.remove('imposter');
    startGameBtn.classList.add('hidden');
    nextTurnBtn.classList.add('hidden');
}

function showGameScreen(roomCode) {
    initialScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    roomCodeDisplay.textContent = roomCode;
    updateControlsVisibility();
}

function updateControlsVisibility() {
    if (isHost) {
        hostControls.classList.remove('hidden');
        if (gameStatus.classList.contains('hidden')) {
            startGameBtn.classList.remove('hidden');
            nextTurnBtn.classList.add('hidden');
        } else {
            startGameBtn.classList.add('hidden');
            nextTurnBtn.classList.remove('hidden');
        }
    } else {
        hostControls.classList.add('hidden');
        startGameBtn.classList.add('hidden');
        nextTurnBtn.classList.add('hidden');
    }
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentPlayerName && currentRoom) {
        socket.emit('checkSession', {
            playerName: currentPlayerName,
            roomCode: currentRoom
        });
    }
});
