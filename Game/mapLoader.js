const MAP_LIST = {
    sumatra:   "map/sumatra.json",
    jawa:      "map/jawa.json",
    kalimantan:"map/kalimantan.json",
    sulawesi:  "map/sulawesi.json",
    papua:     "map/papua.json"
};

function loadTilemap(url) {
    return fetch(url)
        .then(r => r.json())
        .catch(e => console.error("Map load error", e));
}

window.loadRegion = async function(region) {
    const file = MAP_LIST[region];
    if (!file) return console.error("Map tidak ditemukan:", region);

    console.log("Load map:", file);
    const data = await loadTilemap(file);

    window.tilemap = data;
    window.mapLoaded = true;

    world.x = tilemap[0].length * 24;
    world.y = tilemap.length * 24;

    console.log("Map loaded:", tilemap.length, "x", tilemap[0].length);
};