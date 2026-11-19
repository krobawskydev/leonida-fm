import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_KEY, DEFAULT_STATION, emptyRadio, normalizeName, parsePlaylist,
  readSavedRadio, readSharedStation, shareHref, stationKey,
} from "../src/lib/stations.ts";
import type { Station } from "../src/types/station.ts";

const spotify = "18CtdtRLbksPWxGq7Kn9ZD";
const youtube = "PLBCF2DAC6FFB574DE";
const custom: Station = { provider: "youtube", playlistId: youtube, name: "Vía & neón 🎧" };

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
