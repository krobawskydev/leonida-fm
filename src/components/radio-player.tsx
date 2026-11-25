"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { youtubeQueue } from "@/lib/station-presets";
import { PROVIDERS, providerUrl } from "@/lib/stations";
import type { Station } from "@/types/station";
import { SpotifyEmbed, type SpotifyTuner } from "./spotify-embed";

const EMBED_PERMISSIONS = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
const LOAD_TIMEOUT = 12_000;
const SKIP_DELAY = 5;

interface YouTubePlayer {
  destroy(): void;
  getPlaylistIndex(): number;
  playVideoAt(index: number): void;
}

interface YouTubeApi {
  Player: new (iframe: HTMLIFrameElement, config: {
    events: { onError: (event: { data: number }) => void };
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
  if (code === 100) return "YouTube indica que este video es privado o dejó de estar disponible.";
  if (code === 101 || code === 150) return "YouTube no permite reproducir este video dentro de Leonida FM.";
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

  useEffect(() => {
    if (provider !== "youtube") return;
    const container = frame.current;
    if (!container) return;
    const iframe = document.createElement("iframe");
    const label = PROVIDERS[provider];
    let player: YouTubePlayer | undefined;
    let alive = true;

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
      let nextIndex = 1;
      player = new api.Player(iframe, {
        events: {
          onError: (event) => {
            if (!alive) return;
            if (queue && player && [2, 5, 100, 101, 150].includes(event.data)) {
              const index = Math.max(nextIndex, player.getPlaylistIndex() + 1);
              if (index < queue.length) {
                nextIndex = index + 1;
                player.playVideoAt(index);
                return;
              }
            }
            setError(youtubeError(event.data));
            setBlocked(true);
            setNext(onUnplayable?.() ?? null);
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
      player?.destroy();
      iframe.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
