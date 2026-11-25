import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_KEY, DEFAULT_STATION, availableStations, emptyRadio, favoriteStationKey, nextPlayable, normalizeName, oembedProblem, parsePlaylist,
  parseStationUrl, providerUrl, readSavedRadio, readSharedStation, shareHref, stationCollection,
  saveTunedStation, stationForProvider, stationKey, stationProfile, stationWindowStart, youtubeOembedUrl,
} from "../src/lib/stations.ts";
import type { Station } from "../src/types/station.ts";
import { DEFAULT_YOUTUBE_STATION, youtubeQueue } from "../src/lib/station-presets.ts";

const spotify = "18CtdtRLbksPWxGq7Kn9ZD";
const youtube = "PLBCF2DAC6FFB574DE";
const custom: Station = { provider: "youtube", playlistId: youtube, name: "Vía & neón 🎧" };
const mix: Station = { provider: "youtube", videoId: "gTHYH1CefOk", name: "Mix nocturno" };

test("acepta playlists Spotify y variantes con idioma y parámetros", () => {
  assert.equal(parsePlaylist(`https://open.spotify.com/playlist/${spotify}?si=abc`, "spotify"), spotify);
  assert.equal(parsePlaylist(` https://open.spotify.com/intl-es/playlist/${spotify}/ `, "spotify"), spotify);
});

test("acepta enlaces YouTube con una sola playlist explícita", () => {
  for (const url of [
    `https://www.youtube.com/playlist?list=${youtube}`,
    `https://m.youtube.com/watch?v=gTHYH1CefOk&list=${youtube}`,
    `https://youtu.be/gTHYH1CefOk?list=${youtube}`,
  ]) {
    assert.equal(parsePlaylist(url, "youtube"), youtube);
  }
  const album = "OLAK5uy_lLPubWQ02cx6JNYzKZ30PWLtOLJES8WCE";
  assert.equal(parsePlaylist(`https://www.youtube.com/playlist?list=${album}`, "youtube"), album);
});

test("rechaza orígenes falsos, credenciales, enlaces ambiguos y recursos ajenos", () => {
  for (const url of [
    `https://open.spotify.com.bad.invalid/playlist/${spotify}`,
    `https://x@open.spotify.com/playlist/${spotify}`,
    `http://open.spotify.com/playlist/${spotify}`,
    `https://open.spotify.com:8080/playlist/${spotify}`,
    `https://open.spotify.com/album/${spotify}`,
    "https://spotify.link/abcd",
  ]) {
    assert.equal(parsePlaylist(url, "spotify"), null);
  }
  for (const url of [
    "https://www.youtube.com/watch?v=gTHYH1CefOk",
    "https://www.youtube.com/playlist?list=RDMM",
    `https://www.youtube.com/playlist?list=${youtube}&list=${youtube}`,
    `https://www.youtube.com/shorts/gTHYH1CefOk?list=${youtube}`,
    `https://youtu.be.bad.invalid/gTHYH1CefOk?list=${youtube}`,
    `https://open.spotify.com/playlist/${spotify}`,
  ]) {
    assert.equal(parsePlaylist(url, "youtube"), null);
  }
  assert.equal(normalizeName(" ".repeat(4)), null);
  assert.equal(normalizeName("a".repeat(61)), null);
});

test("acepta mixes de YouTube y conserva el significado de los enlaces de playlists", () => {
  assert.deepEqual(parseStationUrl(providerUrl(mix), "youtube", mix.name), mix);
  assert.deepEqual(parseStationUrl("https://youtu.be/gTHYH1CefOk?t=30", "youtube", mix.name), mix);
  assert.deepEqual(parseStationUrl(`https://youtu.be/gTHYH1CefOk?list=${youtube}`, "youtube", custom.name), custom);
  for (const url of [
    "https://youtube.com.bad.invalid/watch?v=gTHYH1CefOk",
    "https://youtube.com/watch?v=gTHYH1CefOk&v=abcd1234567",
    "https://youtu.be/gTHYH1CefOk?list=RDMM",
    "https://youtube.com/watch_videos?video_ids=gTHYH1CefOk",
  ]) {
    assert.equal(parseStationUrl(url, "youtube", mix.name), null);
  }
  assert.equal(parseStationUrl(providerUrl(mix), "spotify", mix.name), null);
});

