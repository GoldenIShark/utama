// =======================================
// MAP LOADER SYSTEM
// =======================================

// Menyimpan map yang sedang aktif
window.currentMap = "";

// Daftar semua map
const MAP_LIST = {
    sumatra: "map/map_sumatra.json",
    jawa: "map/map_jawa.json",
    kalimantan: "map/map_kalimantan.json",
    sulawesi: "map/map_sulawesi.json",
    papua: "map/map_papua.json"
};

// Fungsi utama memuat map baru
window.loadRegion = function(regionName) {

    if (!MAP_LIST[regionName]) {
        console.error("Map tidak ditemukan:", regionName);
        return;
    }

    const mapURL = MAP_LIST[regionName];
    console.log("📌 Load map:", regionName, "->", mapURL);

    // Reset state game
    window.mapLoaded = false;
    window.tilemap = [];

    // Panggil loader map bawaan dari game.js
    loadTilemap(mapURL);

    // Reset posisi player ke tengah map
    world.x = 2000;
    world.y = 2000;

    currentMap = regionName;
};