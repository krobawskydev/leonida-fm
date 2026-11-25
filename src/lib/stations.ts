import type { Provider, SavedRadio, Station } from "../types/station.ts";

import { DEFAULT_STATION, DEFAULT_YOUTUBE_STATION, PRESET_STATIONS, youtubeQueue } from "./station-presets.ts";

export { DEFAULT_STATION };

export const STORAGE_KEY = "leonida-fm:stations";
export const NAME_LIMIT = 60;
export const PROVIDERS = { spotify: "Spotify", youtube: "YouTube" } as const;

const SPOTIFY_ID = /^[a-zA-Z0-9]{22}$/;
const YOUTUBE_ID = /^(?:PL|OLAK5uy_)[a-zA-Z0-9_-]{10,90}$/;
const YOUTUBE_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com"];

export function stationKey(station: Station) {
  return station.videoId === undefined ? `${station.provider}:${station.playlistId}` : `youtube:video:${station.videoId}`;
}

export const DEFAULT_KEY = stationKey(DEFAULT_STATION);
const PRESETS_BY_KEY = new Map(PRESET_STATIONS.map((station) => [stationKey(station), station]));

export function defaultStationFor(provider: Provider) {
  return provider === "youtube" ? DEFAULT_YOUTUBE_STATION : DEFAULT_STATION;
}

export function stationCollection(customStations: Station[]) {
  const customKeys = new Set(customStations.map(stationKey));
  return [...PRESET_STATIONS.filter((station) => !customKeys.has(stationKey(station))), ...customStations];
}

export function stationWindowStart(activeIndex: number, total: number, size: number) {
  const centered = activeIndex - Math.floor(size / 2);
  return Math.max(0, Math.min(centered, total - size));
}

export function stationForProvider(stations: Station[], provider: Provider, preferredKey = stationKey(defaultStationFor(provider))) {
  return stations.find((station) => station.provider === provider && stationKey(station) === preferredKey)
    ?? stations.find((station) => station.provider === provider)
    ?? defaultStationFor(provider);
}

export function matchingPresetKey(current: Station, provider: Provider) {
  const preset = PRESETS_BY_KEY.get(stationKey(current));
  if (!preset) return undefined;
  const match = PRESET_STATIONS.find((station) => station.provider === provider && station.name === preset.name);
  return match && stationKey(match);
}

export function normalizeName(input: unknown) {
  if (typeof input !== "string") return null;
  const name = input.trim();
  return name.length > 0 && name.length <= NAME_LIMIT && !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : null;
}

