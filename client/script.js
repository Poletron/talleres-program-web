import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
const socket = io('http://localhost:3000');

document.addEventListener('DOMContentLoaded', function() {


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
    fetch('http://localhost:3000/boats')
        .then(response => response.json())
        .then(data => {
            const ships = data.boats.map(boat => ({
                name: boat.name,
                size: boat.spaces
            }));

            const asideContent = ships.map(ship => `
                <li class="p-2 bg-gray-200 rounded flex flex-col xl:flex-row items-start xl:items-center justify-between">
                    <span>${ship.name}</span>
                    <div class="flex space-x-1 mt-2 xl:mt-0 xl:ml-auto">
                        ${'<div class="w-4 h-4 bg-blue-500 rounded-full"></div>'.repeat(ship.size)}
                    </div>
                </li>
            `).join('');

            document.querySelector('aside').innerHTML = `<ul class="space-y-2">${asideContent}</ul>`;
        })
        .catch(error => console.error('Error fetching boats:', error));

    // Pedir Key al ingresar
    document.querySelector('button.bg-blue-500').onclick = function() {
        const username = document.querySelector('input[type="text"]').value;
        fetch('http://localhost:3000/login', {
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

    //FIN TALLER 4
    
    // Navbar
    document.getElementById('nav-toggle').onclick = function() {
        document.getElementById('nav-dropdown').classList.toggle('hidden');
    };

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

    createBoard('tablero-1', true);
    createBoard('tablero-2', false);
});