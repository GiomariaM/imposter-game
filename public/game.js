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

let currentRoom = null;
let isHost = false;

// Create Room
createRoomBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (playerName) {
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
        socket.emit('joinRoom', { roomCode, playerName });
    } else {
        alert('Please enter your name and room code');
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
    showGameScreen(roomCode);
    updateControlsVisibility();
});

socket.on('joinedRoom', (roomCode) => {
    currentRoom = roomCode;
    isHost = false;
    showGameScreen(roomCode);
    updateControlsVisibility();
});

socket.on('updatePlayers', ({ players, hostId }) => {
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name + (player.id === hostId ? ' (Host)' : '');
        playersList.appendChild(li);
    });
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

socket.on('error', (message) => {
    alert(message);
});

// Helper Functions
function showGameScreen(roomCode) {
    initialScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    roomCodeDisplay.textContent = roomCode;
    updateControlsVisibility();
}

function updateControlsVisibility() {
    if (isHost) {
        hostControls.classList.remove('hidden');
        startGameBtn.classList.remove('hidden');
        nextTurnBtn.classList.add('hidden'); // Hide next turn button until game starts
    } else {
        hostControls.classList.add('hidden');
        startGameBtn.classList.add('hidden');
        nextTurnBtn.classList.add('hidden');
    }
}
