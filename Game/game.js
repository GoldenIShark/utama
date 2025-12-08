// =======================================
// ELEMENT & VARIABLE DECLARATIONS
// =======================================

// Canvas utama
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1280;
canvas.height = 720;

// Mini-map
const mini = document.getElementById("miniMap");
const mCtx = mini.getContext("2d");
const MINI_SIZE = 80;   // area tile sekitar player
const MINI_PIX = 80;    // ukuran canvas miniMap
let scaleMini = MINI_PIX / MINI_SIZE;

// UI bar HP dan Mana
const hpFill = document.getElementById("hpFill");
const manaFill = document.getElementById("manaFill");

// Tombol aksi
const btnJump = document.getElementById("btnJump");
const btnAttack = document.getElementById("btnAttack");
const btnDash  = document.getElementById("btnDash");
const btnBoost = document.getElementById("btnBoost");

// =======================================
// WEBSOCKET / MULTIPLAYER
// =======================================
// konfigurasi WS: bisa di-override dari HTML sebelum memuat script:
// window.WS_URL = "wss://your-server.example";
const DEFAULT_WS = (() => {
  // coba gunakan hostname saat ini (berguna jika hosting + server ws sama host)
  try {
    const host = location.hostname;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${host}`;
  } catch (e) {
    return "ws://localhost:3000";
  }
})();
const WS_URL = window.WS_URL || DEFAULT_WS;
let ws = null;
let wsConnected = false;
let clientId = null;
let otherPlayers = {}; // id -> {id,x,y,dir,ts}

// Throttle send move
let lastMoveSend = 0;
const MOVE_SEND_INTERVAL = 50; // ms

function wsConnect() {
  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    console.warn("WS create failed:", e);
    setTimeout(wsConnect, 2000);
    return;
  }

  ws.addEventListener("open", () => {
    console.log("WS open ->", WS_URL);
    wsConnected = true;
    // request full sync (optional)
    sendWS({ type: "hello" });
  });

  ws.addEventListener("message", ev => {
    try {
      const data = JSON.parse(ev.data);
      handleWSMessage(data);
    } catch (err) {
      console.warn("WS parse err", err);
    }
  });

  ws.addEventListener("close", () => {
    console.log("WS closed, reconnect in 2s");
    wsConnected = false;
    clientId = null;
    setTimeout(wsConnect, 2000);
  });

  ws.addEventListener("error", err => {
    console.warn("WS error:", err);
    // close will trigger reconnect
  });
}

function sendWS(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {
    // ignore
  }
}

function handleWSMessage(data) {
  // expected types: init, player_join, update, player_leave
  if (!data || !data.type) return;
  if (data.type === "init") {
    // {type:"init", id: "xxx", players: {id:{...}}}
    clientId = data.id;
    otherPlayers = data.players || {};
    // ensure we don't include ourself as otherPlayers
    if (clientId && otherPlayers[clientId]) delete otherPlayers[clientId];
    console.log("WS init id=", clientId, "players=", Object.keys(otherPlayers).length);
  } else if (data.type === "player_join") {
    const p = data.player;
    if (p && p.id && p.id !== clientId) otherPlayers[p.id] = p;
  } else if (data.type === "update") {
    // {type:"update", players: {...}}
    const players = data.players || {};
    // replace otherPlayers but remove our own id
    otherPlayers = {};
    Object.keys(players).forEach(k => {
      if (k === clientId) return;
      otherPlayers[k] = players[k];
    });
  } else if (data.type === "player_leave") {
    if (data.id && otherPlayers[data.id]) delete otherPlayers[data.id];
  } else if (data.type === "pong") {
    // ignore
  }
}

// helper setiap loop untuk kirim posisi (throttled)
function maybeSendPosition(now) {
  if (!wsConnected || !clientId) return;
  const ms = now;
  if (ms - lastMoveSend < MOVE_SEND_INTERVAL) return;
  lastMoveSend = ms;
  sendWS({
    type: "move",
    x: Math.round(world.x),
    y: Math.round(world.y),
    z: Math.round(world.z || 0),
    dir: player.dir || "bawah",
    ts: Date.now()
  });
}

// =======================================
// PLAYER STATUS & ENERGY
// =======================================
let playerHP = 100;
let playerEnergy = 100;
let boosting = false;
let boostKeyDown = false;
let drainTimer = 0;
let regenTimer = 0;

// Gerakan dasar
let speedNormal = 100;
let speedBoost = speedNormal * 2.5;

// =======================================
// SISTEM AKSI (JUMP / ATTACK / DASH)
// =======================================
let isJumping = false;
let vz = 0;
let gravity = 500;
let jumpForce = 200;

let isAttacking = false;
let attackCooldown = 0;

let isDashing = false;
let dashCooldown = 0;
let dashTime = 0;
let dashDuration = 0.12;
let dashSpeed = 700;

// =======================================
// TILEMAP
// =======================================
const TILE_SIZE = 48;
const TILE_COLOR = {
    0: "#2e8b57", // rumput
    1: "#2a6bb5", // air
    2: "#c2b280", // pasir
    3: "#3E2A1F", // lumpur
    4: "#E8F6FF", // salju
    5: "#009BFF"  // air beku
};
const walkable = { 0: true, 1: false, 2: true, 3: true, 4: true, 5: true };

window.tilemap = [];
window.mapLoaded = false;

// =======================================
// WORLD & CAMERA
// =======================================
let world = { x: 0, y: 0, z: 0 };
let camera = { x: 0, y: 0 };
const ZOOM = 1.4;

// =======================================
// INPUT KEYBOARD
// =======================================
document.addEventListener("keydown", e => {
    if (e.key === "Shift") boostKeyDown = true;
});
document.addEventListener("keyup", e => {
    if (e.key === "Shift") boostKeyDown = false;
});

// Jump
btnJump && (btnJump.ontouchstart = () => startJump());

// Attack
btnAttack && (btnAttack.ontouchstart = () => startAttack());

// Dash
if (btnDash) {
  btnDash.addEventListener("touchstart", e => {
    e.preventDefault();
    startDash();
  });
}

// Sprint (lari)
if (btnBoost) {
  btnBoost.addEventListener("touchstart", e => {
    e.preventDefault();
    boostKeyDown = true;
  });
  btnBoost.addEventListener("touchend", e => {
    e.preventDefault();
    boostKeyDown = false;
  });
}

// =======================================
// ENERGY SYSTEM
// =======================================
function updateEnergy(dt) {
    drainTimer += dt;
    regenTimer += dt;

    if (boostKeyDown && playerEnergy > 0) {
        boosting = true;
        if (drainTimer >= 0.1) {
            drainTimer = 0;
            playerEnergy -= 1.5;
            if (playerEnergy < 0) playerEnergy = 0;
        }
        regenTimer = 0;
    } else {
        boosting = false;
        if (regenTimer >= 0.1) {
            regenTimer = 0;
            playerEnergy += 0.5;
            if (playerEnergy > 100) playerEnergy = 100;
        }
        drainTimer = 0;
    }
}

// =======================================
// LOAD TILEMAP
// =======================================
function loadTilemap(url) {
    fetch(url)
        .then(res => res.json())
        .then(data => {
            window.tilemap = data.tiles || data;
            window.mapLoaded = true;
            // kalau tilemap berhasil, posisikan player di tengah
            if (tilemap && tilemap[0]) {
              world.x = (tilemap[0].length * TILE_SIZE) / 2;
              world.y = (tilemap.length * TILE_SIZE) / 2;
            } else {
              world.x = 0; world.y = 0;
            }
            console.log("Tilemap loaded:", tilemap.length, "x", tilemap[0]?.length);
            // connect WS setelah peta siap agar pemain spawn setelah map terload
            setTimeout(wsConnect, 50);
        })
        .catch(err => {
            console.error("Failed to load map:", err);
            // tetap coba konek ws
            setTimeout(wsConnect, 2000);
        });
}

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
// drawTilemap
// =======================================
function drawTilemap() {

    if (!window.mapLoaded || !tilemap || tilemap.length === 0)
        return;

    const R = 200;

    const startX = Math.floor((camera.x - R) / TILE_SIZE);
    const endX   = Math.floor((camera.x + canvas.width / ZOOM + R) / TILE_SIZE);

    const startY = Math.floor((camera.y - R) / TILE_SIZE);
    const endY   = Math.floor((camera.y + canvas.height / ZOOM + R) / TILE_SIZE);

    for (let y = startX < 0 ? 0 : startY; y <= endY; y++) {
        if (y < 0 || y >= tilemap.length) continue;

        for (let x = startX; x <= endX; x++) {
            if (x < 0 || x >= tilemap[0].length) continue;

            const id = tilemap[y][x];
            const sx = x * TILE_SIZE - camera.x;
            const sy = y * TILE_SIZE - camera.y;

            ctx.fillStyle = TILE_COLOR[id] || "#333";
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        }
    }
}

// =======================================
// MINI MAP
// =======================================
function drawMiniMap() {
    if (!window.mapLoaded) return;
    mCtx.clearRect(0, 0, MINI_PIX, MINI_PIX);
    const pTileX = Math.floor(world.x / TILE_SIZE);
    const pTileY = Math.floor(world.y / TILE_SIZE);
    const half = MINI_SIZE / 2;

    const startX = Math.max(0, pTileX - half);
    const endX = Math.min(tilemap[0].length - 1, pTileX + half);
    const startY = Math.max(0, pTileY - half);
    const endY = Math.min(tilemap.length - 1, pTileY + half);

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            const id = tilemap[y][x];
            mCtx.fillStyle = TILE_COLOR[id] || "#000";
            const drawX = (x - (pTileX - half)) * scaleMini;
            const drawY = (y - (pTileY - half)) * scaleMini;
            mCtx.fillRect(drawX, drawY, Math.max(1, scaleMini), Math.max(1, scaleMini));
        }
    }
    // player marker
    mCtx.fillStyle = "red";
    mCtx.fillRect(MINI_PIX / 2 - 3, MINI_PIX / 2 - 3, 6, 6);

    // render other players as small white dots relative to mini center
    Object.values(otherPlayers).forEach(p => {
        const dx = (p.x / TILE_SIZE) - pTileX + half;
        const dy = (p.y / TILE_SIZE) - pTileY + half;
        const drawX = dx * scaleMini;
        const drawY = dy * scaleMini;
        mCtx.fillStyle = "white";
        mCtx.fillRect(Math.round(drawX), Math.round(drawY), 3, 3);
    });
}

// =======================================
// ANIMATION
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
    diam: loadAnim("diam", ["atas", "bawah", "kiri", "kanan"], 4),
    jalan: loadAnim("jalan", ["atas", "bawah", "kiri", "kanan"], 4),
    serang: loadAnim("serang", ["atas", "bawah", "kiri", "kanan"], 4)
};
let player = {
    state: "diam",
    dir: "bawah",
    frame: 0,
    frameSpeed: 8,
    frameTime: 0,
    z: 0
};

// =======================================
// PLAYER DIRECTION & MOVEMENT
// =======================================
function getDir() {
    if (joyInput.y < -0.5) return "atas";
    if (joyInput.y > 0.5) return "bawah";
    if (joyInput.x > 0.5) return "kanan";
    if (joyInput.x < -0.5) return "kiri";
    return null;
}

if (btnBoost) {
  btnBoost.addEventListener("touchstart", e => {
      e.preventDefault();
      boostKeyDown = true;  // mulai lari
  });

  btnBoost.addEventListener("touchend", e => {
      e.preventDefault();
      boostKeyDown = false; // berhenti lari
  });
}

// =======================================
// ACTIONS (JUMP / ATTACK / DASH)
// =======================================
function startJump() {
    if (isJumping) return;
    isJumping = true;
    vz = jumpForce;
}
function startAttack() {
    if (attackCooldown > 0) return;
    attackCooldown = 0.4;
    isAttacking = true;
    player.state = "serang";
    player.frame = 0;
}
function startDash() {
    if (dashCooldown > 0) return;
    dashCooldown = 1.0;
    isDashing = true;
    dashTime = dashDuration;
}

// =======================================
// UPDATE PLAYER
// =======================================
function updatePlayer(dt) {
    attackCooldown -= dt;
    dashCooldown -= dt;
    if (attackCooldown < 0) attackCooldown = 0;
    if (dashCooldown < 0) dashCooldown = 0;

    if (isAttacking) {
        player.frameTime++;
        if (player.frameTime >= player.frameSpeed) {
            player.frameTime = 0;
            player.frame++;
            if (player.frame >= anim.serang[player.dir].length) {
                isAttacking = false;
                player.state = "diam";
                player.frame = 0;
            }
        }
        // still allow movement while attacking? currently returning (no move)
        return;
    }

    if (isDashing) {
        let dx = 0, dy = 0;
        if (player.dir === "atas") dy = -1;
        if (player.dir === "bawah") dy = 1;
        if (player.dir === "kiri") dx = -1;
        if (player.dir === "kanan") dx = 1;
        world.x += dx * dashSpeed * dt;
        world.y += dy * dashSpeed * dt;
        dashTime -= dt;
        if (dashTime <= 0) isDashing = false;
    }

    if (isJumping) {
        world.z += vz * dt;
        vz -= gravity * dt;
        if (world.z <= 0) {
            world.z = 0;
            isJumping = false;
        }
    }

    let dir = getDir();
    let speed = boosting ? speedBoost : speedNormal;

    if (dir) {
        player.dir = dir;
        player.state = "jalan";
        let vx = 0, vy = 0;
        if (dir === "atas") vy = -speed * dt;
        if (dir === "bawah") vy = speed * dt;
        if (dir === "kanan") vx = speed * dt;
        if (dir === "kiri") vx = -speed * dt;
        const nx = world.x + vx;
        const ny = world.y + vy;
        if (canWalk(nx, world.y)) world.x = nx;
        if (canWalk(world.x, ny)) world.y = ny;
    } else player.state = "diam";

    player.frameTime++;
    if (player.frameTime >= player.frameSpeed) {
        player.frameTime = 0;
        player.frame++;
        let frames = anim[player.state][player.dir];
        if (player.frame >= frames.length) player.frame = 0;
    }
}

// =======================================
// DRAW OTHER PLAYERS
// =======================================
function drawOtherPlayers() {
  // render simple markers for remote players
  Object.values(otherPlayers).forEach(p => {
    if (!p) return;
    const ox = p.x - camera.x;
    const oy = p.y - camera.y;
    // draw shadow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.ellipse(ox, oy + 14, 8, 4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // body as circle
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ox, oy, 8, 0, Math.PI*2);
    ctx.fill();

    // direction indicator (small line)
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let dx = 0, dy = -8;
    if (p.dir === "atas") { dx = 0; dy = -10; }
    if (p.dir === "bawah") { dx = 0; dy = 10; }
    if (p.dir === "kiri") { dx = -10; dy = 0; }
    if (p.dir === "kanan") { dx = 10; dy = 0; }
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + dx, oy + dy);
    ctx.stroke();
  });
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
    let py = (world.y - camera.y - 16) - world.z;
    ctx.drawImage(img, px, py, 26, 36);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.ellipse(world.x - camera.x, world.y - camera.y + 14, 10, 4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// =======================================
// UPDATE UI BARS
// =======================================
function updateBars() {
    if (hpFill) hpFill.style.width = playerHP + "%";
    if (manaFill) manaFill.style.width = playerEnergy + "%";
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
        requestAnimationFrame(loop);
        return;
    }

    updateEnergy(dt);
    updatePlayer(dt);

    camera.x = world.x - canvas.width / (2 * ZOOM);
    camera.y = world.y - canvas.height / (2 * ZOOM);

    ctx.save();
    ctx.scale(ZOOM, ZOOM);
    drawTilemap();
    drawOtherPlayers();
    drawPlayer();
    ctx.restore();

    drawMiniMap();
    updateBars();

    // multiplayer: kirim posisi (throttled)
    maybeSendPosition(performance.now());

    requestAnimationFrame(loop);
}

// =======================================
// LOAD MAP & START GAME
// =======================================
loadTilemap("map.json");
requestAnimationFrame(loop);