const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store player information and game state
const players = {};
const boardStates = {};
let turnIndex = 0;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Default route handler
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        handleClientMessage(ws, data);
    });

    ws.on('close', () => {
        handleClientDisconnect(ws);
    });
});

// Handle incoming client messages
function handleClientMessage(ws, data) {
    switch (data.type) {
        case 'login':
            handleLogin(ws, data.playerName);
            break;
        case 'deploy':
            handleDeploy(ws, data.ships);
            break;
        case 'attack':
            handleAttack(ws, data.opponent, data.position);
            break;
        case 'getOpponents':
            sendOpponentsList(ws);
            break;
        case 'getBoardState':
            sendBoardState(ws);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

// Handle player login
function handleLogin(ws, playerName) {
    console.log(`Player logged in: ${playerName}`);
    players[playerName] = { ws, ships: [], deployed: false };
    boardStates[playerName] = createEmptyBoard();
    sendOpponentsList(ws);
    notifyAllPlayers({ type: 'newPlayer', playerName });
    sendDeploymentStatus();
}

// Handle ship deployment
function handleDeploy(ws, ships) {
    const playerName = getPlayerName(ws);
    if (playerName) {
        console.log(`Player ${playerName} deployed ships.`);
        players[playerName].ships = ships;
        players[playerName].deployed = true;

        // Notify all players about the updated deployment status
        sendDeploymentStatus();

        checkAllPlayersDeployed();
    }
}

// Handle attack action
function handleAttack(ws, opponentName, position) {
    const attackerName = getPlayerName(ws);
    if (attackerName && players[opponentName]) {
        if (isPlayerTurn(attackerName)) {
            processAttack(attackerName, opponentName, position);
            advanceTurn();
        } else {
            ws.send(JSON.stringify({ type: 'invalidTurn', message: 'No es tu turno.' }));
        }
    }
}

// Process the attack and notify players
function processAttack(attacker, defender, position) {
    const hit = checkHit(defender, position);
    updateBoardState(defender, position, hit ? 'hit' : 'miss');

    // Notify defender
    players[defender].ws.send(JSON.stringify({
        type: 'attackResult',
        position,
        hit,
        player: attacker,
        attackedPlayer: defender
    }));

    // Notify attacker
    players[attacker].ws.send(JSON.stringify({
        type: 'attackResult',
        position,
        hit,
        player: attacker,
        attackedPlayer: defender
    }));

    console.log(`Player ${attacker} attacked ${defender} at position [${position[0]}, ${position[1]}] and ${hit ? 'hit' : 'missed'}`);

    // Update board states
    sendBoardState(players[defender].ws);
    sendBoardState(players[attacker].ws);
}

// Check if the attack is a hit
function checkHit(defender, position) {
    return players[defender].ships.some(ship =>
        ship.positions.some(pos => pos[0] === position[0] && pos[1] === position[1])
    );
}

// Update the board state after an attack
function updateBoardState(playerName, position, status) {
    boardStates[playerName][position[0]][position[1]] = status;
}

// Send the list of opponents to a player
function sendOpponentsList(ws) {
    const playerName = getPlayerName(ws);
    if (playerName) {
        const opponents = Object.keys(players).filter(name => name !== playerName);
        ws.send(JSON.stringify({ type: 'opponents', opponents }));
    }
}

// Send the board state to a player
function sendBoardState(ws) {
    const playerName = getPlayerName(ws);
    if (playerName) {
        ws.send(JSON.stringify({ type: 'boardState', boardState: boardStates[playerName] }));
    }
}

// Notify all players of an event
function notifyAllPlayers(message) {
    Object.values(players).forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

// Check if all players have deployed their ships
function checkAllPlayersDeployed() {
    const allDeployed = Object.values(players).every(player => player.deployed);
    if (allDeployed) {
        notifyAllPlayers({ type: 'allPlayersReady' });
        notifyTurn();
    }
}

// Notify players whose turn it is
function notifyTurn() {
    const currentPlayer = getCurrentPlayerName();
    notifyAllPlayers({ type: 'turn', playerName: currentPlayer });
}

// Advance to the next player's turn
function advanceTurn() {
    turnIndex = (turnIndex + 1) % Object.keys(players).length;
    notifyTurn();
}

// Handle client disconnection
function handleClientDisconnect(ws) {
    console.log('Client disconnected');
    const playerName = getPlayerName(ws);
    if (playerName) {
        delete players[playerName];
        delete boardStates[playerName];
    }
}

// Helper functions
function createEmptyBoard() {
    return Array.from({ length: 10 }, () => Array(10).fill(null));
}

function getPlayerName(ws) {
    return Object.keys(players).find(name => players[name].ws === ws);
}

function getCurrentPlayerName() {
    return Object.keys(players)[turnIndex];
}

function isPlayerTurn(playerName) {
    return getCurrentPlayerName() === playerName;
}

// Send players' deployment status to all players
function sendDeploymentStatus() {
    const status = Object.entries(players).map(([playerName, playerData]) => ({
        playerName,
        deployed: playerData.deployed
    }));
    notifyAllPlayers({ type: 'deploymentStatus', status });
}

// Start the server
server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});