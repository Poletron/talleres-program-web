const express = require('express');
const cors = require('cors'); // Importar el paquete cors
const fs = require('fs'); // Importar el módulo fs
const path = require('path'); // Importar el módulo path
const app = express();

// Configurar el middleware CORS para permitir todas las origines
app.use(cors({
    origin: '*',
    methods: ["GET", "POST"],
    credentials: false // Deshabilitar credentials
}));

const http = require('http').createServer(app);
// Configurar Socket.IO con CORS para permitir todas las origines
const io = require('socket.io')(http, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"],
        credentials: false // Deshabilitar credentials
    },
});

// Middleware para parsear JSON
app.use(express.json());

// Ruta al archivo JSON de usuarios
const usersFilePath = path.join(__dirname, 'users.json');

// Función para leer usuarios desde el archivo JSON
function readUsers() {
    if (!fs.existsSync(usersFilePath)) {
        fs.writeFileSync(usersFilePath, JSON.stringify({}));
    }
    const data = fs.readFileSync(usersFilePath);
    return JSON.parse(data);
}

// Función para escribir usuarios al archivo JSON
function writeUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// Estructura para gestionar las salas
const rooms = {};

// Función para generar códigos de sala únicos de 6 caracteres alfanuméricos
function generateRoomCode() {
    const characters = '0123456789';
    let roomCode;
    let attempts = 0;
    const maxAttempts = 5;

    do {
        roomCode = '';
        for (let i = 0; i < 6; i++) {
            roomCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        attempts++;
        if (attempts > maxAttempts) {
            throw new Error('No se pudo generar un código de sala único. Intenta nuevamente.');
        }
    } while (rooms[roomCode]);

    return roomCode;
}

// Endpoint GET /
app.get('/', (req, res) => {
    res.json({ message: 'Bienvenido al servidor para el taller de Batalla Naval.' });
});

// Endpoint GET /boats
app.get('/boats', (req, res) => {
    const boats = [
        { name: 'Portaaviones', spaces: 5 },
        { name: 'Acorazado', spaces: 4 },
        { name: 'Crucero', spaces: 3 },
        { name: 'Submarino', spaces: 3 },
        { name: 'Destructor', spaces: 2 },
    ];
    res.json({ boats });
});

// Endpoint POST /login
app.post('/login', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'El nombre de usuario es requerido.' });
    }

    const users = readUsers();

    if (users[username]) {
        // Usuario existente, devolver su clave
        return res.json({ key: users[username] });
    } else {
        // Crear una nueva clave única
        const key = Math.floor(100 + Math.random() * 900).toString(); // Generar clave de 3 dígitos
        users[username] = key;
        writeUsers(users);
        return res.json({ key });
    }
});

const activePlayers = new Map(); // Añadir este mapeo para relacionar socket.id con playerName

