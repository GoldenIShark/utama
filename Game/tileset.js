window.TILE_SIZE = 48;

window.TILE_COLOR = {
  0: "#2e8b57", // rumput
  1: "#2a6bb5", // air
  2: "#c2b280"  // pasir
};

window.walkable = {
  0: true,
  1: false,
  2: true
};

// tilemap akan dimuat dari map.txt
window.tilemap = [];
window.mapLoaded = false;

// load map.txt
fetch("map.txt")
  .then(res => res.text())
  .then(text => {
    window.tilemap = text
      .trim()
      .split("\n")
      .map(line => line.split(",").map(n => Number(n)));

    window.mapLoaded = true;
    console.log("Tilemap loaded:", window.tilemap);
  })
  .catch(err => console.error("Failed to load map.txt:", err));