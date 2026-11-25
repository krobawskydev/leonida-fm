import type { Station } from "../types/station.ts";

// Shared dial order, genre and frequency. Playlist sources are in docs/RESEARCH.md.
const spotifyStations = [
  ["Leonida Radio", "37i9dQZF1DX6RSJAsEDz7H", "Selección GTA", 88.1],
  ["Cocoteo FM", "2BBN7ErBxIyJUaoAjoxWpN", "Reguetón y dembow", 88.7],
  ["Radio La Ola", "6s2WubrGTSBUOy0ETMKf5v", "Salsa clásica", 89.3],
  ["AfroBank FM", "78KofRsrJuxxIERsUwB29p", "Afrobeat y amapiano", 89.9],
  ["Radio On-U", "51NkvBe3E1tWe0D922ilUD", "Reggae y dub", 90.5],
  ["Worldwide FM", "2Zp4qrABQJluiaJxf9HZgE", "Jazz, soul y house", 91.1],
  ["Leonida Jazz Radio", "2GX6ULaEPy7SEaYRVMwasJ", "Jazz fusión", 91.7],
  ["Flash FM", "3Y0rvudcTFudnZPCd9P0zN", "Pop actual", 92.3],
  ["Vice City FM", "2Sz7cpwnFd76Vi8Vw9oewq", "Pop de los 80", 92.9],
  ["Kaleidoscope FM", "3e5SJE5eodeENlOzbHNt5r", "Versiones y pop", 93.5],
  ["Dirty South Classics", "73Q6d5NMwKED7bLPHiyZg9", "Rap sureño", 94.1],
  ["Vice City Rap Radio", "31x25723hBHIc2alR6UqZ6", "Rap actual y trap", 94.7],
  ["Honey FM", "6Xyu4b7HiQX4DjvyxrPebY", "R&B y soul", 95.3],
  ["CircoLoco Records Radio", "3MEMCprk4ADKxc2OXfFKzp", "House y techno", 96.1],
  ["Stockyard FM", "7oYLH18JClFgILmZo6mEt6", "Indie dance", 96.7],
  ["Back Country Radio", "55co1YrRBojltkoWRb529c", "Country y americana", 97.1],
  ["Symphony FM", "1arv3Uq0vv76LTiv1pY3Zj", "Música clásica", 97.7],
  ["Emotion 98.3", "2TdFTDj2zHd1iOaYKhd7Hb", "Soft rock y baladas", 98.3],
  ["V-Rock", "55x6P5rx55HFEkLDMEwRcw", "Rock clásico", 100.1],
  ["Gloriana Blues Radio", "3XcU1TZv88cf3h6JS4MJ8p", "Blues", 102.1],
  ["The Chamber 106.6", "4NAn1hqrxdhmrrZbbNZzoR", "Metal", 106.6],
  ["The Sniper of La Perle", "1Kx703Ud00u9k7vVB3SJfO", "Kompa y rabòday", 106.9, true],
  ["The Vault Radio", "2SfjpwQZD0dr7vKbBz4ALu", "Electrónica de club", 107.1, true],
] as const satisfies readonly (readonly [name: string, playlistId: string, genre: string, frequency: number, unlockable?: true])[];

const spotifyPresets = spotifyStations.map(([name, playlistId]): Station => ({ provider: "spotify", playlistId, name }));

export const DEFAULT_STATION = spotifyPresets[0];
export const PRESET_PROFILES = new Map<string, { genre: string; frequency: number; unlockable?: true }>(
  spotifyStations.map(([name, , genre, frequency, unlockable]) => [name, { genre, frequency, unlockable }]),
);

export const DEFAULT_YOUTUBE_STATION: Station = { provider: "youtube", videoId: "ATokyG0gs8k", name: "Cocoteo FM" };

const youtubeStations = [
  // Keep the original key so saved selections and share links still resolve.
  { station: DEFAULT_YOUTUBE_STATION, videos: [
    "myDIeOjqQos", "KktT_jxfR8s", "8zcZC4HVr68", "76R2Q9vObqI",
    "iuDkLDeGaus", "5VOP0A491sg", "wkEnSsnN_nE", "hoQmSA6MRAk",
  ] },
  { station: { provider: "youtube", videoId: "fXl5dPuiJa0", name: "AfroBank FM" }, videos: [
    "fXl5dPuiJa0", "0NAdS4Dp_bc", "pQ_jb9qxxH0", "2FRnfzphm8s",
    "CT3LaHZaPvY", "nVpK-WjxqWE", "Ue4G12_m5eI", "uR3uCMGh69U",
  ] },
  { station: { provider: "youtube", videoId: "kjAuUXdSFaM", name: "Flash FM" }, videos: [
    "kjAuUXdSFaM", "MmZexg8sxyk", "N1o-jptI974", "VBKnzlBP95A",
    "UqdOZmMQfSk", "Cq4G5D_Ct9A", "HSC-U1Slpnc", "HN1CvKvO8FU",
  ] },
  { station: { provider: "youtube", videoId: "MKGQ5cIw_ew", name: "Dirty South Classics" }, videos: [
    "MKGQ5cIw_ew", "pr0lCgPIMGI", "7lOthFpn9os", "-0llNuv3L4k",
    "SCPTKb1ELH0", "sZ0qwxlUAbk", "kBGab7g25Cw", "FCDXwGwgXso",
  ] },
  { station: { provider: "youtube", videoId: "QG52v7AOVVU", name: "Back Country Radio" }, videos: [
    "QG52v7AOVVU", "Gft_kG9cfJg", "44Sgl8a41EA", "YF8lUDJi6cw",
    "cwOGtP2yv1E", "9leAwpph-xs", "8kAU3B9Pi_U", "7PQXyj34JLw",
  ] },
  { station: { provider: "youtube", videoId: "6J_fFxfpjE0", name: "Radio On-U" }, videos: [
    "6J_fFxfpjE0", "Gi_eZr0YDBk", "JPKYx8iB_O8", "fxOXoMIPXk4",
    "CX8gu-hwx-Q", "SCLzBtjC9a8", "MJov0muy_QQ", "AAw5u2UQo44",
  ] },
  { station: { provider: "youtube", videoId: "-1EEuE_XxxU", name: "The Vault Radio" }, videos: [
    "-1EEuE_XxxU", "VkWg1xOQwTI", "Qy1r6I2ubVM", "ruwJJyUSvgU",
    "RKP_pLwFvfc", "nCTmUMGgwu0", "vHtcK1LqBgQ", "W-CXH92ve4U",
  ] },
] as const;

const youtubePresets: Station[] = [
  ...youtubeStations.map(({ station }) => station),
  { provider: "youtube", playlistId: "PLWHWWpDdwuvo", name: "CircoLoco Records Radio" },
];
youtubePresets.sort((a, b) =>
  (PRESET_PROFILES.get(a.name)?.frequency ?? 108) - (PRESET_PROFILES.get(b.name)?.frequency ?? 108),
);

export const PRESET_STATIONS: readonly Station[] = [
  ...spotifyPresets,
  ...youtubePresets,
];

const youtubeQueues = new Map<string, readonly string[]>(youtubeStations.map(({ station, videos }) => [station.videoId, videos]));

export function youtubeQueue(videoId: string | undefined) {
  return videoId === undefined ? undefined : youtubeQueues.get(videoId);
}
