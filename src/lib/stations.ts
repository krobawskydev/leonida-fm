import type { Provider, SavedRadio, Station } from "../types/station.ts";

export const DEFAULT_STATION: Station = {
  provider: "spotify",
  playlistId: "37i9dQZF1DX6RSJAsEDz7H",
  name: "Leonida Radio",
};
export const STORAGE_KEY = "leonida-fm:stations";
export const NAME_LIMIT = 60;
export const PROVIDERS = { spotify: "Spotify", youtube: "YouTube" } as const;

const SPOTIFY_ID = /^[a-zA-Z0-9]{22}$/;
const YOUTUBE_ID = /^(?:PL|OLAK5uy_)[a-zA-Z0-9_-]{10,90}$/;
const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com"];

export function stationKey(station: Station) {
  return `${station.provider}:${station.playlistId}`;
}

export const DEFAULT_KEY = stationKey(DEFAULT_STATION);

export function normalizeName(input: unknown) {
  if (typeof input !== "string") return null;
  const name = input.trim();
  return name.length > 0 && name.length <= NAME_LIMIT && !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : null;
}

export function parsePlaylist(input: string, provider: Provider) {
  if (input.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;

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

export function providerUrl(station: Station) {
  return station.provider === "spotify"
    ? `https://open.spotify.com/playlist/${station.playlistId}`
    : `https://www.youtube.com/playlist?list=${station.playlistId}`;
}

export function youtubeOembedUrl(playlistId: string) {
  const target = `https://www.youtube.com/playlist?list=${playlistId}`;
  return `https://www.youtube.com/oembed?${new URLSearchParams({ url: target, format: "json" })}`;
}

export function oembedProblem(status: number) {
  if (status === 404) return "YouTube no encuentra esta playlist. Puede ser privada o estar eliminada.";
  if (status === 401 || status === 403) return "YouTube no permite incrustar esta playlist fuera de su sitio.";
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
  const { provider, playlistId, name: inputName } = input as Record<string, unknown>;
  const name = normalizeName(inputName);
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
    playlist: station.playlistId,
    name: station.name,
  }).toString();
  url.hash = "";
  return url.toString();
}

export function readSharedStation(params: URLSearchParams) {
  if (["station", "provider", "playlist", "name"].some((key) => params.getAll(key).length !== 1)) {
    return null;
  }
  if (params.get("station") !== "1") return null;
  return cleanStation({
    provider: params.get("provider"),
    playlistId: params.get("playlist"),
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
    selectedKey: typeof selectedKey === "string" && keys.has(selectedKey) ? selectedKey : DEFAULT_KEY,
  };
}
