window.TILE_SIZE = 48;

window.TILE_COLOR = {
  0: "#2e8b57", // rumput
  1: "#2a6bb5", // air
  2: "#c2b280", // pasir
  3: "#3E2A1F", // lumpur
  4: "#E8F6FF", // salju
  5: "#009BFF"  // ice
};

window.walkable = {
  0: true,
  1: false,
  2: true,
  3: true,
  4: true,
  5: true
};

window.tilemap = [];
window.mapLoaded = false;

// ============ LOAD MAP JSON ============
fetch("map.json")
  .then(res => res.json())   // <-- yang benar untuk JSON
  .then(data => {
      window.tilemap = data;
      window.mapLoaded = true;
      console.log("Tilemap loaded:", data.length, "x", data[0].length);
  })
  .catch(err => console.error("Failed to load map.json:", err));