// Manejar conexiones de Socket.IO
io.on('connection', socket => {
    console.log('Cliente conectado:', socket.id);

    // Manejar registro de playerName
    socket.on('registerPlayer', ({ playerName }) => {
        if (playerName) {
            activePlayers.set(socket.id, playerName); // Asignar playerName al socket.id
            console.log(`Jugador registrado: ${playerName} con ID: ${socket.id}`);
        }
    });

    // Manejar creación de sala
    socket.on('createRoom', () => {
        const playerName = activePlayers.get(socket.id); // Obtener playerName desde activePlayers
        if (!playerName) {
            socket.emit('error', { message: 'PlayerName no registrado.' });
            return;
        }

        let roomCode;
        try {
            roomCode = generateRoomCode();
        } catch (error) {
            socket.emit('error', { message: error.message });
            return;
        }

        rooms[roomCode] = {
            players: [
                { socketId: socket.id, playerName, ready: false }
            ],
            timer: null
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
        io.to(roomCode).emit('updatePlayers', { players: rooms[roomCode].players });

        console.log(`Sala creada: ${roomCode} por jugador: ${playerName}`);

        // Iniciar temporizador de 60 segundos solo si hay al menos dos jugadores
        if (rooms[roomCode].players.length >= 2) {
            rooms[roomCode].timer = setTimeout(() => {
                io.to(roomCode).emit('startGame');
            }, 60000); // 60 segundos
        } else {
            socket.emit('waitingForPlayers', { message: 'Esperando a más jugadores para iniciar el juego.' });
        }
    });

    // Manejar unión a sala
    socket.on('joinRoom', ({ roomCode }) => {
        const playerName = activePlayers.get(socket.id); // Obtener playerName desde activePlayers
        if (!playerName) {
            socket.emit('error', { message: 'PlayerName no registrado.' });
            return;
        }

        const room = rooms[roomCode];
        if (room) {
            if (room.players.length >= 4) {
                socket.emit('error', { message: 'La sala está llena.' });
                return;
            }
            room.players.push({ socketId: socket.id, playerName, ready: false });
            socket.join(roomCode);
            socket.emit('roomJoined', { roomCode, players: room.players });
            io.to(roomCode).emit('updatePlayers', { players: room.players });

            // Iniciar o reiniciar temporizador solo si hay al menos dos jugadores
            if (room.players.length >= 2 && !room.timer) {
                room.timer = setTimeout(() => {
                    io.to(roomCode).emit('startGame');
                }, 60000); // 60 segundos
            } else if (room.players.length >= 2 && room.timer) {
                clearTimeout(room.timer);
                room.timer = setTimeout(() => {
                    io.to(roomCode).emit('startGame');
                }, 60000);
            }

            // Emitir mensaje de espera si hay menos de dos jugadores
            if (room.players.length < 2) {
                socket.emit('waitingForPlayers', { message: 'Esperando a más jugadores para iniciar el juego.' });
            }
        } else {
            socket.emit('error', { message: 'Código de sala inválido.' });
        }
    });

    // Manejar evento de salir de sala
    socket.on('leaveRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (room) {
            // Encontrar el índice del jugador en la sala
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                // Remover al jugador de la sala
                room.players.splice(playerIndex, 1);
                socket.leave(roomCode);
                console.log(`Jugador ${playerName} ha salido de la sala ${roomCode}`);

                // Notificar a los demás jugadores en la sala
                io.to(roomCode).emit('playerLeft', { players: room.players });

                if (room.players.length === 0) {
                    // Eliminar la sala si está vacía
                    delete rooms[roomCode];
                    console.log(`Sala ${roomCode} eliminada porque está vacía.`);
                } else {
                    // Actualizar la lista de jugadores en la sala
                    io.to(roomCode).emit('updatePlayers', { players: room.players });
                }
            }
        }
    });

    // Manejar toggle de estado de preparación
    socket.on('toggleReady', ({ roomCode, ready }) => {
        const room = rooms[roomCode];
        const playerName = activePlayers.get(socket.id); // Obtener playerName desde activePlayers
        if (room && playerName) {
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.ready = ready;
                io.to(roomCode).emit('updatePlayers', { players: room.players });
                console.log(`Jugador ${playerName} está ${ready ? 'Preparado' : 'No Preparado'}`);

                // Verificar si todos están listos
                const allReady = room.players.every(p => p.ready);
                if (allReady) {
                    clearTimeout(room.timer);
                    io.to(roomCode).emit('startGame');
                }
            }
        }
    });

    // Manejar inicio de juego manual
    socket.on('triggerStartGame', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            clearTimeout(room.timer);
            io.to(roomCode).emit('startGame');
        }
    });

    // Manejar evento para iniciar la partida
    socket.on('startGame', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room) {
            io.to(roomCode).emit('initiateGame');
            // Aquí puedes inicializar la lógica del juego, distribuir turnos, etc.
        }
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
        const playerName = activePlayers.get(socket.id);
        activePlayers.delete(socket.id); // Eliminar del mapeo activePlayers

        // Buscar y eliminar al jugador de cualquier sala
        for (const [roomCode, room] of Object.entries(rooms)) {
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomCode).emit('updatePlayers', { players: room.players });

                if (room.players.length < 2 && room.timer) {
                    clearTimeout(room.timer);
                    room.timer = null;
                    io.to(roomCode).emit('waitingForPlayers', { message: 'Esperando a más jugadores para iniciar el juego.' });
                }

                // Si ya no hay jugadores, eliminar la sala
                if (room.players.length === 0) {
                    clearTimeout(room.timer);
                    delete rooms[roomCode];
                } else {
                    // Reiniciar temporizador si se desconecta un jugador y hay suficiente jugadores
                    if (room.players.length >= 2) {
                        if (room.timer) {
                            clearTimeout(room.timer);
                        }
                        room.timer = setTimeout(() => {
                            io.to(roomCode).emit('startGame');
                        }, 60000); // 60 segundos
                        io.to(roomCode).emit('resetWaitingTimer');
                    }
                }
                console.log(`Jugador ${playerName} desconectado y eliminado de la sala ${roomCode}`);
                break;
            }
        }
    });

    // Manejar envío de clave (existente)
    socket.on('sendKey', (key) => {
        console.log('Key recibida:', key);
        // Aquí puedes manejar la key recibida
    });

});

// Endpoint para obtener el número de jugadores en una sala
app.get('/rooms/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode;
    const room = rooms[roomCode];
    if (room) {
        res.json({ players: room.players });
    } else {
        res.status(404).json({ error: 'Sala no encontrada.' });
    }
});

// Iniciar el servidor en el puerto 3000
http.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});