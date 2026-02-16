const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const HIGH_SCORE_KEY = "tetris-pro-high-score";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const overlayEl = document.getElementById("overlay");
const flashEl = document.getElementById("flash");
const hardModeToggle = document.getElementById("hardModeToggle");
const restartBtn = document.getElementById("restartBtn");
const muteBtn = document.getElementById("muteBtn");

canvas.width = COLS * BLOCK;
canvas.height = ROWS * BLOCK;

const COLORS = {
    I: "#00e5ff", J: "#3b5bff", L: "#ff922b",
    O: "#ffd43b", S: "#69db7c", T: "#b197fc", Z: "#ff6b6b"
};

const SHAPES = {
    I: [[1, 1, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    T: [[0, 1, 0], [1, 1, 1]],
    Z: [[1, 1, 0], [0, 1, 1]]
};

const LINE_POINTS = [0, 120, 360, 700, 1100];

let board, score, level, linesCleared, currentPiece, holdPiece, canHold, nextQueue, 
    dropCounter, lastTime, gameOver, hardMode, piecesPlaced, particles, muted = false;
let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);

const audioCtx = new (window.AudioContext || window.webkit.AudioContext)();

function playTone({ frequency = 440, duration = 0.1, type = "square", volume = 0.02 }) {
    if (muted || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
}

function playLineSound(lines) {
    [260, 330, 392, 523].slice(0, lines).forEach((freq, i) => {
        setTimeout(() => playTone({ frequency: freq, duration: 0.14, type: "triangle", volume: 0.03 }), i * 45);
    });
}

function levelDropSpeed() {
    const base = hardMode ? 780 : 1000;
    return Math.max(hardMode ? 120 : 150, base * Math.pow(0.86, level - 1));
}

function randomPiece() {
    const keys = Object.keys(SHAPES);
    const type = keys[Math.floor(Math.random() * keys.length)];
    return { shape: SHAPES[type], type, x: 3, y: 0 };
}

function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    level = hardMode ? 3 : 1;
    linesCleared = 0;
    currentPiece = null;
    holdPiece = null;
    canHold = true;
    nextQueue = [];
    dropCounter = 0;
    lastTime = 0;
    gameOver = false;
    piecesPlaced = 0;
    particles = [];
    overlayEl.classList.add("hidden");
    spawnPiece();
    updateHud();
}

function spawnPiece() {
    while (nextQueue.length < 5) nextQueue.push(randomPiece());
    currentPiece = nextQueue.shift();
    canHold = true;
    if (collision(currentPiece)) finishGame();
}

function finishGame() {
    gameOver = true;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem(HIGH_SCORE_KEY, highScore);
    }
    playTone({ frequency: 130, duration: 0.3, type: "sawtooth", volume: 0.045 });
    overlayEl.innerHTML = `GAME OVER<br><small>Pulsa Reiniciar para jugar</small>`;
    overlayEl.classList.remove("hidden");
}

function drawBlock(x, y, color, context = ctx, size = BLOCK) {
    context.fillStyle = color;
    context.fillRect(x * size, y * size, size, size);
    context.strokeStyle = "rgba(6, 10, 20, 0.65)";
    context.strokeRect(x * size, y * size, size, size);
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    board.forEach((row, y) => {
        row.forEach((val, x) => {
            if (val) drawBlock(x, y, val);
        });
    });
}

function drawPiece(piece, ghost = false) {
    piece.shape.forEach((row, y) => {
        row.forEach((val, x) => {
            if (!val) return;
            if (ghost) ctx.globalAlpha = hardMode ? 0.08 : 0.22;
            drawBlock(piece.x + x, piece.y + y, COLORS[piece.type]);
            ctx.globalAlpha = 1;
        });
    });
}

function drawNextQueue() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextQueue.slice(0, 3).forEach((piece, index) => {
        const yOffset = index * 95 + 8;
        const size = 20;
        const matrix = piece.shape;
        const xOffset = (nextCanvas.width - matrix[0].length * size) / 2;
        matrix.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val) {
                    nextCtx.save();
                    nextCtx.translate(xOffset, yOffset);
                    drawBlock(x, y, COLORS[piece.type], nextCtx, size);
                    nextCtx.restore();
                }
            });
        });
    });
}

function collision(piece) {
    return piece.shape.some((row, y) => row.some((val, x) => {
        if (!val) return false;
        const newX = piece.x + x;
        const newY = piece.y + y;
        return newX < 0 || newX >= COLS || newY >= ROWS || (board[newY] && board[newY][newX]);
    }));
}

