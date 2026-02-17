// =====================
// TETRIS PRO + OVERLAY (PAUSE/Game Over)
// =====================

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const MINI_BLOCK = 20; // mini canvases: 120px => 6 * 20

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");

const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

canvas.width = COLS * BLOCK;
canvas.height = ROWS * BLOCK;

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");

const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayHintEl = document.getElementById("overlayHint");

let board;
let score;
let level;
let linesCleared;
let dropSpeed;

let currentPiece;
let holdPiece;
let canHold;
let nextQueue;

let paused = false;
let isGameOver = false;

// ---------- data ----------
const COLORS = {
  I: "#00FFFF",
  J: "#3b6cff",
  L: "#ff9b35",
  O: "#ffe04a",
  S: "#39ff6b",
  T: "#b04cff",
  Z: "#ff3b3b",
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
};

// ---------- helpers ----------
function cloneShape(shape) {
  return shape.map((r) => r.slice());
}

function makePiece(type) {
  return { type, shape: cloneShape(SHAPES[type]), x: 3, y: 0 };
}

function randomPiece() {
  const keys = Object.keys(SHAPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  return makePiece(type);
}

function clonePiece(p) {
  return { type: p.type, shape: cloneShape(p.shape), x: p.x, y: p.y };
}

// ---------- overlay ----------
function showOverlay(title, hint) {
  overlayTitleEl.textContent = title;
  overlayHintEl.textContent = hint;
  overlayEl.classList.remove("hidden");
  overlayEl.setAttribute("aria-hidden", "false");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
  overlayEl.setAttribute("aria-hidden", "true");
}

function setPaused(nextState) {
  if (isGameOver) return;
  paused = nextState;
  if (paused) showOverlay("PAUSED", "Press P to resume");
  else hideOverlay();
}

function triggerGameOver() {
  isGameOver = true;
  paused = false;
  showOverlay("GAME OVER", "Press R to restart");
}

// ---------- draw main ----------
function drawBlock(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
  ctx.strokeStyle = "#111";
  ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
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
      if (ghost) ctx.globalAlpha = 0.22;
      drawBlock(piece.x + x, piece.y + y, COLORS[piece.type]);
      ctx.globalAlpha = 1;
    });
  });
}

// ---------- mini (hold/next) ----------
function clearMini(ctx2, w, h) {
  ctx2.clearRect(0, 0, w, h);
}

function drawMiniPiece(ctx2, piece, offsetRows = 0) {
  if (!piece) return;

  const shape = piece.shape;
  const color = COLORS[piece.type];

  const w = shape[0].length;
  const h = shape.length;

  const startX = Math.floor((6 - w) / 2);
  const startY = Math.floor((6 - h) / 2) + offsetRows;

  shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (!val) return;
      ctx2.fillStyle = color;
      ctx2.fillRect((startX + x) * MINI_BLOCK, (startY + y) * MINI_BLOCK, MINI_BLOCK, MINI_BLOCK);
      ctx2.strokeStyle = "#111";
      ctx2.strokeRect((startX + x) * MINI_BLOCK, (startY + y) * MINI_BLOCK, MINI_BLOCK, MINI_BLOCK);
    });
  });
}

function renderHold() {
  clearMini(holdCtx, holdCanvas.width, holdCanvas.height);
  drawMiniPiece(holdCtx, holdPiece, 0);
}

function renderNext() {
  clearMini(nextCtx, nextCanvas.width, nextCanvas.height);
  for (let i = 0; i < Math.min(3, nextQueue.length); i++) {
    drawMiniPiece(nextCtx, nextQueue[i], i * 6);
  }
}

function updateHud() {
  scoreEl.innerText = score;
  levelEl.innerText = level;
  linesEl.innerText = linesCleared;
}

// ---------- logic ----------
function collision(piece) {
  return piece.shape.some((row, y) =>
    row.some((val, x) => {
      if (!val) return false;
      const newX = piece.x + x;
      const newY = piece.y + y;
      return (
        newX < 0 ||
        newX >= COLS ||
        newY >= ROWS ||
        (board[newY] && board[newY][newX])
      );
    })
  );
}

