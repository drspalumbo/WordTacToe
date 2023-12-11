let draggedItem = null;
let gameBoard = Array(9).fill("");
let unusedBlocks = ['X', 'X', 'X', 'X', 'X', 'O', 'O', 'O', 'O'];

document.addEventListener('DOMContentLoaded', () => {
    createBoard();
    createBlocks();
});

function createBoard() {
    const boardContainer = document.getElementById("board");
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.setAttribute("data-index", i);
        cell.addEventListener("dragover", allowDrop);
        cell.addEventListener("drop", drop);
        cell.addEventListener("dragleave", dragLeave);
        cell.addEventListener("click", clickCell); // Added click event
        boardContainer.appendChild(cell);
    }
}

function createBlocks() {
    const blocksContainer = document.getElementById("blocks");
    blocksContainer.innerHTML = "";  // Clear existing blocks

    unusedBlocks.forEach((blockType, index) => {
        const block = document.createElement("div");
        block.classList.add("block");
        block.textContent = blockType;
        block.setAttribute("draggable", true);
        block.setAttribute("data-block-index", index);
        block.addEventListener("dragstart", dragStart);
        blocksContainer.appendChild(block);
    });
}

function dragStart(event) {
    draggedItem = event.target;
}

function allowDrop(event) {
    event.preventDefault();

    const cell = event.target.closest('.cell');
    if (cell && !cell.textContent && draggedItem) {
        cell.classList.add("empty-drag-over");
    }
}

function dragLeave(event) {
    const cell = event.target.closest('.cell');
    if (cell) {
        cell.classList.remove("empty-drag-over");
    }
}

function drop(event) {
    event.preventDefault();

    const cell = event.target.closest('.cell');
    if (cell && !cell.textContent && draggedItem) {
        const index = parseInt(cell.getAttribute("data-index"));
        const blockIndex = parseInt(draggedItem.getAttribute("data-block-index"));

        gameBoard[index] = draggedItem.textContent;
        unusedBlocks.splice(blockIndex, 1);

        cell.textContent = draggedItem.textContent;
        cell.classList.add("filled");
        draggedItem.remove();
        draggedItem = null;

        cell.classList.remove("empty-drag-over");
        checkGameResult();
    }
}

function clickCell(event) {
    const cell = event.target;
    const index = parseInt(cell.getAttribute("data-index"));
    const blockType = gameBoard[index];

    if (blockType && unusedBlocks.length < 9) {
        unusedBlocks.push(blockType);
        gameBoard[index] = "";
        cell.textContent = "";
        cell.classList.remove("filled");  // Remove the filled class
        createBlocks();
    }
}

function checkGameResult() {
    if (isWinner("X")) {
        alert("Player X wins!");
        resetGame();
    } else if (isWinner("O")) {
        alert("Player O wins!");
        resetGame();
    } else if (isBoardFull()) {
        alert("It's a draw!");
        resetGame();
    }
}

function isWinner(player) {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    return winningCombinations.some(combination => {
        const [a, b, c] = combination;
        return gameBoard[a] === player && gameBoard[b] === player && gameBoard[c] === player;
    });
}

function isBoardFull() {
    return gameBoard.every(cell => cell !== "");
}

function resetGame() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.textContent = "";
        cell.classList.remove("filled");
    });

    draggedItem = null;

    gameBoard = Array(9).fill("");
    unusedBlocks = ['X', 'X', 'X', 'X', 'X', 'O', 'O', 'O', 'O'];

    createBlocks();
}