function merge(piece) {
    piece.shape.forEach((row, y) => {
        row.forEach((val, x) => {
            if (val) board[piece.y + y][piece.x + x] = COLORS[piece.type];
        });
    });
    piecesPlaced += 1;
    if (hardMode && piecesPlaced % 8 === 0) addGarbageLine();
}

function rotate(matrix) {
    return matrix[0].map((_, i) => matrix.map((row) => row[i])).reverse();
}

function clearLines() {
    let lines = 0;
    const remaining = board.filter(row => {
        if (row.every(cell => cell)) {
            lines++;
            return false;
        }
        return true;
    });

    while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(0));
    board = remaining;

    if (lines > 0) {
        linesCleared += lines;
        score += LINE_POINTS[lines] * level;
        playLineSound(lines);
        level = (hardMode ? 3 : 1) + Math.floor(linesCleared / 10);
    }
}

function hardDrop() {
    while (!collision(currentPiece)) currentPiece.y += 1;
    currentPiece.y -= 1;
    score += 2;
    merge(currentPiece);
    clearLines();
    spawnPiece();
    playTone({ frequency: 210, duration: 0.09, type: "square", volume: 0.03 });
}

function hold() {
    if (!canHold || gameOver) return;
    if (!holdPiece) {
        holdPiece = { ...currentPiece, x: 3, y: 0 };
        spawnPiece();
    } else {
        const temp = { ...currentPiece, x: 3, y: 0 };
        currentPiece = { ...holdPiece, x: 3, y: 0 };
        holdPiece = temp;
    }
    canHold = false;
    playTone({ frequency: 280, duration: 0.06, type: "triangle", volume: 0.025 });
}

function updateHud() {
    if(scoreEl) scoreEl.textContent = score;
    if(highScoreEl) highScoreEl.textContent = highScore;
    if(levelEl) levelEl.textContent = level;
    if(linesEl) linesEl.textContent = linesCleared;
    if(muteBtn) muteBtn.textContent = muted ? "🔇 Silencio" : "🔊 Sonido";
}

document.addEventListener("keydown", async (e) => {
    if (audioCtx.state !== "running") await audioCtx.resume();
    if (gameOver || !currentPiece) return;

    if (e.key === "ArrowLeft") {
        currentPiece.x -= 1;
        if (collision(currentPiece)) currentPiece.x += 1;
    }
    if (e.key === "ArrowRight") {
        currentPiece.x += 1;
        if (collision(currentPiece)) currentPiece.x -= 1;
    }
    if (e.key === "ArrowDown") {
        currentPiece.y += 1;
        if (collision(currentPiece)) currentPiece.y -= 1;
        else score += 1;
    }
    if (e.key === "ArrowUp") {
        const rotated = rotate(currentPiece.shape);
        const backup = currentPiece.shape;
        currentPiece.shape = rotated;
        if (collision(currentPiece)) currentPiece.shape = backup;
    }
    if (e.key === " ") hardDrop();
    if (e.key.toLowerCase() === "c") hold();
});

// Funcionalidad de pausa
let isPaused = false;

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        console.log("Juego Pausado");
        overlayEl.innerHTML = "PAUSADO<br><small>Haz clic para reanudar</small>";
        overlayEl.classList.remove("hidden");
    } else {
        console.log("Juego Reanudado");
        overlayEl.classList.add("hidden");
    }
}

document.body.addEventListener('click', togglePause);

restartBtn?.addEventListener("click", () => resetGame());
muteBtn?.addEventListener("click", () => { muted = !muted; updateHud(); });
hardModeToggle?.addEventListener("change", () => {
    hardMode = hardModeToggle.checked;
    resetGame();
});

function update(time = 0) {
    const delta = time - lastTime;
    lastTime = time;

    if (!gameOver && currentPiece && !isPaused) {
        dropCounter += delta;
        if (dropCounter > levelDropSpeed()) {
            currentPiece.y += 1;
            if (collision(currentPiece)) {
                currentPiece.y -= 1;
                merge(currentPiece);
                clearLines();
                spawnPiece();
            }
            dropCounter = 0;
        }
    }

    drawBoard();
    if (!gameOver && currentPiece && !isPaused) {
        const ghost = { ...currentPiece };
        while (!collision(ghost)) ghost.y += 1;
        ghost.y -= 1;
        drawPiece(ghost, true);
        drawPiece(currentPiece);
    }
    drawNextQueue();
    updateHud();
    requestAnimationFrame(update);
}

hardMode = false;
resetGame();
update();