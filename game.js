const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");

const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

canvas.width = COLS * BLOCK;
canvas.height = ROWS * BLOCK;

let board = Array.from({length: ROWS}, () => Array(COLS).fill(0));

const COLORS = {
    I: "#00FFFF",
    J: "#0000FF",
    L: "#FF7F00",
    O: "#FFFF00",
    S: "#00FF00",
    T: "#800080",
    Z: "#FF0000"
};

const SHAPES = {
    I: [[1,1,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0]],
    T: [[0,1,0],[1,1,1]],
    Z: [[1,1,0],[0,1,1]]
};

let score = 0;
let level = 1;
let linesCleared = 0;
let dropSpeed = 1000;

let currentPiece = null;
let holdPiece = null;
let canHold = true;
let nextQueue = [];

function randomPiece() {
    const keys = Object.keys(SHAPES);
    const key = keys[Math.floor(Math.random()*keys.length)];
    return {
        shape: SHAPES[key],
        type: key,
        x: 3,
        y: 0
    };
}

function spawnPiece() {
    if(nextQueue.length < 5){
        while(nextQueue.length < 5){
            nextQueue.push(randomPiece());
        }
    }
    currentPiece = nextQueue.shift();
    nextQueue.push(randomPiece());
    canHold = true;

    if(collision(currentPiece)){
        alert("GAME OVER");
        document.location.reload();
    }
}

function drawBlock(x,y,color){
    ctx.fillStyle = color;
    ctx.fillRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
    ctx.strokeStyle = "#111";
    ctx.strokeRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
}

function drawBoard(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    board.forEach((row,y)=>{
        row.forEach((val,x)=>{
            if(val) drawBlock(x,y,val);
        });
    });
}

function drawPiece(piece, ghost=false){
    piece.shape.forEach((row,y)=>{
        row.forEach((val,x)=>{
            if(val){
                if(ghost){
                    ctx.globalAlpha = 0.2;
                }
                drawBlock(piece.x+x, piece.y+y, COLORS[piece.type]);
                ctx.globalAlpha = 1;
            }
        });
    });
}

function collision(piece){
    return piece.shape.some((row,y)=>
        row.some((val,x)=>{
            if(!val) return false;
            let newX = piece.x + x;
            let newY = piece.y + y;
            return newX < 0 || newX >= COLS ||
                   newY >= ROWS ||
                   (board[newY] && board[newY][newX]);
        })
    );
}

function merge(piece){
    piece.shape.forEach((row,y)=>{
        row.forEach((val,x)=>{
            if(val){
                board[piece.y+y][piece.x+x] = COLORS[piece.type];
            }
        });
    });
}

function rotate(matrix){
    return matrix[0].map((_,i)=>matrix.map(row=>row[i])).reverse();
}

function clearLines(){
    let lines = 0;
    board = board.filter(row=>{
        if(row.every(cell=>cell)){
            lines++;
            return false;
        }
        return true;
    });
    while(board.length < ROWS){
        board.unshift(Array(COLS).fill(0));
    }
    if(lines > 0){
        linesCleared += lines;
        score += [0,100,300,500,800][lines]*level;
        if(linesCleared >= level*10){
            level++;
            dropSpeed *= 0.9;
        }
    }
}

function hardDrop(){
    while(!collision(currentPiece)){
        currentPiece.y++;
    }
    currentPiece.y--;
    merge(currentPiece);
    clearLines();
    spawnPiece();
}

function hold(){
    if(!canHold) return;
    if(!holdPiece){
        holdPiece = currentPiece;
        spawnPiece();
    } else {
        [currentPiece, holdPiece] = [holdPiece, currentPiece];
        currentPiece.x = 3;
        currentPiece.y = 0;
    }
    canHold = false;
}

document.addEventListener("keydown", e=>{
    if(e.key === "ArrowLeft"){
        currentPiece.x--;
        if(collision(currentPiece)) currentPiece.x++;
    }
    if(e.key === "ArrowRight"){
        currentPiece.x++;
        if(collision(currentPiece)) currentPiece.x--;
    }
    if(e.key === "ArrowDown"){
        currentPiece.y++;
        if(collision(currentPiece)) currentPiece.y--;
    }
    if(e.key === "ArrowUp"){
        let rotated = rotate(currentPiece.shape);
        let backup = currentPiece.shape;
        currentPiece.shape = rotated;
        if(collision(currentPiece)) currentPiece.shape = backup;
    }
    if(e.key === " "){
        hardDrop();
    }
    if(e.key === "c"){
        hold();
    }
});

let dropCounter = 0;
let lastTime = 0;

function update(time=0){
    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if(dropCounter > dropSpeed){
        currentPiece.y++;
        if(collision(currentPiece)){
            currentPiece.y--;
            merge(currentPiece);
            clearLines();
            spawnPiece();
        }
        dropCounter = 0;
    }
    drawBoard();

    let ghost = {...currentPiece};
    while(!collision(ghost)){
        ghost.y++;
    }
    ghost.y--;
    drawPiece(ghost,true);

    drawPiece(currentPiece);

    document.getElementById("score").innerText = score;
    document.getElementById("level").innerText = level;
    document.getElementById("lines").innerText = linesCleared;

    requestAnimationFrame(update);
}

spawnPiece();
update();
