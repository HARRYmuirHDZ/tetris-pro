// =====================
// TETRIS PRO (simple)
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

let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const COLORS = {
  I: "#00FFFF",
  J: "#0000FF",
  L: "#FF7F00",
  O: "#FFFF00",
  S: "#00FF00",
  T: "#800080",
  Z: "#FF0000",
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

let score = 0;
let level = 1;
let linesCleared = 0;
let dropSpeed = 1000;

let currentPiece = null;
let holdPiece = null;
let canHold = true;
let nextQueue = [];

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
      if (ghost) ctx.globalAlpha = 0.2;
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

  // center within 6x6 mini grid
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
  // show 3 next pieces, each in its own 6-row slot
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
  // rotate clockwise
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

function gameOver() {
  alert("GAME OVER");
  document.location.reload();
}

function spawnPiece() {
  ensureQueue();
  currentPiece = nextQueue.shift();
  nextQueue.push(randomPiece());
  canHold = true;

  if (collision(currentPiece)) gameOver();

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

    if (collision(currentPiece)) gameOver();
  }

  canHold = false;
  renderHold();
  renderNext();
}

// ---------- input ----------
document.addEventListener("keydown", (e) => {
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

  if (e.key.toLowerCase() === "c") {
    hold();
  }
});

// ---------- loop ----------
let dropCounter = 0;
let lastTime = 0;

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
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

  drawBoard();

  // ghost piece
  const ghost = clonePiece(currentPiece);
  while (!collision(ghost)) ghost.y++;
  ghost.y--;
  drawPiece(ghost, true);

  drawPiece(currentPiece);
  updateHud();

  requestAnimationFrame(update);
}

// start
spawnPiece();
update();
