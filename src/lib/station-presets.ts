import type { Station } from "../types/station.ts";

export const DEFAULT_STATION: Station = {
  provider: "spotify",
  playlistId: "37i9dQZF1DX6RSJAsEDz7H",
  name: "Leonida Radio",
};

// Community playlists. Source and attribution links are in docs/RESEARCH.md.
const spotifyStations = [
  ["Cocoteo FM", "2BBN7ErBxIyJUaoAjoxWpN"],
  ["AfroBank FM", "78KofRsrJuxxIERsUwB29p"],
  ["Flash FM", "3Y0rvudcTFudnZPCd9P0zN"],
  ["Dirty South Classics", "73Q6d5NMwKED7bLPHiyZg9"],
  ["Back Country Radio", "55co1YrRBojltkoWRb529c"],
  ["The Chamber 106.6", "4NAn1hqrxdhmrrZbbNZzoR"],
  ["CircoLoco Records Radio", "3MEMCprk4ADKxc2OXfFKzp"],
  ["Emotion 98.3", "2TdFTDj2zHd1iOaYKhd7Hb"],
  ["Gloriana Blues Radio", "3XcU1TZv88cf3h6JS4MJ8p"],
  ["Honey FM", "6Xyu4b7HiQX4DjvyxrPebY"],
  ["Kaleidoscope FM", "3e5SJE5eodeENlOzbHNt5r"],
  ["Leonida Jazz Radio", "2GX6ULaEPy7SEaYRVMwasJ"],
  ["Radio La Ola", "6s2WubrGTSBUOy0ETMKf5v"],
  ["Radio On-U", "51NkvBe3E1tWe0D922ilUD"],
  ["Stockyard FM", "7oYLH18JClFgILmZo6mEt6"],
  ["Symphony FM", "1arv3Uq0vv76LTiv1pY3Zj"],
  ["V-Rock", "55x6P5rx55HFEkLDMEwRcw"],
  ["Vice City FM", "2Sz7cpwnFd76Vi8Vw9oewq"],
  ["Vice City Rap Radio", "31x25723hBHIc2alR6UqZ6"],
  ["Worldwide FM", "2Zp4qrABQJluiaJxf9HZgE"],
  ["The Sniper of La Perle", "1Kx703Ud00u9k7vVB3SJfO"],
  ["The Vault Radio", "2SfjpwQZD0dr7vKbBz4ALu"],
] as const;

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

export const PRESET_STATIONS: readonly Station[] = [
  DEFAULT_STATION,
  ...spotifyStations.map(([name, playlistId]): Station => ({ provider: "spotify", playlistId, name })),
  ...youtubeStations.map(({ station }) => station),
  { provider: "youtube", playlistId: "PLWHWWpDdwuvo", name: "CircoLoco Records Radio" },
];

const youtubeQueues = new Map<string, readonly string[]>(youtubeStations.map(({ station, videos }) => [station.videoId, videos]));

export function youtubeQueue(videoId: string | undefined) {
  return videoId === undefined ? undefined : youtubeQueues.get(videoId);
}
