// =============================
// MAP LOADER SYSTEM
// =============================

// daftar map (silakan isi nanti setelah map dibuat)
const MAP_LIST = {
    sumatra:   "map/sumatra.json",
    jawa:      "map/jawa.json",
    kalimantan:"map/kalimantan.json",
    sulawesi:  "map/sulawesi.json",
    papua:     "map/papua.json"
};

window.currentMap = "";

// fungsi utama untuk mengganti map
window.loadRegion = function(regionName) {

    if (!MAP_LIST[regionName]) {
        console.error("Map tidak ditemukan:", regionName);
        return;
    }

    const mapURL = MAP_LIST[regionName];
    console.log("📌 Loading region:", regionName, "->", mapURL);

    window.mapLoaded = false;
    window.tilemap = [];

    // panggil loader asli dari game.js
    loadTilemap(mapURL);

    // reset posisi player
    world.x = 2000;
    world.y = 2000;

    currentMap = regionName;
};