test("comparte y recupera estaciones de video sin alterar el formato de playlists", () => {
  const { searchParams } = new URL(shareHref(mix, "https://leonida-fm.test/"));
  assert.deepEqual(readSharedStation(searchParams), mix);
  assert.ok(searchParams.has("video"));
  searchParams.append("playlist", youtube);
  assert.equal(readSharedStation(searchParams), null);
  const saved = { version: 1, stations: [custom, mix], selectedKey: stationKey(mix) };
  assert.deepEqual(readSavedRadio(JSON.stringify(saved)), saved);
});

test("elige una estación del proveedor y preserva el nombre local al coincidir con una sugerida", () => {
  const presets = stationCollection([]);
  const starter = stationForProvider(presets, "youtube");
  const customStarter = { ...starter, name: "Mi Cocoteo" };
  const collection = stationCollection([custom, customStarter]);
  assert.deepEqual(collection.filter((station) => stationKey(station) === stationKey(starter)), [customStarter]);
  assert.deepEqual(stationForProvider(collection, "youtube"), customStarter);
  assert.deepEqual(stationForProvider(collection, "youtube", stationKey(custom)), custom);
  assert.deepEqual(stationForProvider(collection, "spotify", stationKey(custom)), DEFAULT_STATION);
  const saved = { version: 1, stations: [], selectedKey: stationKey(starter) };
  assert.deepEqual(readSavedRadio(JSON.stringify(saved)), saved);
});

test("los catálogos incluidos tienen enlaces válidos y conservan la estación de Cocoteo", () => {
  const presets = stationCollection([]);
  assert.equal(presets.filter((station) => station.provider === "spotify").length, 23);
  assert.equal(presets.filter((station) => station.provider === "youtube").length, 8);
  assert.equal(new Set(presets.map(stationKey)).size, presets.length);
  for (const station of presets) {
    const { searchParams } = new URL(shareHref(station, "https://leonida-fm.test/"));
    assert.deepEqual(readSharedStation(searchParams), station);
    const queue = youtubeQueue(station.videoId);
    if (queue) {
      assert.ok(queue.length > 1);
      assert.ok(queue.every((id) => /^[a-zA-Z0-9_-]{11}$/.test(id)));
      assert.equal(new URL(providerUrl(station)).searchParams.get("v"), queue[0]);
    }
  }
  const circoloco = presets.find((station) => station.provider === "youtube" && station.name === "CircoLoco Records Radio");
  assert.ok(circoloco);
  const circolocoUrl = "https://www.youtube.com/playlist?list=PLWHWWpDdwuvo";
  assert.equal(providerUrl(circoloco), circolocoUrl);
  assert.deepEqual(parseStationUrl(circolocoUrl, "youtube", circoloco.name), circoloco);
  assert.equal(stationKey(DEFAULT_YOUTUBE_STATION), "youtube:video:ATokyG0gs8k");
  assert.notEqual(new URL(providerUrl(DEFAULT_YOUTUBE_STATION)).searchParams.get("v"), DEFAULT_YOUTUBE_STATION.videoId);
});

test("desbloquea las dos emisoras de Spotify tras sintonizar cinco emisoras principales distintas", () => {
  const presets = stationCollection([]);
  const main = presets.filter((station) => station.provider === "spotify" &&
    stationKey(station) !== DEFAULT_KEY && !stationProfile(station)?.unlockable);
  const count = (saved: ReturnType<typeof emptyRadio>) => availableStations(saved)
    .filter((station) => station.provider === "spotify").length;
  const initial = emptyRadio();
  assert.equal(count(initial), 21);
  assert.ok(availableStations(initial).some((station) => station.provider === "youtube" && station.name === "The Vault Radio"));
  const four = main.slice(0, 4).reduce((saved, station) => saveTunedStation(saved, stationKey(station)), initial);
  const repeated = saveTunedStation(saveTunedStation(four, DEFAULT_KEY), stationKey(main[0]));
  assert.equal(count(repeated), 21);
  const restored = readSavedRadio(JSON.stringify(repeated));
  const unlocked = saveTunedStation(restored, stationKey(main[4]));
  assert.equal(count(readSavedRadio(JSON.stringify(unlocked))), 23);
});

