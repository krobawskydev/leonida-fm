"use client";

import { useCallback, useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type Ref } from "react";

const API_TIMEOUT = 4500;
const EMBED_TIMEOUT = 12_000;

interface SpotifyController {
  addListener(event: "ready" | "playback_started", handler: () => void): void;
  loadEntity?(uri: string): void;
  loadUri(uri: string): void;
  play(): void;
  destroy(): void;
}

interface SpotifyApi {
  createController(element: HTMLElement, options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyController) => void): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyApi) => void;
  }
}

let spotifyApi: Promise<SpotifyApi> | undefined;

function loadSpotifyApi() {
  if (spotifyApi) return spotifyApi;

  spotifyApi = new Promise<SpotifyApi>((resolve, reject) => {
    const script = document.createElement("script");
    const previous = window.onSpotifyIframeApiReady;
    const timeout = window.setTimeout(fail, API_TIMEOUT);

    function cleanup() {
      window.clearTimeout(timeout);
      window.onSpotifyIframeApiReady = previous;
    }

    function fail() {
      cleanup();
      script.remove();
      reject(new Error("Spotify iFrame API unavailable"));
    }

    window.onSpotifyIframeApiReady = (api) => {
      cleanup();
      resolve(api);
      previous?.(api);
    };
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  }).catch((error: unknown) => {
    spotifyApi = undefined;
    throw error;
  });

  return spotifyApi;
}

function playIfAllowed(controller: SpotifyController) {
  try {
    controller.play();
  } catch {
    // The embed's Play button remains available if the browser blocks autoplay.
  }
}

export interface SpotifyTuner {
  tune(playlistId: string): void;
}

export function SpotifyEmbed({ playlistId, title, tuner, onError }: {
  playlistId: string;
  title: string;
  tuner?: Ref<SpotifyTuner>;
  onError: (message: string) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const controller = useRef<SpotifyController | null>(null);
  const loadedPlaylist = useRef<string | null>(null);
  const hasPlayed = useRef(false);
  const retryAutoplay = useRef(false);
  const [fallback, setFallback] = useState(false);

  const loadPlaylist = useCallback((id: string, autoplay = false) => {
    const player = controller.current;
    if (!player || id === loadedPlaylist.current) return;

    loadedPlaylist.current = id;
    retryAutoplay.current = autoplay && hasPlayed.current;
    try {
      const uri = `spotify:playlist:${id}`;
      if (player.loadEntity) player.loadEntity(uri);
      else player.loadUri(uri);
    } catch {
      queueMicrotask(() => {
        if (controller.current === player && loadedPlaylist.current === id) setFallback(true);
      });
      return;
    }
    if (retryAutoplay.current) playIfAllowed(player);
  }, []);

  useImperativeHandle(tuner, () => ({ tune: (id) => loadPlaylist(id, true) }), [loadPlaylist]);

  const initialize = useEffectEvent((api: SpotifyApi, placeholder: HTMLElement,
    onController: (player: SpotifyController, initialPlaylist: string) => void) => {
    const initialPlaylist = playlistId;
    api.createController(placeholder, { uri: `spotify:playlist:${initialPlaylist}`, width: "100%", height: 352 },
      (player) => onController(player, initialPlaylist));
  });

  const prepareEmbed = useEffectEvent((player: SpotifyController) => {
    const iframe = frame.current?.querySelector("iframe");
    if (iframe) iframe.title = title;
    loadPlaylist(playlistId);
    if (retryAutoplay.current) {
      retryAutoplay.current = false;
      playIfAllowed(player);
    }
  });

  useEffect(() => {
    const host = frame.current;
    if (!host || fallback) return;

    let alive = true;
    let player: SpotifyController | undefined;
    const timeout = window.setTimeout(() => setFallback(true), EMBED_TIMEOUT);

    void loadSpotifyApi().then((api) => {
      if (!alive) return;
      const placeholder = document.createElement("div");
      host.append(placeholder);
      initialize(api, placeholder, (created, initialPlaylist) => {
        if (!alive) {
          created.destroy();
          return;
        }
        player = created;
        created.addListener("playback_started", () => {
          if (!alive) return;
          hasPlayed.current = true;
          retryAutoplay.current = false;
        });
        created.addListener("ready", () => {
          if (!alive) return;
          window.clearTimeout(timeout);
          if (controller.current !== created) {
            controller.current = created;
            loadedPlaylist.current = initialPlaylist;
          }
          prepareEmbed(created);
        });
      });
    }).catch(() => {
      if (alive) setFallback(true);
    });

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      controller.current = null;
      loadedPlaylist.current = null;
      hasPlayed.current = false;
      retryAutoplay.current = false;
      player?.destroy();
      host.replaceChildren();
    };
  }, [fallback]);

  useEffect(() => {
    loadPlaylist(playlistId);
    const iframe = frame.current?.querySelector("iframe");
    if (iframe) iframe.title = title;
  }, [loadPlaylist, playlistId, title]);

  if (fallback) {
    return <SpotifyFallback playlistId={playlistId} title={title} onError={onError} />;
  }
  return <div ref={frame} className="embed-frame embed-spotify" />;
}

function SpotifyFallback({ playlistId, title, onError }: {
  playlistId: string;
  title: string;
  onError: (message: string) => void;
}) {
  const timeout = useRef<number | undefined>(undefined);
  useEffect(() => {
    timeout.current = window.setTimeout(() => onError("El reproductor de Spotify está tardando en cargar."), EMBED_TIMEOUT);
    return () => window.clearTimeout(timeout.current);
  }, [onError, playlistId]);

  return (
    <div className="embed-frame embed-spotify">
      <iframe key={playlistId} title={title} src={`https://open.spotify.com/embed/playlist/${playlistId}`} height="352"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => { window.clearTimeout(timeout.current); onError(""); }}
        onError={() => { window.clearTimeout(timeout.current); onError("No se pudo cargar el reproductor de Spotify."); }} />
    </div>
  );
}