function merge(piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (!val) return;
      board[piece.y + y][piece.x + x] = COLORS[piece.type];
    });
  });
}

function rotate(matrix) {
  // clockwise
  return matrix[0].map((_, i) => matrix.map((row) => row[i])).reverse();
}

function clearLines() {
  let lines = 0;

  board = board.filter((row) => {
    if (row.every((cell) => cell)) {
      lines++;
      return false;
    }
    return true;
  });

  while (board.length < ROWS) board.unshift(Array(COLS).fill(0));

  if (lines > 0) {
    linesCleared += lines;
    score += [0, 100, 300, 500, 800][lines] * level;

    if (linesCleared >= level * 10) {
      level++;
      dropSpeed *= 0.9;
    }
  }
}

function ensureQueue() {
  while (nextQueue.length < 5) nextQueue.push(randomPiece());
}

function spawnPiece() {
  ensureQueue();
  currentPiece = nextQueue.shift();
  nextQueue.push(randomPiece());
  canHold = true;

  if (collision(currentPiece)) triggerGameOver();

  renderNext();
  renderHold();
}

function hardDrop() {
  let moved = false;
  while (!collision(currentPiece)) {
    currentPiece.y++;
    moved = true;
  }
  if (moved) currentPiece.y--;

  merge(currentPiece);
  clearLines();
  spawnPiece();
}

function hold() {
  if (!canHold) return;

  if (!holdPiece) {
    holdPiece = clonePiece(currentPiece);
    spawnPiece();
  } else {
    const temp = clonePiece(currentPiece);
    currentPiece = clonePiece(holdPiece);
    holdPiece = temp;

    currentPiece.x = 3;
    currentPiece.y = 0;

    if (collision(currentPiece)) triggerGameOver();
  }

  canHold = false;
  renderHold();
  renderNext();
}

// ---------- reset ----------
function resetGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  score = 0;
  level = 1;
  linesCleared = 0;
  dropSpeed = 1000;

  currentPiece = null;
  holdPiece = null;
  canHold = true;
  nextQueue = [];

  paused = false;
  isGameOver = false;
  hideOverlay();

  spawnPiece();
  updateHud();
}

// ---------- input ----------
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  // PAUSE toggle (P)
  if (key === "p") {
    setPaused(!paused);
    return;
  }

  // RESTART (R)
  if (key === "r") {
    resetGame();
    return;
  }

  // if paused or game over, don't allow gameplay keys
  if (paused || isGameOver) return;

  if (!currentPiece) return;

  if (e.key === "ArrowLeft") {
    currentPiece.x--;
    if (collision(currentPiece)) currentPiece.x++;
  }

  if (e.key === "ArrowRight") {
    currentPiece.x++;
    if (collision(currentPiece)) currentPiece.x--;
  }

  if (e.key === "ArrowDown") {
    currentPiece.y++;
    if (collision(currentPiece)) currentPiece.y--;
  }

  if (e.key === "ArrowUp") {
    const rotated = rotate(currentPiece.shape);
    const backup = currentPiece.shape;
    currentPiece.shape = rotated;
    if (collision(currentPiece)) currentPiece.shape = backup;
  }

  if (e.key === " ") {
    hardDrop();
  }

  if (key === "c") {
    hold();
  }
});

// ---------- loop ----------
let dropCounter = 0;
let lastTime = 0;

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  // still draw even when paused/gameover, but do not advance gameplay
  if (!paused && !isGameOver) {
    dropCounter += delta;

    if (dropCounter > dropSpeed) {
      currentPiece.y++;
      if (collision(currentPiece)) {
        currentPiece.y--;
        merge(currentPiece);
        clearLines();
        spawnPiece();
      }
      dropCounter = 0;
    }
  } else {
    // prevent "fast drop" after unpausing
    dropCounter = 0;
  }

  drawBoard();

  if (currentPiece) {
    // ghost piece
    const ghost = clonePiece(currentPiece);
    while (!collision(ghost)) ghost.y++;
    ghost.y--;
    drawPiece(ghost, true);

    drawPiece(currentPiece);
  }

  updateHud();
  requestAnimationFrame(update);
}

// start
resetGame();
update();