test("comparte nombre Unicode y conserva solo los datos de la estación", () => {
  const url = new URL(shareHref(custom, "https://leonida-fm.test/?other=private#hash"));
  assert.equal(url.origin, "https://leonida-fm.test");
  assert.deepEqual([...url.searchParams.keys()], ["station", "provider", "playlist", "name"]);
  assert.equal(url.hash, "");
  assert.deepEqual(readSharedStation(url.searchParams), custom);
});

test("rechaza enlaces compartidos alterados o duplicados", () => {
  const { searchParams } = new URL(shareHref(custom, "https://leonida-fm.test/"));
  searchParams.append("name", "Duplicado");
  assert.equal(readSharedStation(searchParams), null);
  searchParams.delete("name");
  searchParams.set("name", "Nombre válido");
  searchParams.set("playlist", "../video");
  assert.equal(readSharedStation(searchParams), null);
});

test("recupera colección ordenada, descarta datos inválidos y protege la estación fija", () => {
  const other: Station = { provider: "spotify", playlistId: spotify, name: "Otra estación" };
  const legacy = {
    stations: [DEFAULT_STATION, null, custom, { ...custom, name: "Duplicada" }, { provider: "otro" }, other],
    selectedKey: stationKey(custom),
  };
  const saved = { version: 1, stations: [custom, other], selectedKey: stationKey(custom) };
  assert.deepEqual(readSavedRadio(JSON.stringify(legacy)), saved);
  assert.deepEqual(readSavedRadio(JSON.stringify(saved)), saved);
  assert.equal(readSavedRadio(JSON.stringify({ ...saved, selectedKey: "missing" })).selectedKey, DEFAULT_KEY);
});

test("recupera valores iniciales ante JSON corrupto, ausente o de versión desconocida", () => {
  for (const value of [null, "{mal", "null", '{"version":2,"stations":[]}']) {
    assert.deepEqual(readSavedRadio(value), emptyRadio());
  }
});

test("restaura favoritas guardadas y reúne las dos fuentes de una misma emisora", () => {
  const presets = stationCollection([]);
  const spotify = presets.find((station) => station.name === "CircoLoco Records Radio" && station.provider === "spotify");
  const youtube = presets.find((station) => station.name === "CircoLoco Records Radio" && station.provider === "youtube");
  assert.ok(spotify && youtube);
  assert.equal(favoriteStationKey(youtube), favoriteStationKey(spotify));

  const favoriteKeys = [stationKey(youtube), stationKey(spotify), stationKey(custom), "missing", null];
  const saved = readSavedRadio(JSON.stringify({ ...emptyRadio(), stations: [custom], favoriteKeys }));
  assert.deepEqual(saved.favoriteKeys, [stationKey(spotify), stationKey(custom)]);
  assert.equal(saved.selectedKey, DEFAULT_KEY);
});

test("clasifica respuestas oEmbed de YouTube", () => {
  assert.equal(oembedProblem(200), null);
  assert.match(oembedProblem(404) ?? "", /playlist.*privado/);
  assert.match(oembedProblem(404, true) ?? "", /video/);
  assert.match(oembedProblem(401) ?? "", /incrustar/);
  assert.equal(oembedProblem(500), null);
  assert.equal(new URL(youtubeOembedUrl(mix)).searchParams.get("url"), providerUrl(mix));
});

test("salta a la siguiente estación reproducible de forma circular", () => {
  const make = (playlistId: string): Station => ({ provider: "youtube", playlistId, name: playlistId });
  const list = [make("PLaaaaaaaaaaa"), make("PLbbbbbbbbbbb"), make("PLccccccccccc")];
  const failed = new Set([stationKey(list[1])]);
  assert.equal(nextPlayable(list, 0, failed)?.playlistId, "PLccccccccccc");
  assert.equal(nextPlayable(list, 2, failed)?.playlistId, "PLaaaaaaaaaaa");
  failed.add(stationKey(list[0])).add(stationKey(list[2]));
  assert.equal(nextPlayable(list, 0, failed), null);
});

test("la rueda mantiene la estación activa y llena los lugares al llegar al final", () => {
  const total = 18;
  const size = 8;
  const stations = Array.from({ length: total }, (_, index) => index);
  for (const active of stations) {
    const start = stationWindowStart(active, total, size);
    const visible = stations.slice(start, start + size);
    assert.equal(visible.length, size);
    assert.ok(visible.includes(active));
  }
  assert.equal(stationWindowStart(1, 2, size), 0);
});
