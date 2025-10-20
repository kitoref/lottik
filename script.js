// script.js

// --- Asset Definitions ---
const CHARACTER_IMAGES = ['char1.png', 'char2.png', 'char3.png'];
const ITEM_IMAGES = ['apple.png', 'banana.png', 'carrot.png', 'tomato.png'];

// 1. Get canvas and context, define constants
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Set the canvas dimensions explicitly
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Get references to the overlay screens and their content areas
const mainMenu = document.getElementById('main-menu');
const mainMenuTitle = mainMenu.querySelector('h1');
const mainMenuText1 = mainMenu.querySelector('p:nth-of-type(1)');
const mainMenuText2 = mainMenu.querySelector('p:nth-of-type(2)');

const highScoresScreen = document.getElementById('high-scores-screen');
const highScoresListContainer = document.getElementById('high-scores-list') || document.createElement('div');
highScoresListContainer.id = 'high-scores-list';
if (!document.getElementById('high-scores-list')) highScoresScreen.appendChild(highScoresListContainer);

const gameOverScreen = document.getElementById('game-over-screen');

// Game state and variables
let isGameActive = false;
let lives = 3;
let score = 0;
let slipperInterval;
let lastDifficulty = 'Easy';
let highScores = [];

// Menu State flags
let selectingDifficulty = false;
let selectingPlayer = false; // 2a. New state for player selection
let selectingEnemy = false; // 2c. New state for enemy selection

// 1. Global Image Objects
let selectedPlayerImage = new Image();
let selectedEnemyImage = new Image();
let slipperImage = new Image();
slipperImage.src = 'slipper.png';

// Global object for the collectible item
let currentItem = null;

// Player Object
let player = {
    x: (CANVAS_WIDTH / 2) - 25,
    y: CANVAS_HEIGHT - 60,
    width: 50,
    height: 50,
    speed: 5,
    color: 'blue' // Color kept as fallback/hit effect
};

// Enemy Object
let enemy = {
    x: (CANVAS_WIDTH / 2) - 30,
    y: 50,
    width: 60,
    height: 60
};

// Global array for slippers
let slippers = [];

// Dictionary to track key states for movement
const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, a: false, s: false, d: false
};

// --- High Score Functions (Unchanged) ---
function loadHighScores() {
    const storedScores = localStorage.getItem('buyOrDieHighScores');
    highScores = storedScores ? JSON.parse(storedScores) : [];
}

function saveHighScores() {
    localStorage.setItem('buyOrDieHighScores', JSON.stringify(highScores));
}

function displayHighScores() {
    loadHighScores();
    const container = highScoresListContainer;
    container.innerHTML = highScores.length === 0 ? '<p>No high scores yet. Be the first!</p>' : '';
    const list = document.createElement('ol');
    highScores.forEach(scoreEntry => {
        const listItem = document.createElement('li');
        const date = new Date(scoreEntry.timestamp);
        const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        listItem.textContent = `Score: ${scoreEntry.score} - Difficulty: ${scoreEntry.difficulty} - ${formattedDate}`;
        list.appendChild(listItem);
    });
    if (highScores.length > 0) container.appendChild(list);
}

// --- Menu State Functions ---

function resetMainMenuText() {
    mainMenuText1.textContent = 'Press SPACE to Start';
    mainMenuText2.textContent = 'Press H for High Scores / K for Character Select';
    selectingDifficulty = false;
    selectingPlayer = false;
    selectingEnemy = false;
}

/**
 * 2a. Shows the player selection prompt on the main menu.
 */
function showPlayerSelectScreen() {
    selectingPlayer = true;
    selectingDifficulty = false; // Ensure difficulty is off
    selectingEnemy = false;      // Ensure enemy select is off
    mainMenuTitle.textContent = 'CHOOSE YOUR PLAYER';
    mainMenuText1.textContent = '1: Char1 | 2: Char2 | 3: Char3';
    mainMenuText2.textContent = 'Press ESC to return';
}

/**
 * 2c. Shows the enemy selection prompt on the main menu.
 */
function showEnemySelectScreen() {
    selectingEnemy = true;
    selectingPlayer = false; // Turn off player select
    mainMenuTitle.textContent = 'CHOOSE YOUR ENEMY';
    mainMenuText1.textContent = '1: Char1 | 2: Char2 | 3: Char3';
    mainMenuText2.textContent = 'Press ESC to return';
}

/**
 * Starts the difficulty selection prompt (reusing old logic)
 */
function startDifficultySelect() {
    selectingDifficulty = true;
    selectingPlayer = false;
    selectingEnemy = false;
    mainMenuTitle.textContent = 'BUY OR DIE';
    mainMenuText1.textContent = 'Select Difficulty:';
    mainMenuText2.textContent = '(1) Easy (2) Medium (3) Hard';
}