function parseHttpsUrl(input: string) {
  if (input.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  return url;
}

export function parsePlaylist(input: string, provider: Provider) {
  const url = parseHttpsUrl(input);
  if (!url) return null;
  if (provider === "spotify") {
    const match = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/([a-zA-Z0-9]{22})\/?$/i.exec(url.pathname);
    return url.hostname === "open.spotify.com" && match ? match[1] : null;
  }

  const isYouTubePage = YOUTUBE_HOSTS.includes(url.hostname) &&
    /^\/(playlist|watch)\/?$/.test(url.pathname);
  const isShortVideoWithList = url.hostname === "youtu.be" &&
    /^\/[a-zA-Z0-9_-]{11}\/?$/.test(url.pathname);
  const lists = url.searchParams.getAll("list");
  return (isYouTubePage || isShortVideoWithList) && lists.length === 1 && YOUTUBE_ID.test(lists[0])
    ? lists[0]
    : null;
}

export function parseStationUrl(input: string, provider: Provider, name: string): Station | null {
  const playlistId = parsePlaylist(input, provider);
  if (playlistId) return { provider, playlistId, name };
  if (provider !== "youtube") return null;

  const url = parseHttpsUrl(input);
  if (!url || url.searchParams.has("list")) return null;
  let videoId: string | undefined;
  if (url.hostname === "youtu.be") {
    videoId = /^\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  } else if (YOUTUBE_HOSTS.includes(url.hostname)) {
    const videos = url.searchParams.getAll("v");
    if (/^\/watch\/?$/.test(url.pathname) && videos.length === 1) videoId = videos[0];
  }
  return videoId && YOUTUBE_VIDEO_ID.test(videoId) ? { provider, videoId, name } : null;
}

export function providerUrl(station: Station) {
  if (station.videoId !== undefined) return `https://www.youtube.com/watch?v=${youtubeQueue(station.videoId)?.[0] ?? station.videoId}`;
  return station.provider === "spotify"
    ? `https://open.spotify.com/playlist/${station.playlistId}`
    : `https://www.youtube.com/playlist?list=${station.playlistId}`;
}

export function youtubeOembedUrl(station: Station) {
  return `https://www.youtube.com/oembed?${new URLSearchParams({ url: providerUrl(station), format: "json" })}`;
}

export function oembedProblem(status: number, video = false) {
  const media = video ? "este video" : "esta playlist";
  if (status === 404) return `YouTube no encuentra ${media}. Puede haberse eliminado o tener acceso privado.`;
  if (status === 401 || status === 403) return `YouTube no permite incrustar ${media} fuera de su sitio.`;
  return null;
}

/** Picks the next station after `from` (circular) whose key is not in `failed`. */
export function nextPlayable(stations: Station[], from: number, failed: ReadonlySet<string>) {
  for (let step = 1; step < stations.length; step++) {
    const candidate = stations[(from + step) % stations.length];
    if (!failed.has(stationKey(candidate))) return candidate;
  }
  return null;
}

function cleanStation(input: unknown): Station | null {
  if (!input || typeof input !== "object") return null;
  const { provider, playlistId, videoId, name: inputName } = input as Record<string, unknown>;
  const name = normalizeName(inputName);
  if (name && provider === "youtube" && playlistId === undefined && typeof videoId === "string" && YOUTUBE_VIDEO_ID.test(videoId)) {
    return { provider, videoId, name };
  }
  if (videoId !== undefined) return null;
  if (!name || typeof playlistId !== "string") return null;
  if (provider === "spotify" && SPOTIFY_ID.test(playlistId)) return { provider, playlistId, name };
  if (provider === "youtube" && YOUTUBE_ID.test(playlistId)) return { provider, playlistId, name };
  return null;
}

export function shareHref(station: Station, base: string) {
  const url = new URL(base);
  url.search = new URLSearchParams({
    station: "1",
    provider: station.provider,
    ...(station.videoId === undefined ? { playlist: station.playlistId } : { video: station.videoId }),
    name: station.name,
  }).toString();
  url.hash = "";
  return url.toString();
}

export function readSharedStation(params: URLSearchParams) {
  if (["station", "provider", "name"].some((key) => params.getAll(key).length !== 1)) {
    return null;
  }
  if (params.get("station") !== "1") return null;
  const playlists = params.getAll("playlist");
  const videos = params.getAll("video");
  if (playlists.length + videos.length !== 1) return null;
  return cleanStation({
    provider: params.get("provider"),
    playlistId: playlists[0],
    videoId: videos[0],
    name: params.get("name"),
  });
}

export function emptyRadio(): SavedRadio {
  return { version: 1, stations: [], selectedKey: DEFAULT_KEY };
}

export function readSavedRadio(raw: string | null): SavedRadio {
  if (!raw) return emptyRadio();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyRadio();
  }
  if (!data || typeof data !== "object") return emptyRadio();
  const { version, stations, selectedKey } = data as Record<string, unknown>;
  if ((version !== 1 && version !== undefined) || !Array.isArray(stations)) return emptyRadio();

  const keys = new Set([DEFAULT_KEY]);
  const custom: Station[] = [];
  for (const entry of stations) {
    const station = cleanStation(entry);
    if (!station) continue;
    const key = stationKey(station);
    if (keys.has(key)) continue;
    keys.add(key);
    custom.push(station);
  }
  return {
    version: 1,
    stations: custom,
    selectedKey: typeof selectedKey === "string" && (keys.has(selectedKey) || PRESETS_BY_KEY.has(selectedKey)) ? selectedKey : DEFAULT_KEY,
  };
}
