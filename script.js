

document.addEventListener('DOMContentLoaded', function() {

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

    const asideContent = ships.map(ship => `
        <li class="p-2 bg-gray-200 rounded flex flex-col xl:flex-row items-start xl:items-center justify-between">
            <span>${ship.name}</span>
            <div class="flex space-x-1 mt-2 xl:mt-0 xl:ml-auto">
                ${'<div class="w-4 h-4 bg-blue-500 rounded-full"></div>'.repeat(ship.size)}
            </div>
        </li>
    `).join('');

    document.querySelector('aside').innerHTML = `<ul class="space-y-2">${asideContent}</ul>`;

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