function showScreen(screenId) {
    mainMenu.style.display = 'none';
    highScoresScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';

    if (screenId === 'main-menu') {
        resetMainMenuText();
        mainMenu.style.display = 'flex';
    } else if (screenId === 'high-scores-screen') {
        displayHighScores();
        highScoresScreen.style.display = 'flex';
    } else if (screenId) {
        const screenToShow = document.getElementById(screenId);
        if (screenToShow) screenToShow.style.display = 'flex';
    }
}

function startGame(difficulty) {
    lastDifficulty = difficulty;
    // ... (rest of the startGame logic is mostly unchanged)
    switch (difficulty) {
        case 'Easy': lives = 3; break;
        case 'Medium': lives = 2; break;
        case 'Hard': lives = 1; break;
        default: lives = 3;
    }

    score = 0;
    player.x = (CANVAS_WIDTH / 2) - (player.width / 2);
    player.y = CANVAS_HEIGHT - player.height - 20;
    player.color = 'blue';

    slippers = [];
    isGameActive = true;
    selectingDifficulty = false;
    showScreen(null);

    spawnItem();

    if (slipperInterval) clearInterval(slipperInterval);
    slipperInterval = setInterval(throwSlipper, 1500);
}

function gameOver() {
    isGameActive = false;
    clearInterval(slipperInterval);
    slippers = [];

    const worstHighScore = highScores.length < 10 ? 0 : highScores[highScores.length - 1].score;
    if (score > worstHighScore) {
        const newScore = { score: score, difficulty: lastDifficulty, timestamp: Date.now() };
        highScores.push(newScore);
        highScores.sort((a, b) => b.score - a.score);
        if (highScores.length > 10) highScores = highScores.slice(0, 10);
        saveHighScores();
    }

    showScreen('game-over-screen');
}


// --- Drawing Functions (Updated to use Images) ---

/**
 * 3a. Draws the player using the selected image.
 */
