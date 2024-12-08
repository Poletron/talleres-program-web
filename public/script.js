document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    const socket = new WebSocket(`ws://${window.location.hostname}:3000`);
    let playerName = '';
    let boardSize = 10;
    let selectedShip = null;
    let isHorizontal = true;
    let selectedCell = null;
    let gameStarted = false;
    let currentPlayerTurn = '';
    const playerShipsPositions = [];
    const playerShipsStatus = {}; // Add this to track player's ship statuses
    const opponents = [];
    let currentOpponentIndex = 0;

    // Variables for modals
    let deploymentModal;
    let waitingModal;

    // Variable to track if the player has deployed their ships
    let playerDeployed = false;

    // Create login section and set up event listeners
    createLoginSection();

    // WebSocket event handlers
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleSocketMessage(data);
    };

    // Function to create the login section
    function createLoginSection() {
        const loginSection = document.createElement('div');
        loginSection.id = 'login-section';
        loginSection.className = 'relative flex items-center justify-center h-screen bg-cover bg-center';
        loginSection.style.backgroundImage = "url('background.png')";
        loginSection.innerHTML = `
            <div class="absolute inset-0 bg-black opacity-50"></div>
            <div class="relative bg-white bg-opacity-75 p-6 rounded shadow-md w-full max-w-sm text-center">
                <h1 class="text-4xl font-bold mb-4">Batalla Naval</h1>
                <input type="text" id="player-name" class="p-2 border rounded w-full mb-4" placeholder="Nombre del jugador">
                <button id="login-button" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full">Ingresar</button>
            </div>
        `;
        document.body.appendChild(loginSection);

        // Event listeners for login
        document.getElementById('login-button').onclick = handleLogin;
        document.getElementById('player-name').onkeypress = (event) => {
            if (event.key === 'Enter') {
                handleLogin();
            }
        };
    }

    // Handle user login
    function handleLogin() {
        playerName = document.getElementById('player-name').value.trim();
        if (playerName) {
            socket.send(JSON.stringify({ type: 'login', playerName }));
            document.getElementById('login-section').remove();
            initializeGame();
        }
    }

    // Initialize game after login
    function initializeGame() {
        document.getElementById('main-content').classList.remove('hidden');
        socket.send(JSON.stringify({ type: 'getOpponents' }));
        socket.send(JSON.stringify({ type: 'getBoardState' }));
        renderAside();
        createBoard('tablero-1', true);
        createBoard('tablero-2', false);
    }

    // Handle incoming messages from the server
    function handleSocketMessage(data) {
        switch (data.type) {
            case 'boardState':
                renderBoardState(data.boardState);
                break;
            case 'attackResult':
                handleAttackResult(data);
                break;
            case 'startGame':
                gameStarted = true;
                showAlert('Todos los jugadores han desplegado sus barcos. ¡El juego comienza!');
                renderAside();
                break;
            case 'opponents':
                updateOpponentsList(data.opponents);
                initializeDefaultOpponent();
                break;
            case 'newPlayer':
                opponents.push(data.playerName);
                renderAside();
                break;
            case 'turn':
                currentPlayerTurn = data.playerName;
                renderAside();
                if (currentPlayerTurn === playerName) {
                    hideWaitingModal();
                } else {
                    showWaitingModal();
                }
                break;
            case 'deploymentStatus':
                // Only show the modal if the player has deployed their ships
                if (playerDeployed) {
                    showDeploymentModal(data.status);
                }
                break;
            case 'allPlayersReady':
                if (deploymentModal) {
                    deploymentModal.remove();
                }
                gameStarted = true;
                renderAside();
                showPlayerAndOpponentNames();
                break;
            case 'invalidTurn':
                showAlert(data.message);
                break;
            case 'gameOver':
                handleGameOver(data.result);
                break;
            case 'playerDefeated':
                handlePlayerDefeated(data.playerName);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    // Update the list of opponents
    function updateOpponentsList(opponentsList) {
        opponents.length = 0;
        opponents.push(...opponentsList.filter(opponent => opponent !== playerName));
        renderAside();
    }

    // Handle attack results
    function handleAttackResult({ position, hit, player, attackedPlayer, shipName }) {
        const [row, col] = position;
        if (player === playerName) {
            updateOpponentBoard(row, col, hit);
            updateLastAttackInfo(`Atacaste a ${attackedPlayer} en la posición [${row + 1}, ${col + 1}] y ${hit ? 'acertaste' : 'fallaste'}`);
        } else if (attackedPlayer === playerName) {
            updatePlayerBoard(row, col, hit);
            updateLastAttackInfo(`${player} te atacó en la posición [${row + 1}, ${col + 1}] y ${hit ? 'acertó' : 'falló'}`);
            if (hit && shipName) {
                // Update player's ship status
                if (!playerShipsStatus[shipName]) {
                    playerShipsStatus[shipName] = { hits: 0, size: getShipSize(shipName) };
                }
                playerShipsStatus[shipName].hits += 1;
                // Update the aside to reflect the change
                renderAside();
            }
        }
    }

    // Add helper function to get ship size by name
    function getShipSize(name) {
        const ship = ships.find(s => s.name === name);
        return ship ? ship.size : 0;
    }

    // Update player's own board with attack results
    function updatePlayerBoard(row, col, hit) {
        const cell = document.querySelector(`#tablero-1 [data-position="${row},${col}"]`);
        cell.innerHTML = `<div class="w-4 h-4 ${hit ? 'bg-black' : 'bg-gray-500'} rounded-full"></div>`;
    }

    // Update opponent's board with attack results
    function updateOpponentBoard(row, col, hit) {
        const cell = document.querySelector(`#tablero-2 [data-position="${row},${col}"]`);
        cell.innerHTML = `<div class="w-4 h-4 ${hit ? 'bg-red-500' : 'bg-gray-500'} rounded-full"></div>`;
    }

    // Render the board state
    function renderBoardState(boardState) {
        boardState.forEach((row, rowIndex) => {
            row.forEach((cellState, colIndex) => {
                const cell = document.querySelector(`#tablero-1 [data-position="${rowIndex},${colIndex}"]`);
                if (cellState === 'hit') {
                    cell.innerHTML = '<div class="w-4 h-4 bg-black rounded-full"></div>';
                } else if (cellState === 'miss') {
                    cell.innerHTML = '<div class="w-4 h-4 bg-gray-500 rounded-full"></div>';
                }
            });
        });
    }

    // Update the last attack information displayed
    function updateLastAttackInfo(message) {
        let lastAttackInfo = document.getElementById('last-attack-info');
        if (!lastAttackInfo) {
            lastAttackInfo = document.createElement('p');
            lastAttackInfo.id = 'last-attack-info';
            document.querySelector('aside').appendChild(lastAttackInfo);
        }
        lastAttackInfo.textContent = message;
    }

    // Navbar
    document.getElementById('nav-toggle').onclick = function() {
        document.getElementById('nav-dropdown').classList.toggle('hidden');
    };

    // Aside
    const ships = [
        { name: 'Portaaviones', size: 5 },
        { name: 'Acorazado', size: 4 },
        { name: 'Crucero', size: 3 },
        { name: 'Submarino', size: 3 },
        { name: 'Destructor', size: 2 }
    ];

    function renderAside() {
        const playerShips = ships.map(ship => {
            const hits = playerShipsStatus[ship.name] ? playerShipsStatus[ship.name].hits : 0;
            const circles = Array.from({ length: ship.size }, (_, i) => `
                <div class="w-4 h-4 ${i < hits ? 'bg-black' : 'bg-blue-500'} rounded-full"></div>
            `).join('');
            return `
                <li class="p-2 bg-gray-200 rounded flex flex-col xl:flex-row items-start xl:items-center justify-between">
                    <span>${ship.name}</span>
                    <div class="flex space-x-1 mt-2 xl:mt-0 xl:ml-auto">
                        ${circles}
                    </div>
                </li>
            `;
        }).join('');

        const opponentShips = ships.map(ship => `
            <li class="p-2 bg-gray-200 rounded flex flex-col xl:flex-row items-start xl:items-center justify-between">
                <span>${ship.name}</span>
                <div class="flex space-x-1 mt-2 xl:mt-0 xl:ml-auto">
                    ${'<div class="w-4 h-4 bg-red-500 rounded-full"></div>'.repeat(ship.size)}
                </div>
            </li>
        `).join('');

        const opponentName = opponents.length > 0 ? opponents[currentOpponentIndex] : 'No hay oponentes disponibles';

        document.querySelector('aside').innerHTML = `
            <h2 class="text-xl font-bold mb-2">${playerName}</h2>
            <ul class="space-y-2 mb-4">${playerShips}</ul>
            ${!gameStarted ? `
                <button id="rotate-button" class="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded w-full mb-2">Rotar (Horizontal)</button>
                <button id="deploy-button" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full">Desplegar</button>
                <button id="random-deploy-button" class="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded w-full">Desplegar Aleatoriamente</button>
            ` : ''}
            <div id="opponent-section" class="hidden">
                <h2 class="text-xl font-bold mb-2 flex justify-center items-center">
                    ${opponents.length > 1 ? '<button id="prev-opponent" class="text-gray-500 mr-2">&lt;</button>' : ''}
                    ${opponentName}
                    ${opponents.length > 1 ? '<button id="next-opponent" class="text-gray-500 ml-2">&gt;</button>' : ''}
                </h2>
                <ul class="space-y-2">${opponentShips}</ul>
            </div>
            <h3 class="text-lg font-bold mt-4">Oponentes</h3>
            <ul id="players-list" class="space-y-2">
                ${opponents.map(opponent => `<li class="opponent-item cursor-pointer">${opponent}</li>`).join('')}
            </ul>
            <h3 class="text-lg font-bold mt-4">Turno Actual</h3>
            <p>${currentPlayerTurn}</p>
            <h3 class="text-lg font-bold mt-4">Último Ataque</h3>
            <p id="last-attack-info">No hay ataques recientes.</p>
        `;

        if (!gameStarted) {
            document.querySelectorAll('aside li').forEach(li => {
                li.ondragstart = function(event) {
                    selectedShip = ships.find(ship => ship.name === this.dataset.ship);
                    const shipDiv = document.createElement('div');
                    shipDiv.className = 'dragging-ship';
                    shipDiv.style.position = 'absolute';
                    shipDiv.style.pointerEvents = 'none';
                    shipDiv.innerHTML = `
                        <div class="flex ${isHorizontal ? 'flex-row' : 'flex-col'}">
                            ${'<div class="w-4 h-4 bg-blue-500 rounded-full m-1"></div>'.repeat(selectedShip.size)}
                        </div>
                    `;
                    document.body.appendChild(shipDiv);
                    event.dataTransfer.setDragImage(shipDiv, 0, 0);
                };

                // Añadir eventos táctiles
                li.ontouchstart = function(event) {
                    selectedShip = ships.find(ship => ship.name === this.dataset.ship);
                    const shipDiv = document.createElement('div');
                    shipDiv.className = 'dragging-ship';
                    shipDiv.style.position = 'absolute';
                    shipDiv.style.pointerEvents = 'none';
                    shipDiv.innerHTML = `
                        <div class="flex ${isHorizontal ? 'flex-row' : 'flex-col'}">
                            ${'<div class="w-4 h-4 bg-blue-500 rounded-full m-1"></div>'.repeat(selectedShip.size)}
                        </div>
                    `;
                    document.body.appendChild(shipDiv);
                    event.dataTransfer.setDragImage(shipDiv, 0, 0);
                };
            });

            document.getElementById('rotate-button').onclick = function() {
                isHorizontal = !isHorizontal;
                this.textContent = isHorizontal ? 'Rotar (Horizontal)' : 'Rotar (Vertical)';
            };

            document.getElementById('deploy-button').onclick = function() {
                if (playerShipsPositions.length === ships.length) {
                    socket.send(JSON.stringify({ type: 'deploy', ships: playerShipsPositions }));
                    // Removed the alert
                    // showAlert('Barcos desplegados correctamente');

                    // Set playerDeployed to true after deploying
                    playerDeployed = true;

                    // Show the deployment modal after deploying ships
                    showDeploymentModal([{ playerName, deployed: true }]);

                    document.getElementById('opponent-section').classList.remove('hidden');
                    document.getElementById('tablero-2').classList.remove('hidden');
                    document.getElementById('deploy-button').remove();
                    document.getElementById('rotate-button').remove();
                    document.getElementById('random-deploy-button').remove();
                    document.querySelectorAll('aside li').forEach(li => {
                        li.classList.remove('bg-green-200');
                        li.classList.add('bg-gray-200');
                    });
                    renderAttackButton();
                } else {
                    showAlert('Debes desplegar todos los barcos antes de continuar');
                }
            };

            document.getElementById('random-deploy-button').onclick = function() {
                playerShipsPositions.length = 0; // Reset positions
                const board = document.getElementById('tablero-1');
                board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`).forEach(cell => {
                    cell.innerHTML = '&nbsp;';
                });

                ships.forEach(ship => {
                    let placed = false;
                    while (!placed) {
                        const isHorizontal = Math.random() >= 0.5;
                        const row = Math.floor(Math.random() * (boardSize - (isHorizontal ? 0 : ship.size)));
                        const col = Math.floor(Math.random() * (boardSize - (isHorizontal ? ship.size : 0)));
                        const positions = [];

                        let collision = false;
                        for (let i = 0; i < ship.size; i++) {
                            const currentRow = row + (isHorizontal ? 0 : i);
                            const currentCol = col + (isHorizontal ? i : 0);
                            const currentCell = board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[currentRow * boardSize + currentCol];
                            if (currentCell.innerHTML.includes('bg-blue-500')) {
                                collision = true;
                                break;
                            }
                            positions.push([currentRow, currentCol]);
                        }

                        if (!collision) {
                            playerShipsPositions.push({ name: ship.name, positions });
                            positions.forEach(([r, c]) => {
                                board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[r * boardSize + c].innerHTML = '<div class="w-4 h-4 bg-blue-500 rounded-full"></div>';
                            });
                            placed = true;
                        }
                    }
                });

                document.querySelectorAll('aside li').forEach(li => {
                    li.classList.add('bg-green-200');
                    li.classList.remove('bg-gray-200');
                });
            };

            if (opponents.length > 1) {
                document.getElementById('prev-opponent').onclick = function() {
                    currentOpponentIndex = (currentOpponentIndex - 1 + opponents.length) % opponents.length;
                    renderAside();
                };

                document.getElementById('next-opponent').onclick = function() {
                    currentOpponentIndex = (currentOpponentIndex + 1) % opponents.length;
                    renderAside();
                };
            }
        } else {
            renderAttackButton();
        }

        // Agregar eventos para seleccionar oponentes
        document.querySelectorAll('.opponent-item').forEach(item => {
            item.onclick = () => {
                selectOpponent(item.textContent);
            };
        });
    }

    // Función para seleccionar un oponente
    function selectOpponent(opponentName) {
        currentOpponentIndex = opponents.indexOf(opponentName);
        updateSelectedOpponent();
    }

    // Función para actualizar la selección de oponente
    function updateSelectedOpponent() {
        const selectedOpponent = opponents[currentOpponentIndex];
        document.getElementById('opponent-name-display').textContent = selectedOpponent;

        // Mostrar/ocultar flechas de navegación
        if (opponents.length > 1) {
            document.getElementById('opponent-navigation').innerHTML = `
                <button id="prev-opponent" class="text-gray-500">&lt;</button>
                <button id="next-opponent" class="text-gray-500">&gt;</button>
            `;
            document.getElementById('prev-opponent').onclick = () => {
                currentOpponentIndex = (currentOpponentIndex - 1 + opponents.length) % opponents.length;
                updateSelectedOpponent();
            };

            document.getElementById('next-opponent').onclick = () => {
                currentOpponentIndex = (currentOpponentIndex + 1) % opponents.length;
                updateSelectedOpponent();
            };
        } else {
            document.getElementById('opponent-navigation').innerHTML = '';
        }

        // Actualizar tablero 2
        socket.send(JSON.stringify({ type: 'getBoardStateForOpponent', opponent: selectedOpponent }));
    }

    // Inicializar selección de oponente por defecto
    function initializeDefaultOpponent() {
        if (opponents.length > 0) {
            currentOpponentIndex = 0;
            updateSelectedOpponent();
        }
    }

    function renderAttackButton() {
        if (!document.getElementById('attack-button')) {
            const attackButton = document.createElement('button');
            attackButton.id = 'attack-button';
            attackButton.textContent = 'Atacar';
            if (window.innerWidth < 1024) {
                const mainElement = document.querySelector('main');
                mainElement.insertAdjacentElement('beforeend', attackButton);
            } else {
                document.querySelector('aside').appendChild(attackButton);
            }
            attackButton.onclick = function() {
                if (selectedCell) {
                    if (currentPlayerTurn === playerName) {
                        const [row, col] = selectedCell.dataset.position.split(',').map(Number);
                        socket.send(JSON.stringify({ type: 'attack', opponent: opponents[currentOpponentIndex], position: [row, col] }));
                        selectedCell.classList.remove('cell-attack');
                        selectedCell = null;
                    } else {
                        showWaitingModal();
                    }
                } else {
                    showAlert('Selecciona una celda para atacar.');
                }
            };
        }
    }

    // Tableros
    function createBoard(boardId, isPlayerBoard) {
        const board = document.getElementById(boardId);
        const columns = Array.from({ length: boardSize }, (_, i) => `<div class="bg-gray-200 py-1 md:py-4 border border-gray-300 text-center">${i + 1}</div>`).join('');
        board.innerHTML = `
            <div class="col-span-${boardSize} grid grid-cols-${boardSize} gap-1">${columns}</div>
            ${Array.from({ length: boardSize }, (_, rowIndex) => `
                <div class="col-span-${boardSize} grid grid-cols-${boardSize} gap-1">
                    ${Array.from({ length: boardSize }, (_, colIndex) => `
                        <div class="bg-white py-1 md:py-4 border border-gray-300 hover:bg-gray-200 flex items-center justify-center" draggable="true" data-position="${rowIndex},${colIndex}">
                            &nbsp;
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;

        if (isPlayerBoard) {
            board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`).forEach(cell => {
                cell.ondragover = function(event) {
                    event.preventDefault();
                };

                cell.ondrop = function(event) {
                    event.preventDefault();
                    if (selectedShip) {
                        const cellIndex = Array.from(board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)).indexOf(this);
                        const row = Math.floor(cellIndex / boardSize);
                        const col = cellIndex % boardSize;

                        // Verificar colisiones y límites del tablero
                        const positions = [];
                        let collision = false;
                        if (isHorizontal) {
                            if (col + selectedShip.size > boardSize) {
                                showAlert('El barco se sale del tablero. Intenta en otra posición.');
                                return;
                            }
                            for (let i = 0; i < selectedShip.size; i++) {
                                const currentCol = col + i;
                                const currentCell = board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[row * boardSize + currentCol];
                                if (currentCell.innerHTML.includes('bg-blue-500')) {
                                    collision = true;
                                    break;
                                }
                                positions.push([row, currentCol]);
                            }
                        } else {
                            if (row + selectedShip.size > boardSize) {
                                showAlert('El barco se sale del tablero. Intenta en otra posición.');
                                return;
                            }
                            for (let i = 0; i < selectedShip.size; i++) {
                                const currentRow = row + i;
                                const currentCell = board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[currentRow * boardSize + col];
                                if (currentCell.innerHTML.includes('bg-blue-500')) {
                                    collision = true;
                                    break;
                                }
                                positions.push([currentRow, col]);
                            }
                        }

                        if (collision) {
                            showAlert('Colisión detectada. Intenta en otra posición.');
                            return;
                        }

                        // Borrar la ubicación anterior del barco
                        const existingShipIndex = playerShipsPositions.findIndex(ship => ship.name === selectedShip.name);
                        if (existingShipIndex !== -1) {
                            playerShipsPositions[existingShipIndex].positions.forEach(([r, c]) => {
                                board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[r * boardSize + c].innerHTML = '&nbsp;';
                            });
                            playerShipsPositions.splice(existingShipIndex, 1);
                        }

                        // Actualizar la nueva ubicación del barco
                        playerShipsPositions.push({ name: selectedShip.name, positions });
                        positions.forEach(([r, c]) => {
                            board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[r * boardSize + c].innerHTML = '<div class="w-4 h-4 bg-blue-500 rounded-full"></div>';
                        });

                        // Cambiar el fondo del contenedor del barco a verde
                        document.querySelector(`aside li[data-ship="${selectedShip.name}"]`).classList.add('bg-green-200');
                        document.querySelector(`aside li[data-ship="${selectedShip.name}"]`).classList.remove('bg-gray-200');

                        selectedShip = null;
                    }
                };

                cell.ondragstart = function(event) {
                    const cellIndex = Array.from(board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)).indexOf(this);
                    const row = Math.floor(cellIndex / boardSize);
                    const col = cellIndex % boardSize;

                    const ship = playerShipsPositions.find(ship => ship.positions.some(pos => pos[0] === row && pos[1] === col));
                    if (ship) {
                        selectedShip = ships.find(s => s.name === ship.name);
                        const shipDiv = document.createElement('div');
                        shipDiv.className = 'dragging-ship';
                        shipDiv.style.position = 'absolute';
                        shipDiv.style.pointerEvents = 'none';
                        shipDiv.innerHTML = `
                            <div class="flex ${isHorizontal ? 'flex-row' : 'flex-col'}">
                                ${'<div class="w-4 h-4 bg-blue-500 rounded-full m-1"></div>'.repeat(selectedShip.size)}
                            </div>
                        `;
                        document.body.appendChild(shipDiv);
                        event.dataTransfer.setDragImage(shipDiv, 0, 0);

                        // Borrar la ubicación anterior del barco
                        ship.positions.forEach(([r, c]) => {
                            board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[r * boardSize + c].innerHTML = '&nbsp;';
                        });
                        playerShipsPositions.splice(playerShipsPositions.indexOf(ship), 1);
                    }
                };

                // Añadir eventos táctiles
                cell.ontouchend = function(event) {
                    event.preventDefault();
                    if (selectedShip) {
                        const cellIndex = Array.from(board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)).indexOf(this);
                        const row = Math.floor(cellIndex / boardSize);
                        const col = cellIndex % boardSize;

                        // Verificar colisiones y límites del tablero
                        const positions = [];
                        let collision = false;
                        if (isHorizontal) {
                            if (col + selectedShip.size > boardSize) {
                                showAlert('El barco se sale del tablero. Intenta en otra posición.');
                                return;
                            }
                            for (let i = 0; i < selectedShip.size; i++) {
                                const currentCol = col + i;
                                const currentCell = board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[row * boardSize + currentCol];
                                if (currentCell.innerHTML.includes('bg-blue-500')) {
                                    collision = true;
                                    break;
                                }
                                positions.push([row, currentCol]);
                            }
                        } else {
                            if (row + selectedShip.size > boardSize) {
                                showAlert('El barco se sale del tablero. Intenta en otra posición.');
                                return;
                            }
                            for (let i = 0; i < selectedShip.size; i++) {
                                const currentRow = row + i;
                                const currentCell = board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[currentRow * boardSize + col];
                                if (currentCell.innerHTML.includes('bg-blue-500')) {
                                    collision = true;
                                    break;
                                }
                                positions.push([currentRow, col]);
                            }
                        }

                        if (collision) {
                            showAlert('Colisión detectada. Intenta en otra posición.');
                            return;
                        }

                        // Borrar la ubicación anterior del barco
                        const existingShipIndex = playerShipsPositions.findIndex(ship => ship.name === selectedShip.name);
                        if (existingShipIndex !== -1) {
                            playerShipsPositions[existingShipIndex].positions.forEach(([r, c]) => {
                                board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[r * boardSize + c].innerHTML = '&nbsp;';
                            });
                            playerShipsPositions.splice(existingShipIndex, 1);
                        }

                        // Actualizar la nueva ubicación del barco
                        playerShipsPositions.push({ name: selectedShip.name, positions });
                        positions.forEach(([r, c]) => {
                            board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`)[r * boardSize + c].innerHTML = '<div class="w-4 h-4 bg-blue-500 rounded-full"></div>';
                        });

                        // Cambiar el fondo del contenedor del barco a verde
                        document.querySelector(`aside li[data-ship="${selectedShip.name}"]`).classList.add('bg-green-200');
                        document.querySelector(`aside li[data-ship="${selectedShip.name}"]`).classList.remove('bg-gray-200');

                        selectedShip = null;
                    }
                };
            });
        } else {
            board.querySelectorAll(`.col-span-${boardSize}:not(:first-child) > div`).forEach(cell => {
                cell.addEventListener('click', function() {
                    if (selectedCell) {
                        selectedCell.innerHTML = '&nbsp;';
                        selectedCell.classList.remove('cell-attack');
                    }
                    this.classList.add('cell-attack');
                    this.innerHTML = '<div class="w-4 h-4 bg-red-500 rounded-full"></div>';
                    selectedCell = this;
                });
            });
        }
    }

    // Renderizar contenido principal solo después del login
    if (!document.getElementById('login-section').classList.contains('hidden')) {
        renderAside();
        createBoard('tablero-1', true);
        createBoard('tablero-2', false);
    }

    // Function to create modal windows
    function createModal(id, content) {
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                ${content}
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    // Replace alert functions with modals
    function showAlert(message) {
        const alertModal = createModal('alert-modal', `
            <p>${message}</p>
            <button id="alert-ok-button">OK</button>
        `);
        document.getElementById('alert-ok-button').onclick = () => {
            alertModal.remove();
        };
    }

    // Show deployment status modal
    function showDeploymentModal(status) {
        if (deploymentModal) {
            deploymentModal.remove();
        }
        const playersStatus = status.map(player => `
            <li>${player.playerName}: ${player.deployed ? 'Listo' : 'Desplegando'}</li>
        `).join('');
        deploymentModal = createModal('deployment-modal', `
            <h2>Esperando a que todos los jugadores desplieguen sus barcos</h2>
            <ul>${playersStatus}</ul>
        `);
    }

    // Show waiting modal during the game
    function showWaitingModal() {
        if (!waitingModal) {
            waitingModal = createModal('waiting-modal', `
                <p>Esperando a que sea tu turno...</p>
            `);
        }
    }

    // Remove waiting modal when it's the player's turn
    function hideWaitingModal() {
        if (waitingModal) {
            waitingModal.remove();
            waitingModal = null;
        }
    }

    // Function to handle game over event
    function handleGameOver(result) {
        if (result === 'victory') {
            showGameOverScreen('¡Has ganado el juego!');
        } else if (result === 'defeat') {
            showGameOverScreen('Has sido derrotado.');
        }
    }

    // Function to handle when another player is defeated
    function handlePlayerDefeated(playerName) {
        showAlert(`El jugador ${playerName} ha sido derrotado.`);
        opponents.splice(opponents.indexOf(playerName), 1);
        renderAside();
    }

    // Function to show the game over screen
    function showGameOverScreen(message) {
        const gameOverModal = createModal('game-over-modal', `
            <h2>${message}</h2>
            <button id="restart-button" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4">Jugar de Nuevo</button>
        `);
        document.getElementById('restart-button').onclick = () => {
            // Reload the page to restart the game
            location.reload();
        };
    }

    // Function to show player and opponent names above the boards
    function showPlayerAndOpponentNames() {
        const playerNameDisplay = document.createElement('h2');
        playerNameDisplay.id = 'player-name-display';
        playerNameDisplay.className = 'text-center font-bold mb-2';
        playerNameDisplay.textContent = playerName;
        document.querySelector('#tablero-1').insertAdjacentElement('beforebegin', playerNameDisplay);

        const opponentNameDisplay = document.createElement('h2');
        opponentNameDisplay.id = 'opponent-name-display';
        opponentNameDisplay.className = 'text-center font-bold mb-2 flex justify-center items-center';
        opponentNameDisplay.innerHTML = `
            ${opponents[currentOpponentIndex]}
            <span id="opponent-navigation" class="ml-2">
                ${opponents.length > 1 ? '<button id="prev-opponent" class="text-gray-500">&lt;</button>' : ''}
                ${opponents.length > 1 ? '<button id="next-opponent" class="text-gray-500">&gt;</button>' : ''}
            </span>
        `;
        document.querySelector('#tablero-2').insertAdjacentElement('beforebegin', opponentNameDisplay);

        if (opponents.length > 1) {
            document.getElementById('prev-opponent').onclick = () => {
                currentOpponentIndex = (currentOpponentIndex - 1 + opponents.length) % opponents.length;
                updateSelectedOpponent();
            };

            document.getElementById('next-opponent').onclick = () => {
                currentOpponentIndex = (currentOpponentIndex + 1) % opponents.length;
                updateSelectedOpponent();
            };
        }
    }
});