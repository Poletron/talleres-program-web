import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";

// Definir la IP del servidor
const SERVER_IP = 'http://192.168.0.175:3000';

// Inicializar la conexión Socket.IO usando SERVER_IP
const socket = io(SERVER_IP);

let playerName = ''; // Definir playerName en el ámbito global

document.addEventListener('DOMContentLoaded', function() {

    // Crear la pantalla de login dinámicamente
    function createLoginScreen() {
        const loginContainer = document.getElementById('login-container');
        loginContainer.innerHTML = `
            <div id="login-box">
                <h2>Iniciar Sesión</h2>
                <input type="text" id="username" placeholder="Nombre de usuario">
                <button id="login-button">Ingresar</button>
                <div id="key-display"></div>
            </div>
        `;

        document.getElementById('login-button').onclick = handleLogin;

        // Añadir evento para detectar la tecla Enter en el input de username
        document.getElementById('username').addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                handleLogin();
            }
        });
    }

    // Manejar el evento de login
    function handleLogin() {
        playerName = document.getElementById('username').value.trim(); // Asignar a la variable global
        if (!playerName) {
            alert('Por favor, ingresa un nombre de usuario.');
            return;
        }

        // Guardar playerName en localStorage
        localStorage.setItem('playerName', playerName);

        fetch(`${SERVER_IP}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: playerName }) // Usar playerName
        })
        .then(response => response.json())
        .then(data => {
            if (data.key) {
                // Mostrar la clave al usuario
                document.getElementById('key-display').textContent = `Tu clave es: ${data.key}`;
                // Guardar la clave en localStorage
                localStorage.setItem('KEY', data.key);
                // Ocultar la pantalla de login después de un breve retraso
                setTimeout(() => {
                    document.getElementById('login-container').style.display = 'none';
                    initializeGame();
                }, 2000);
                // Emitir evento para registrar playerName en el servidor
                socket.emit('registerPlayer', { playerName });
            } else {
                alert('Error al obtener la clave.');
            }
        })
        .catch(error => console.error('Error al iniciar sesión:', error));
    }

    // Inicializar el juego después del login
    function initializeGame() {
        //INICIO TALLER 4
        // Reemplazar conexión WebSocket con Socket.IO
        

        socket.on('connect', () => {
            console.log('Conectado al servidor Socket.IO');
        });

        socket.on('message', function(event) {
            console.log('Mensaje del servidor WebSocket:', event.data);
        });

        fetch

        // Pedir y mostrar botes
        fetch(`${SERVER_IP}/boats`)
            .then(response => response.json())
            .then(data => {
                const ships = data.boats.map(boat => ({
                    name: boat.name,
                    size: boat.spaces
                }));

                const aside = document.getElementById('boats-aside'); // Cambiado a un ID específico
                if (aside) {
                    const asideContent = ships.map(ship => `
                        <li class="p-2 bg-gray-200 rounded flex flex-col xl:flex-row items-start xl:items-center justify-between">
                            <span>${ship.name}</span>
                            <div class="flex space-x-1 mt-2 xl:mt-0 xl:ml-auto">
                                ${'<div class="w-4 h-4 bg-blue-500 rounded-full"></div>'.repeat(ship.size)}
                            </div>
                        </li>
                    `).join('');
                    aside.innerHTML = `<ul class="space-y-2">${asideContent}</ul>`;
                } else {
                    console.error('Elemento #boats-aside no encontrado.');
                }
            })
            .catch(error => console.error('Error fetching boats:', error));

        // Pedir Key al ingresar
        document.querySelector('button.bg-blue-500').onclick = function() {
            const username = document.querySelector('input[type="text"]').value;
            fetch(`${SERVER_IP}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            })
            .then(response => response.json())
            .then(data => {
                localStorage.setItem('KEY', data.key);
            })
            .catch(error => console.error('Error logging in:', error));
            //imprimir la key
            console.log(localStorage.getItem('KEY'));
            
        };

        // Modificar el envío de la key
        document.querySelector('button.bg-green-500').onclick = function() {
            const key = localStorage.getItem('KEY');
            if (key) {
                socket.emit('sendKey', key);
            } else {
                console.error('No se encontró la KEY en el almacenamiento local.');
            }
        };

        // Mostrar y ocultar secciones
        function showSection(sectionId) {
            document.querySelectorAll('main > section').forEach(section => {
                if (section.id === sectionId) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            });
        }

        // Manejar creación de sala
        document.getElementById('create-room-button').onclick = function() {
            const storedPlayerName = localStorage.getItem('playerName');
            socket.emit('createRoom', { playerName: storedPlayerName }); // Usar playerName almacenado
            showSection('waiting-room');
        };

        // Manejar unirse a sala
        document.getElementById('join-room-button').onclick = function() {
            const roomCode = document.getElementById('join-room-code').value.trim();
            const storedPlayerName = localStorage.getItem('playerName');
            if (roomCode && storedPlayerName) {
                socket.emit('joinRoom', { roomCode, playerName: storedPlayerName }); // Usar playerName almacenado
                showSection('waiting-room');
            } else {
                alert('Por favor, ingresa un código de sala válido y asegúrate de haber iniciado sesión.');
            }
        };

        // Añadir manejador para el botón "Salir de la sala"
        document.getElementById('leave-room-button').onclick = function() {
            const roomCode = localStorage.getItem('roomCode');
            if (roomCode) {
                socket.emit('leaveRoom', { roomCode, playerName: localStorage.getItem('playerName') });
                // Limpiar almacenamiento local
                localStorage.removeItem('roomCode');
                // Volver a la selección de sala
                showSection('room-selection');
                // Opcional: Mostrar mensaje de salida
                alert('Has salido de la sala.');
            } else {
                alert('No estás actualmente en ninguna sala.');
            }
        };

        // Manejar evento de actualización de jugadores después de salir
        socket.on('playerLeft', (data) => {
            const { players } = data;
            renderPlayersList(players);
            if (players.length === 0) {
                // Opcional: Redirigir o mostrar mensaje si la sala ha sido eliminada
                alert('Todas las personas han salido. La sala ha sido eliminada.');
                showSection('room-selection');
            }
        });

        // Recibir confirmación de creación de sala
        socket.on('roomCreated', (data) => {
            const { roomCode, players } = data;
            localStorage.setItem('roomCode', roomCode);
            document.getElementById('room-code-display').textContent = roomCode;
            showSection('waiting-room');
            renderPlayersList(players);
            
        });

        // Recibir confirmación de unión a sala
        socket.on('roomJoined', (data) => {
            const { roomCode, players } = data;
            localStorage.setItem('roomCode', roomCode);
            document.getElementById('room-code-display').textContent = roomCode;
            renderPlayersList(players);
            showSection('waiting-room');
            
            if (players.length >= 2) {
                startWaitingRoomTimer();
            } 
        });

        // Recibir mensaje de espera por más jugadores
        socket.on('waitingForPlayers', (data) => {
            alert(data.message);
        });

        // Actualizar lista de jugadores en la sala
        socket.on('updatePlayers', (data) => {
            const { players } = data;
            renderPlayersList(players);
            
            if (players.length >= 2 && !waitingTimer) {
                startWaitingRoomTimer();
            } else if (players.length < 2 && waitingTimer) {
                clearInterval(waitingTimer);
                waitingTimer = null;
                document.getElementById('time-remaining').textContent = '60';
                document.getElementById('timer-bar').style.width = '0%';
            }
        });

        // Manejar inicio del juego
        socket.on('startGame', () => {
            showSection('game-phase'); // Cambiado de 'deployment-phase' a 'game-phase'
            initializeDeploymentPhase();
        });

        // Función para renderizar la lista de jugadores
        function renderPlayersList(players) {
            const playersList = document.getElementById('players-list');
            playersList.innerHTML = '';
            players.forEach(player => {
                const li = document.createElement('li');
                li.textContent = `${player.playerName} - ${player.ready ? 'Preparado' : 'No Preparado'}`;
                li.style.color = player.ready ? 'green' : 'red';
                playersList.appendChild(li);
            });
        }

        // Manejar botón de preparación
        let isReady = false;
        document.getElementById('ready-button').onclick = function() {
            const roomCode = localStorage.getItem('roomCode');
            if (!roomCode) {
                alert('No estás en ninguna sala.');
                return;
            }

            // Verificar el número de jugadores en la sala antes de cambiar el estado de listo
            fetch(`${SERVER_IP}/rooms/${roomCode}`)
                .then(response => response.json())
                .then(data => {
                    const playerCount = data.players.length;
                    if (playerCount < 2) {
                        alert('Se requieren al menos 2 jugadores para iniciar el juego.');
                        // No cambiar el estado de listo
                    } else {
                        // Cambiar el estado de listo
                        isReady = !isReady;
                        this.textContent = isReady ? 'Preparado' : 'No Preparado';
                        this.classList.toggle('bg-green-500');
                        this.classList.toggle('bg-red-500');
                        socket.emit('toggleReady', { roomCode: roomCode, playerName, ready: isReady });
                    }
                })
                .catch(error => {
                    console.error('Error al verificar el número de jugadores:', error);
                    alert('Error al verificar el número de jugadores.');
                });
        };

        // Función para manejar mensajes de error del servidor
        socket.on('errorMessage', (data) => {
            alert(data.message);
        });

        // Temporizador y barra de progreso para la sala de espera
        let waitingTimer;
        let timeRemaining = 60;

        function startWaitingRoomTimer() {
            timeRemaining = 60;
            updateWaitingTimerUI();
            clearInterval(waitingTimer);
            waitingTimer = setInterval(() => {
                timeRemaining--;
                if (timeRemaining <= 0) {
                    clearInterval(waitingTimer);
                    waitingTimer = null;
                    socket.emit('triggerStartGame', { roomCode: localStorage.getItem('roomCode') });
                } else {
                    updateWaitingTimerUI();
                }
            }, 1000);
        }

        function updateWaitingTimerUI() {
            document.getElementById('time-remaining').textContent = timeRemaining;
            const progressBar = document.getElementById('timer-bar');
            progressBar.style.width = `${((60 - timeRemaining) / 60) * 100}%`;
        }

        // Reiniciar temporizador cuando un nuevo jugador se une
        socket.on('resetWaitingTimer', () => {
            startWaitingRoomTimer();
        });

        // Inicializar fase de despliegue
        function initializeDeploymentPhase() {
            toggleDeploymentButtons(true);

            // Mostrar el aside con los barcos
            const boatsAside = document.getElementById('boats-aside');
            if (boatsAside) {
                boatsAside.classList.remove('hidden');
                // ...existing code to populate boats...
            }

            // Mostrar el tablero del jugador y crear el tablero dinámicamente
            const playerBoard = document.getElementById('player-board');
            if (playerBoard) {
                playerBoard.classList.remove('hidden');
                createBoard('player-board', true); // Añadir esta línea
                // Ya se ha inicializado el tablero en 'initializeGame', no es necesario volver a crear
            }

            // Manejar el evento de rotación
            let isHorizontal = true;
            document.getElementById('rotate-button').onclick = function() {
                isHorizontal = !isHorizontal;
                this.textContent = isHorizontal ? 'Rotar a Vertical' : 'Rotar a Horizontal';
                // Aquí puedes agregar lógica adicional para cambiar la orientación de los barcos
            };

            // Manejar el evento de despliegue
            document.getElementById('deploy-button').onclick = function() {
                // Lógica para desplegar los barcos
                alert('Barcos desplegados');
                // Emitir evento al servidor para notificar el despliegue
                socket.emit('deployShips', { player: playerName, ships: playerShipsPositions });
                toggleDeploymentButtons(false);
                showSection('game-phase'); // Asegurar que la sección del juego está visible
            };
        }

        // Corregir la asignación de onclick asegurando que el elemento existe
        const deployButton = document.getElementById('deploy-button');
        if (deployButton) {
            deployButton.onclick = function() {
                // Lógica para desplegar los barcos
                alert('Barcos desplegados');
                // Emitir evento al servidor para notificar el despliegue
                socket.emit('deployShips', { player: playerName, ships: playerShipsPositions });
                toggleDeploymentButtons(false);
                showSection('game-phase'); // Mostrar la fase del juego
            };
        } else {
            console.error('Elemento #deploy-button no encontrado.');
        }

        //FIN TALLER 4
        
        // Navbar
      

        // Tableros
        function createBoard(boardId, isPlayerBoard) {
            const board = document.getElementById(boardId);
            const columns = Array.from({ length: 10 }, (_, i) => `<div class="bg-gray-200 py-1 md:py-4 border border-gray-300 text-center">${i + 1}</div>`).join('');
            board.innerHTML = `
                <div class="col-span-10 grid grid-cols-10 gap-1">${columns}</div>
                ${Array.from({ length: 10 }, () => `
                    <div class="col-span-10 grid grid-cols-10 gap-1">
                        ${Array.from({ length: 10 }, () => `
                            <div class="bg-white py-1 md:py-4 border border-gray-300 hover:bg-gray-200 flex items-center justify-center">
                                &nbsp;
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            `;

            if (!isPlayerBoard) {
                board.querySelectorAll('.col-span-10:not(:first-child) > div').forEach(cell => {
                    cell.addEventListener('click', function() {
                        this.innerHTML = '<div class="w-4 h-4 bg-red-500 rounded-full"></div>';
                    });
                });
            }
        }

        // Mostrar los botones de despliegue en la barra de navegación durante la fase de despliegue
        function toggleDeploymentButtons(show) {
            const deploymentButtons = document.getElementById('deployment-buttons');
            if (show) {
                deploymentButtons.classList.remove('hidden');
            } else {
                deploymentButtons.classList.add('hidden');
            }
        }

    }

    // Llamar a la función para crear la pantalla de login
    createLoginScreen();

});