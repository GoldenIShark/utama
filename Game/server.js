import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

console.log("WebSocket server running on port", PORT);

let players = {};

wss.on("connection", ws => {
    const id = Date.now() + "_" + Math.floor(Math.random() * 9999);
    players[id] = { x: 0, y: 0 };

    ws.send(JSON.stringify({ type: "welcome", id }));

    ws.on("message", msg => {
        const data = JSON.parse(msg);

        if (data.type === "move") {
            players[id].x = data.x;
            players[id].y = data.y;
        }

        wss.clients.forEach(c => {
            if (c.readyState === 1) {
                c.send(JSON.stringify({
                    type: "state",
                    players
                }));
            }
        });
    });

    ws.on("close", () => {
        delete players[id];
    });
});
