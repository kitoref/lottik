// script.js

// --- Asset Definitions ---
// (Ensure these images exist in your project folder)
const CHARACTER_IMAGES = ['char1.png', 'char2.png', 'char3.png'];
const ITEM_IMAGES = ['apple.png', 'banana.png', 'carrot.png', 'tomato.png'];

// 1. Load Audio
let gameMusic = new Audio('game_music.mp3');
// 2. Set Looping
gameMusic.loop = true;


// --- DOM References ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const mobileControls = document.getElementById('mobile-controls');

// Screen references
const SCREENS = {
    mainMenu: document.getElementById('main-menu'),
    selectionMenu: document.getElementById('selection-menu'),
    highScores: document.getElementById('high-scores-screen'),
    gameOver: document.getElementById('game-over-screen')
};

// --- Game Constants & Variables ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let isGameActive = false;
let lives = 3;
let score = 0;
let slipperInterval;
let lastDifficulty = 'Easy';
let highScores = [];

// Global Image Objects
let selectedPlayerImage = new Image();
let selectedEnemyImage = new Image();
let slipperImage = new Image();
slipperImage.src = 'slipper.png'; // Ensure this exists

// Game Objects
let currentItem = null;
let player = { x: CANVAS_WIDTH / 2 - 25, y: CANVAS_HEIGHT - 60, width: 50, height: 50, speed: 5, color: 'blue' };
let enemy = { x: CANVAS_WIDTH / 2 - 30, y: 50, width: 60, height: 60 };
let slippers = [];

// Input State
const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, a: false, s: false, d: false
};

// --- HIGH SCORE SYSTEM ---
function loadHighScores() {
    const stored = localStorage.getItem('buyOrDieHighScores');
    highScores = stored ? JSON.parse(stored) : [];
}

function saveHighScores() {
    localStorage.setItem('buyOrDieHighScores', JSON.stringify(highScores));
}

function displayHighScores() {
    loadHighScores();
    const listContainer = document.getElementById('high-scores-list');
    listContainer.innerHTML = '';
    if (highScores.length === 0) {
        listContainer.innerHTML = '<p>No high scores yet.</p>';
        return;
    }
    const ol = document.createElement('ol');
    highScores.forEach(entry => {
        const li = document.createElement('li');
        const d = new Date(entry.timestamp);
        const dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
        li.textContent = `${entry.score} pts (${entry.difficulty}) - ${dateStr}`;
        ol.appendChild(li);
    });
    listContainer.appendChild(ol);
}

// --- UI & SCREEN MANAGEMENT ---

/**
 * Hides all screens and shows only the requested one.
 * If screenId is null, it shows the game (and mobile controls).
 */
function showScreen(screenId) {
    // Hide all overlays first
    Object.values(SCREENS).forEach(screen => screen.classList.remove('active'));
    mobileControls.style.display = 'none'; // Hide mobile controls by default

    if (screenId && SCREENS[screenId]) {
        SCREENS[screenId].classList.add('active');
        if (screenId === 'highScores') displayHighScores();

        // 5. Stop music when returning to any menu screen
        if (screenId === 'mainMenu' || screenId === 'gameOver' || screenId === 'highScores') {
            gameMusic.pause();
            gameMusic.currentTime = 0;
        }
    } else {
        // If no screen ID is passed, we are in-game
        mobileControls.style.display = 'grid';
    }
}

/**
 * Helper to generate a selection menu with buttons.
 */
function showSelectionMenu(title, options, callback) {
    const titleEl = document.getElementById('selection-title');
    const optionsEl = document.getElementById('selection-options');
    titleEl.textContent = title;
    optionsEl.innerHTML = ''; // Clear previous options

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'menu-button';
        btn.textContent = opt.label;
        btn.onclick = () => callback(opt.value);
        optionsEl.appendChild(btn);
    });

    showScreen('selectionMenu');
}

// --- GAME FLOW FUNCTIONS ---

function startCharSelect() {
    showSelectionMenu('CHOOSE YOUR PLAYER', [
        { label: 'Character 1', value: 0 },
        { label: 'Character 2', value: 1 },
        { label: 'Character 3', value: 2 }
    ], (val) => {
        selectedPlayerImage.src = CHARACTER_IMAGES[val];
        startEnemySelect();
    });
}

function startEnemySelect() {
    showSelectionMenu('CHOOSE YOUR ENEMY', [
        { label: 'Character 1', value: 0 },
        { label: 'Character 2', value: 1 },
        { label: 'Character 3', value: 2 }
    ], (val) => {
        selectedEnemyImage.src = CHARACTER_IMAGES[val];
        showScreen('mainMenu'); // Return to main menu after selection
    });
}

function startDifficultySelect() {
    showSelectionMenu('SELECT DIFFICULTY', [
        { label: 'Easy', value: 'Easy' },
        { label: 'Medium', value: 'Medium' },
        { label: 'Hard', value: 'Hard' }
    ], (val) => {
        startGame(val);
    });
}

function startGame(difficulty) {
    lastDifficulty = difficulty;
    lives = difficulty === 'Hard' ? 1 : (difficulty === 'Medium' ? 2 : 3);
    score = 0;
    player.x = CANVAS_WIDTH / 2 - player.width / 2;
    player.y = CANVAS_HEIGHT - player.height - 20;
    slippers = [];

    // 3. Start Music
    gameMusic.play();

    isGameActive = true;

    spawnItem();
    showScreen(null); // Hides menus, shows game & mobile controls

    if (slipperInterval) clearInterval(slipperInterval);
    slipperInterval = setInterval(throwSlipper, 1500);
}

