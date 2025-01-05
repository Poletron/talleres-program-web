const express = require('express');
const cors = require('cors'); // Importar el paquete cors
const fs = require('fs'); // Importar el módulo fs
const path = require('path'); // Importar el módulo path
const app = express();

// Configurar el middleware CORS
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ["GET", "POST"],
    credentials: true
}));

const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
        methods: ["GET", "POST"],
        credentials: true
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

io.on('connection', socket => {
    console.log('Cliente conectado:', socket.id);

    socket.on('sendKey', (key) => {
        console.log('Key recibida:', key);
        // Aquí puedes manejar la key recibida
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Iniciar el servidor en el puerto 3000
http.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});