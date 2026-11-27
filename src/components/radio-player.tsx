"use client";

import { useEffect, useEffectEvent, useRef, useState, type Ref } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { youtubeQueue } from "@/lib/station-presets";
import { PROVIDERS, providerUrl } from "@/lib/stations";
import { isYouTubeContentError, nextYouTubeTrack } from "@/lib/youtube-recovery";
import type { Station } from "@/types/station";
import { SpotifyEmbed, type SpotifyTuner } from "./spotify-embed";

const EMBED_PERMISSIONS = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
const LOAD_TIMEOUT = 12_000;
const SKIP_DELAY = 5;
const PLAYLIST_RETRY_DELAY = 1500;
const YOUTUBE_PLAYING = 1;

interface YouTubePlayer {
  destroy(): void;
  getPlaylist(): string[] | undefined;
  getPlaylistIndex(): number;
  playVideoAt(index: number): void;
}

interface YouTubeApi {
  Player: new (iframe: HTMLIFrameElement, config: {
    events: {
      onError: (event: { data: number; target: YouTubePlayer }) => void;
      onStateChange: (event: { data: number; target: YouTubePlayer }) => void;
    };
  }) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApi: Promise<YouTubeApi> | undefined;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApi) return youtubeApi;

  youtubeApi = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement("script");
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(fail, LOAD_TIMEOUT);

    function cleanup() {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
    }

    function fail() {
      cleanup();
      script.remove();
      reject(new Error("YouTube IFrame API unavailable"));
    }

    window.onYouTubeIframeAPIReady = () => {
      const api = window.YT;
      if (!api?.Player) {
        fail();
        return;
      }
      cleanup();
      resolve(api);
      previous?.();
    };

    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  }).catch((error: unknown) => {
    youtubeApi = undefined;
    throw error;
  });

  return youtubeApi;
}

function youtubeError(code: number) {
  if (code === 2) return "YouTube no pudo interpretar la solicitud del reproductor.";
  if (code === 5) return "El reproductor de YouTube encontró un problema de reproducción.";
  if (code === 100) return "YouTube indica que este video es privado o dejó de estar disponible.";
  if (code === 101 || code === 150) return "YouTube no permite reproducir este video dentro de Leonida FM.";
  if (code === 153) return "YouTube no pudo identificar el reproductor de Leonida FM.";
  return "YouTube no pudo reproducir este contenido.";
}

interface Props {
  station: Station;
  spotifyTuner?: Ref<SpotifyTuner>;
  /** Called when the station cannot play; returns the name of the next station, or null if none is left. */
  onUnplayable?: () => string | null;
  onSkip?: () => void;
}

