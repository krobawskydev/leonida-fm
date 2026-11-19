export type Provider = "spotify" | "youtube";

export interface Station {
  provider: Provider;
  playlistId: string;
  name: string;
}

export interface SavedRadio {
  version: 1;
  stations: Station[];
  selectedKey: string;
}
