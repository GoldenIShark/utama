const express = require("express");
const path = require("path");
const app = express();
const http = require("http").createServer(app);
const WebSocket = require("ws");

const wss = new WebSocket.Server({ server: http });

// ==== Multiplayer memory sementara ====
let players = {};

wss.on("connection", ws => {
    console.log("Player connected");

    ws.on("message", msg => {
        const data = JSON.parse(msg);
        
        // Simpan posisi player
        players[data.id] = data;

        // Broadcast ke semua player
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    });

    ws.on("close", () => {
        console.log("Player disconnected");
    });
});

// ==== Serve file HTML Game ====
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log("Server running on port", PORT);
});