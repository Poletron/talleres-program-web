const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const players = {};
let turnIndex = 0;
const boardStates = {}; // Estado de cada celda del tablero

// Servir el archivo index.html
app.use(express.static(path.join(__dirname, '../Sitio')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Sitio/index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Sitio/index.html'));
});

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'login') {
            console.log(`Player logged in: ${data.playerName}`);
            players[data.playerName] = { ws, ships: [], deployed: false };
            boardStates[data.playerName] = Array(10).fill(null).map(() => Array(10).fill(null)); // Inicializar el estado del tablero
            sendOpponents(ws, data.playerName);
            notifyNewPlayer(data.playerName);
        } else if (data.type === 'deploy') {
            console.log(`Player deployed ships: ${JSON.stringify(data.ships)}`);
            const player = Object.keys(players).find(playerName => players[playerName].ws === ws);
            if (player) {
                players[player].ships = data.ships;
                players[player].deployed = true;
                checkIfAllPlayersDeployed();
            }
        } else if (data.type === 'attack') {
            const { opponent, position } = data;
            const player = Object.keys(players).find(playerName => players[playerName].ws === ws);
            if (player && players[opponent]) {
                if (Object.keys(players)[turnIndex] === player) {
                    const hit = players[opponent].ships.some(ship => ship.positions.some(pos => pos[0] === position[0] && pos[1] === position[1]));
                    boardStates[opponent][position[0]][position[1]] = hit ? 'hit' : 'miss';
                    players[opponent].ws.send(JSON.stringify({ type: 'attackResult', position, hit, player, attackedPlayer: opponent }));
                    ws.send(JSON.stringify({ type: 'attackResult', position, hit, player: opponent, attackedPlayer: opponent }));
                    console.log(`Player ${player} attacked ${opponent} at position [${position[0] + 1}, ${position[1] + 1}] and ${hit ? 'hit' : 'missed'}`);
                    sendBoardState(players[opponent].ws, opponent);
                    sendBoardState(ws, player);
                    nextTurn();
                } else {
                    ws.send(JSON.stringify({ type: 'invalidTurn', message: 'No es tu turno.' }));
                }
            }
        } else if (data.type === 'getOpponents') {
            const player = Object.keys(players).find(playerName => players[playerName].ws === ws);
            if (player) {
                sendOpponents(ws, player);
            }
        } else if (data.type === 'getBoardState') {
            const player = Object.keys(players).find(playerName => players[playerName].ws === ws);
            if (player) {
                sendBoardState(ws, player);
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        const player = Object.keys(players).find(playerName => players[playerName].ws === ws);
        if (player) {
            delete players[player];
        }
    });
});

function sendOpponents(ws, playerName) {
    const opponents = Object.keys(players).filter(name => name !== playerName);
    ws.send(JSON.stringify({ type: 'opponents', opponents }));
}

function notifyNewPlayer(playerName) {
    Object.values(players).forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify({ type: 'newPlayer', playerName }));
        }
    });
}

function checkIfAllPlayersDeployed() {
    const deployedPlayers = Object.values(players).filter(player => player.deployed);
    if (deployedPlayers.length === Object.keys(players).length) {
        deployedPlayers.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'startGame' }));
        });
        notifyTurn();
    }
}

function notifyTurn() {
    const playerNames = Object.keys(players);
    const currentPlayer = playerNames[turnIndex];
    Object.values(players).forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify({ type: 'turn', playerName: currentPlayer }));
        }
    });
}

function nextTurn() {
    const playerNames = Object.keys(players);
    turnIndex = (turnIndex + 1) % playerNames.length;
    notifyTurn();
}

function sendBoardState(ws, playerName) {
    ws.send(JSON.stringify({ type: 'boardState', boardState: boardStates[playerName] }));
}

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});