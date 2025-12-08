import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const PORT = process.env.PORT || 3000;

// WebSocket Server
const wss = new WebSocketServer({ port: PORT });

console.log("✔ WebSocket Multiplayer Server aktif di port:", PORT);

// Menyimpan semua pemain
let players = {};

// Fungsi broadcast ke semua client
function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(json);
  });
}

// Saat pemain terhubung
wss.on("connection", ws => {

  // Generate ID unik
  const id = randomUUID();

  // Spawn random posisi
  players[id] = {
    id,
    x: Math.floor(Math.random() * 500),
    y: Math.floor(Math.random() * 500)
  };

  console.log("Pemain masuk:", id);

  // Kirim data awal ke pemain baru
  ws.send(JSON.stringify({
    type: "init",
    id: id,
    players: players
  }));

  // Beritahu pemain lain bahwa pemain baru masuk
  broadcast({
    type: "player_join",
    player: players[id]
  });

  // Saat pesan diterima dari client
  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "move") {
        if (players[id]) {
          players[id].x = data.x;
          players[id].y = data.y;
        }

        // Broadcast state terbaru
        broadcast({
          type: "update",
          players: players
        });
      }

    } catch (err) {
      console.log("Error parsing:", err);
    }
  });

  // Saat client disconnect
  ws.on("close", () => {
    console.log("Pemain keluar:", id);
    delete players[id];

    broadcast({
      type: "player_leave",
      id: id
    });
  });

});