function gameOver() {
    isGameActive = false;
    clearInterval(slipperInterval);
    slippers = [];

    // 4. Stop Music
    gameMusic.pause();
    gameMusic.currentTime = 0;

    // Check high score
    const lowestTop10 = highScores.length < 10 ? 0 : highScores[highScores.length - 1].score;
    if (score > lowestTop10) {
        highScores.push({ score, difficulty: lastDifficulty, timestamp: Date.now() });
        highScores.sort((a, b) => b.score - a.score);
        highScores = highScores.slice(0, 10);
        saveHighScores();
    }

    showScreen('gameOver');
}

// --- CORE GAME LOGIC ---

function spawnItem() {
    const size = 30;
    // Ensure item spawns away from enemy (minY = 150)
    const rX = Math.random() * (CANVAS_WIDTH - size);
    const rY = 150 + Math.random() * (CANVAS_HEIGHT - 150 - size);
    
    const imgPath = ITEM_IMAGES[Math.floor(Math.random() * ITEM_IMAGES.length)];
    const img = new Image();
    img.src = imgPath;

    currentItem = { x: rX, y: rY, width: size, height: size, points: 1, image: img };
}

function throwSlipper() {
    if (!isGameActive) return;
    const sW = 20, sH = 20;
    // Start from enemy center
    const sx = enemy.x + enemy.width/2 - sW/2;
    const sy = enemy.y + enemy.height/2 - sH/2;
    
    // Aim at player center
    const tx = player.x + player.width/2;
    const ty = player.y + player.height/2;
    const vx = tx - sx, vy = ty - sy;
    const dist = Math.sqrt(vx*vx + vy*vy);
    
    slippers.push({ x: sx, y: sy, width: sW, height: sH, dx: (vx/dist)*8, dy: (vy/dist)*8 });
}

function gameLoop() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (isGameActive) {
        // Movement
        if (keys.ArrowUp || keys.w) player.y -= player.speed;
        if (keys.ArrowDown || keys.s) player.y += player.speed;
        if (keys.ArrowLeft || keys.a) player.x -= player.speed;
        if (keys.ArrowRight || keys.d) player.x += player.speed;

        // Boundaries
        player.x = Math.max(0, Math.min(player.x, CANVAS_WIDTH - player.width));
        player.y = Math.max(0, Math.min(player.y, CANVAS_HEIGHT - player.height));

        // Update Slippers
        for (let i = slippers.length - 1; i >= 0; i--) {
            slippers[i].x += slippers[i].dx;
            slippers[i].y += slippers[i].dy;
            
            // Remove off-screen
            if (slippers[i].x < -50 || slippers[i].x > CANVAS_WIDTH+50 || 
                slippers[i].y < -50 || slippers[i].y > CANVAS_HEIGHT+50) {
                slippers.splice(i, 1);
                continue;
            }

            // Player Hit Detection
            if (AABB(player, slippers[i])) {
                lives--;
                player.color = 'red'; // Hit flash
                setTimeout(() => player.color = 'blue', 100);
                slippers.splice(i, 1);
                if (lives <= 0) gameOver();
            }
        }

        // Item Collection
        if (currentItem && AABB(player, currentItem)) {
            score += currentItem.points;
            spawnItem();
        }

        // Drawing
        drawSprite(selectedEnemyImage, enemy, 'red');
        drawSprite(selectedPlayerImage, player, player.color);
        slippers.forEach(s => drawSprite(slipperImage, s, 'green'));
        if (currentItem) drawSprite(currentItem.image, currentItem, 'yellow');
        drawUI();
    }
    requestAnimationFrame(gameLoop);
}

// Simple Axis-Aligned Bounding Box collision
function AABB(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Helper to draw image if loaded, else fallback color
function drawSprite(img, obj, fallbackColor) {
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
    } else {
        ctx.fillStyle = fallbackColor;
        ctx.beginPath();
        if (fallbackColor === 'yellow') { // circle for item fallback
             ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, obj.width/2, 0, Math.PI*2);
             ctx.fill();
        } else {
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        }
    }
}

function drawUI() {
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`Lives: ${lives}`, 10, 60);
}

// --- INPUT EVENT LISTENERS ---

// 1. Mouse/Touch for Mobile D-pad
function bindControl(btnId, keyName) {
    const btn = document.getElementById(btnId);
    const press = (e) => { e.preventDefault(); keys[keyName] = true; };
    const release = (e) => { e.preventDefault(); keys[keyName] = false; };
    
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release); // Handle dragging finger off button
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
}

bindControl('up-button', 'ArrowUp');
bindControl('down-button', 'ArrowDown');
bindControl('left-button', 'ArrowLeft');
bindControl('right-button', 'ArrowRight');

// 2. Keyboard controls (Desktop)
window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// 3. Menu Button Clicks
document.getElementById('start-button').addEventListener('click', startDifficultySelect);
document.getElementById('char-select-button').addEventListener('click', startCharSelect);
document.getElementById('high-scores-button').addEventListener('click', () => showScreen('highScores'));
document.getElementById('selection-back-button').addEventListener('click', () => showScreen('mainMenu'));
document.getElementById('high-scores-back-button').addEventListener('click', () => showScreen('mainMenu'));
document.getElementById('restart-button').addEventListener('click', () => startGame(lastDifficulty));
document.getElementById('main-menu-button').addEventListener('click', () => showScreen('mainMenu'));

// --- Initialization ---
loadHighScores();
showScreen('mainMenu');
gameLoop();