function drawPlayer() {
    if (selectedPlayerImage.complete && selectedPlayerImage.naturalWidth !== 0) {
        ctx.drawImage(selectedPlayerImage, player.x, player.y, player.width, player.height);
    } else {
        // Fallback or hit effect drawing
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
}

/**
 * 3b. Draws the enemy using the selected image.
 */
function drawEnemy() {
    if (selectedEnemyImage.complete && selectedEnemyImage.naturalWidth !== 0) {
        ctx.drawImage(selectedEnemyImage, enemy.x, enemy.y, enemy.width, enemy.height);
    } else {
        ctx.fillStyle = 'red'; // Fallback
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }
}

/**
 * 3c. Draws all active slippers using the slipper image.
 */
function drawSlippers() {
    for (const slipper of slippers) {
        if (slipperImage.complete && slipperImage.naturalWidth !== 0) {
            ctx.drawImage(slipperImage, slipper.x, slipper.y, slipper.width, slipper.height);
        } else {
            ctx.fillStyle = 'green'; // Fallback
            ctx.fillRect(slipper.x, slipper.y, slipper.width, slipper.height);
        }
    }
}

/**
 * 3e. Draws the current item using its randomly selected image.
 */
function drawItem() {
    if (currentItem && currentItem.image.complete && currentItem.image.naturalWidth !== 0) {
        ctx.drawImage(currentItem.image, currentItem.x, currentItem.y, currentItem.width, currentItem.height);
    } else if (currentItem) {
        // Fallback to the old yellow circle if image hasn't loaded yet
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        const radius = currentItem.width / 2;
        ctx.arc(currentItem.x + radius, currentItem.y + radius, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawUI() {
    ctx.fillStyle = 'black';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`Lives: ${lives}`, 10, 60);
}

// --- Game Logic ---

/**
 * 3d. Creates and places a new collectible item with a random image.
 */
function spawnItem() {
    const itemWidth = 30;
    const itemHeight = 30;
    const minY = 150;
    const randX = Math.random() * (CANVAS_WIDTH - itemWidth);
    const randY = minY + (Math.random() * (CANVAS_HEIGHT - minY - itemHeight));

    // 3d. Randomly select an image path
    const randomImagePath = ITEM_IMAGES[Math.floor(Math.random() * ITEM_IMAGES.length)];
    const itemImage = new Image();
    itemImage.src = randomImagePath;

    currentItem = {
        x: randX,
        y: randY,
        width: itemWidth,
        height: itemHeight,
        points: 1,
        image: itemImage // Store the Image object
    };
}

function throwSlipper() {
    if (!isGameActive) return;
    const slipper = { x: enemy.x + enemy.width / 2 - 10, y: enemy.y + enemy.height / 2 - 10, width: 20, height: 20, dx: 0, dy: 0 };
    const targetX = player.x + player.width / 2;
    const targetY = player.y + player.height / 2;
    const vecX = targetX - slipper.x;
    const vecY = targetY - slipper.y;
    const dist = Math.sqrt(vecX * vecX + vecY * vecY);
    slipper.dx = (vecX / dist) * 8;
    slipper.dy = (vecY / dist) * 8;
    slippers.push(slipper);
}

// --- Event Listeners (Updated for Character Selection) ---
window.addEventListener('keydown', (e) => {
    const key = e.key;

    if (!isGameActive) {
        const isMainMenuVisible = mainMenu.style.display === 'flex';
        const isGameOverVisible = gameOverScreen.style.display === 'flex';

        if (isMainMenuVisible) {
            // Player Selection Step
            if (selectingPlayer) {
                const charIndex = parseInt(key) - 1;
                if (charIndex >= 0 && charIndex < CHARACTER_IMAGES.length) {
                    selectedPlayerImage.src = CHARACTER_IMAGES[charIndex];
                    showEnemySelectScreen(); // Transition to Enemy Select
                } else if (key === 'Escape') {
                    resetMainMenuText();
                }
            }
            // Enemy Selection Step
            else if (selectingEnemy) {
                const charIndex = parseInt(key) - 1;
                if (charIndex >= 0 && charIndex < CHARACTER_IMAGES.length) {
                    selectedEnemyImage.src = CHARACTER_IMAGES[charIndex];
                    startDifficultySelect(); // Transition to Difficulty Select
                } else if (key === 'Escape') {
                    showPlayerSelectScreen(); // Go back to Player Select
                }
            }
            // Difficulty Selection Step
            else if (selectingDifficulty) {
                if (key === '1') startGame('Easy');
                else if (key === '2') startGame('Medium');
                else if (key === '3') startGame('Hard');
                else if (key === 'Escape') resetMainMenuText();
            }
            // Initial Main Menu Step
            else {
                if (key === ' ' || key.toLowerCase() === 'k') { // 4. 'K' option added
                    showPlayerSelectScreen();
                }
                if (key.toLowerCase() === 'h') showScreen('high-scores-screen');
            }
        } else if (isGameOverVisible) {
            if (key.toLowerCase() === 'r') startGame(lastDifficulty);
            if (key.toLowerCase() === 'm') showScreen('main-menu');
        } else { // On high scores screen
            if (key.toLowerCase() === 'm' || key === 'Escape') showScreen('main-menu');
        }
        return;
    }
    // Movement keys when game is active (Unchanged)
    if (e.key in keys) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
});


// --- Main Game Loop (Unchanged logic, uses updated drawing functions) ---
function gameLoop() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (isGameActive) {
        // Update positions (omitted for brevity, assume valid)
        if (keys.ArrowUp || keys.w) player.y -= player.speed;
        if (keys.ArrowDown || keys.s) player.y += player.speed;
        if (keys.ArrowLeft || keys.a) player.x -= player.speed;
        if (keys.ArrowRight || keys.d) player.x += player.speed;
        player.x = Math.max(0, Math.min(player.x, CANVAS_WIDTH - player.width));
        player.y = Math.max(0, Math.min(player.y, CANVAS_HEIGHT - player.height));
        slippers.forEach(s => { s.x += s.dx; s.y += s.dy; });
        slippers = slippers.filter(s => s.x + s.width > 0 && s.x < CANVAS_WIDTH && s.y + s.height > 0 && s.y < CANVAS_HEIGHT);

        // Player / Item collision
        if (currentItem && (player.x < currentItem.x + currentItem.width && player.x + player.width > currentItem.x && player.y < currentItem.y + currentItem.height && player.y + player.height > currentItem.y)) {
            score += currentItem.points;
            spawnItem();
        }

        // Player / Slipper collision
        for (let i = slippers.length - 1; i >= 0; i--) {
            const slipper = slippers[i];
            if (player.x < slipper.x + slipper.width && player.x + player.width > slipper.x && player.y < slipper.y + slipper.height && player.y + player.height > slipper.y) {
                lives--;
                player.color = 'red';
                setTimeout(() => { player.color = 'blue'; }, 100);
                slippers.splice(i, 1);
                break;
            }
        }

        if (lives <= 0) gameOver();

        // Draw everything
        drawEnemy();
        drawPlayer();
        drawSlippers();
        drawItem();
        drawUI();
    }

    window.requestAnimationFrame(gameLoop);
}

// --- Initialization ---
loadHighScores();
showScreen('main-menu');
gameLoop();