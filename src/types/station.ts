export type Provider = "spotify" | "youtube";

export type Station =
  | { provider: Provider; playlistId: string; videoId?: never; name: string }
  | { provider: "youtube"; videoId: string; playlistId?: never; name: string };

export interface SavedRadio {
  version: 1;
  stations: Station[];
  selectedKey: string;
}
