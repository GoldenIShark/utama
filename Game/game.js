// =======================================
// CANVAS
// =======================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1280;
canvas.height = 720;

// =======================================
// SPEED & ENERGY SYSTEM
// =======================================
let speedNormal = 80;              // lebih lambat
let speedBoost = speedNormal * 2;

let playerEnergy = 100;
let boosting = false;
let boostKeyDown = false;

let drainTimer = 0;
let regenTimer = 0;

// =======================================
// INPUT KEYBOARD
// =======================================
document.addEventListener("keydown", e => {
    if (e.key === "Shift") boostKeyDown = true;
});

document.addEventListener("keyup", e => {
    if (e.key === "Shift") {
        boostKeyDown = false;
        boosting = false;
    }
});

// =======================================
// ENERGY UPDATE (1.5% drain / 0.1s , 0.5% regen / 0.1s)
// =======================================
function updateEnergy(dt) {

    drainTimer += dt;
    regenTimer += dt;

    if (boostKeyDown && playerEnergy > 0) {

        boosting = true;

        if (drainTimer >= 0.1) {
            drainTimer = 0;
            playerEnergy -= 3;        // benar: 1.5% / 0.1s
            if (playerEnergy < 0) playerEnergy = 0;
        }

        regenTimer = 0;

    } else {

        boosting = false;

        if (regenTimer >= 1) {
            regenTimer = 0;
            playerEnergy += 0.5;        // benar: 0.5% / 0.1s
            if (playerEnergy > 100) playerEnergy = 100;
        }

        drainTimer = 0;
    }
}

// =======================================
// GLOBAL TILE CONFIG
// =======================================
window.TILE_SIZE = window.TILE_SIZE || 48;
const TILE_SIZE = window.TILE_SIZE;

window.TILE_COLOR = window.TILE_COLOR || {
    0: "#2e8b57",
    1: "#2a6bb5",
    2: "#c2b280"
};
const TILE_COLOR = window.TILE_COLOR;

window.walkable = window.walkable || { 0: true, 1: false, 2: true };
const walkable = window.walkable;

window.tilemap = window.tilemap || [];
window.mapLoaded = window.mapLoaded || false;

const joyInput = window.joyInput || { x: 0, y: 0, magnitude: 0 };

// =======================================
// WORLD & CAMERA
// =======================================
let world = { 
    x: TILE_SIZE * 4,
    y: TILE_SIZE * 4
};

let camera = { x: 0, y: 0 };

// =======================================
// PLAYER
// =======================================
let player = {
    state: "diam",
    dir: "bawah",
    frame: 0,
    frameSpeed: 8,
    frameTime: 0
};

// =======================================
// COLLISION
// =======================================
function canWalk(wx, wy) {

    if (!window.mapLoaded) return false;

    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);

    if (tx < 0 || ty < 0 || ty >= tilemap.length || tx >= tilemap[0].length)
        return false;

    return walkable[tilemap[ty][tx]] ?? true;
}

// =======================================
// DRAW TILEMAP  (TANPA SCALE DI SINI)
// =======================================
function drawTilemap() {

    for (let y = 0; y < tilemap.length; y++) {
        for (let x = 0; x < tilemap[y].length; x++) {

            const tileID = tilemap[y][x];

            const screenX = x * TILE_SIZE - camera.x;
            const screenY = y * TILE_SIZE - camera.y;

            ctx.fillStyle = TILE_COLOR[tileID] || "#333";
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
    }
}

// =======================================
// LOAD ANIMATION
// =======================================
function loadAnim(folder, dirs, frameCount) {
    let obj = {};
    dirs.forEach(dir => {
        let frames = [];
        for (let i = 0; i < frameCount; i++) {
            let img = new Image();
            img.src = `assets/char/${folder}/${dir}/${i}.png`;
            frames.push(img);
        }
        obj[dir] = frames;
    });
    return obj;
}

const anim = {
    diam:  loadAnim("diam",["atas","bawah","kiri","kanan"],4),
    jalan: loadAnim("jalan",["atas","bawah","kiri","kanan"],4)
};

// =======================================
// GET DIRECTION
// =======================================
function getDir() {
    if (joyInput.y < -0.5) return "atas";
    if (joyInput.y >  0.5) return "bawah";
    if (joyInput.x >  0.5) return "kanan";
    if (joyInput.x < -0.5) return "kiri";
    return null;
}

// =======================================
// HP & MANA BAR
// =======================================
const hpFill = document.getElementById("hpFill");
const manaFill = document.getElementById("manaFill");

let playerHP = 100;

function updateBars() {
    hpFill.style.width = playerHP + "%";
    manaFill.style.width = playerEnergy + "%";
}

// =======================================
// UPDATE PLAYER
// =======================================
function updatePlayer(dt) {

    let dir = getDir();
    let speed = boosting ? speedBoost : speedNormal;

    if (dir) {

        if (dir !== player.dir) player.frame = 0;

        player.dir = dir;
        player.state = "jalan";

        let vx = 0, vy = 0;

        if (dir === "atas")  vy = -speed * dt;
        if (dir === "bawah") vy =  speed * dt;
        if (dir === "kanan") vx =  speed * dt;
        if (dir === "kiri")  vx = -speed * dt;

        const nx = world.x + vx;
        const ny = world.y + vy;

        if (canWalk(nx, world.y)) world.x = nx;
        if (canWalk(world.x, ny)) world.y = ny;

    } else {
        player.state = "diam";
    }

    player.frameTime++;
    if (player.frameTime >= player.frameSpeed) {
        player.frameTime = 0;
        player.frame++;
        let frames = anim[player.state][player.dir];
        if (player.frame >= frames.length) player.frame = 0;
    }
}

// =======================================
// DRAW PLAYER
// =======================================
function drawPlayer() {

    let frames = anim[player.state][player.dir];
    if (!frames) return;

    let img = frames[player.frame];
    if (!img || !img.complete) return;

    let px = world.x - camera.x - 16;
    let py = world.y - camera.y - 16;

    ctx.drawImage(img, px, py, 26, 36);
}

// =======================================
// MAIN LOOP
// =======================================
let last = performance.now();

function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!window.mapLoaded) {
        ctx.fillStyle = "white";
        ctx.font = "32px Arial";
        ctx.fillText("Loading map...", canvas.width / 2 - 120, canvas.height / 2);
        return requestAnimationFrame(loop);
    }

    updateEnergy(dt);
    updatePlayer(dt);

    camera.x = world.x - canvas.width / 3.5;
    camera.y = world.y - canvas.height / 3.5;

    ctx.save();
    ctx.scale(1.7, 1.7);     // ZOOM DI SINI SAJA
    drawTilemap();
    drawPlayer();
    ctx.restore();

    updateBars();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);