export function RadioPlayer({ station, spotifyTuner, onUnplayable, onSkip }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(SKIP_DELAY);
  const { provider, playlistId, videoId, name } = station;
  const platform = PROVIDERS[provider];
  const findNextStation = useEffectEvent(() => onUnplayable?.() ?? null);

  useEffect(() => {
    if (provider !== "youtube") return;
    const container = frame.current;
    if (!container) return;
    const iframe = document.createElement("iframe");
    const label = PROVIDERS[provider];
    let player: YouTubePlayer | undefined;
    let alive = true;
    let terminalError = false;
    let playlistRetry: number | undefined;
    let requestedIndex: number | undefined;
    const visited = new Set<number>();

    const timeout = window.setTimeout(() => setError(`El reproductor de ${label} está tardando en cargar.`), LOAD_TIMEOUT);
    iframe.addEventListener("load", () => {
      window.clearTimeout(timeout);
      setError((message) => message.includes("tardando") ? "" : message);
    }, { once: true });
    iframe.addEventListener("error", () => {
      window.clearTimeout(timeout);
      setError(`No se pudo cargar el reproductor de ${label}.`);
    }, { once: true });
    iframe.title = label;
    iframe.allow = EMBED_PERMISSIONS;
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    const queue = youtubeQueue(videoId);

    function clearPlaylistRetry() {
      window.clearTimeout(playlistRetry);
      playlistRetry = undefined;
    }

    function recover(target: YouTubePlayer, code: number, allowRetry: boolean) {
      if (!alive || terminalError) return;
      const contentError = isYouTubeContentError(code);
      if (contentError && (queue || playlistId !== undefined)) {
        const length = target.getPlaylist?.()?.length || queue?.length || 0;
        if (length === 0 && allowRetry) {
          playlistRetry ??= window.setTimeout(() => recover(target, code, false), PLAYLIST_RETRY_DELAY);
          return;
        }
        clearPlaylistRetry();
        const index = nextYouTubeTrack(length, target.getPlaylistIndex?.() ?? -1, requestedIndex, visited);
        if (index !== null) {
          requestedIndex = index;
          target.playVideoAt(index);
          return;
        }
      }
      clearPlaylistRetry();
      terminalError = true;
      setError(youtubeError(code));
      setBlocked(true);
      setNext(contentError ? findNextStation() : null);
    }

    const params = new URLSearchParams({
      enablejsapi: "1",
      origin: window.location.origin,
      playsinline: "1",
    });
    if (playlistId !== undefined) {
      params.set("listType", "playlist");
      params.set("list", playlistId);
    }
    if (queue) params.set("playlist", queue.slice(1).join(","));
    const firstVideo = queue?.[0] ?? videoId;
    iframe.src = `https://www.youtube.com/embed${firstVideo ? `/${firstVideo}` : ""}?${params}`;
    void loadYouTubeApi().then((api) => {
      if (!alive) return;
      player = new api.Player(iframe, {
        events: {
          onError: ({ target, data }) => recover(target, data, true),
          onStateChange: ({ target, data }) => {
            if (!alive || terminalError || data !== YOUTUBE_PLAYING) return;
            clearPlaylistRetry();
            const index = target.getPlaylistIndex?.();
            if (index !== undefined && index >= 0) visited.add(index);
            requestedIndex = undefined;
          },
        },
      });
    }).catch(() => {
      // The standards-based iframe still works when the optional API is blocked.
    });
    container.append(iframe);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      clearPlaylistRetry();
      player?.destroy();
      iframe.remove();
    };
  }, [playlistId, provider, videoId]);

  useEffect(() => {
    if (!blocked || !next || !onSkip) return;
    if (countdown <= 0) {
      onSkip();
      return;
    }
    const tick = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(tick);
  }, [blocked, next, countdown, onSkip]);

  useEffect(() => {
    const iframe = frame.current?.querySelector("iframe");
    if (iframe) iframe.title = `${platform} · ${name}`;
  }, [name, platform, playlistId, videoId]);

  return (
    <section className="player-section" aria-labelledby="player-heading">
      <h3 id="player-heading" className="sr-only">Reproductor de {platform}</h3>
      {provider === "spotify"
        ? <SpotifyEmbed playlistId={playlistId} title={`${platform} · ${name}`} tuner={spotifyTuner} onError={setError} />
        : <div ref={frame} className="embed-frame embed-youtube" hidden={blocked} />}
      {blocked && (
        <div className="embed-frame embed-blocked">
          <TriangleAlert size={28} aria-hidden="true" />
          <strong>No se puede reproducir aquí</strong>
          <p>{error}</p>
          <a className="primary-button" href={providerUrl(station)} target="_blank" rel="noopener noreferrer">
            Ver en {platform} <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      )}
      {blocked && next && onSkip && (
        <p className="player-error" role="status">
          Pasando a «{next}» en {countdown} s.
          <button type="button" className="secondary-button" onClick={() => setNext(null)}>Quedarme aquí</button>
        </p>
      )}
      {error && !blocked && (
        <p className="player-error" role="status">
          <TriangleAlert size={17} aria-hidden="true" /> {error}
          {provider === "youtube" && " Puedes abrir la emisora en YouTube."}
        </p>
      )}
      {provider === "youtube" && !blocked && (
        <a className="player-source" href={providerUrl(station)} target="_blank" rel="noopener noreferrer">
          Abrir en {platform} <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </section>
  );
}
