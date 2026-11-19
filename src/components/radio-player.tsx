"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { PROVIDERS, providerUrl } from "@/lib/stations";
import type { Station } from "@/types/station";

const EMBED_PERMISSIONS = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
const LOAD_TIMEOUT = 12_000;

interface YouTubePlayer {
  destroy(): void;
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

export function RadioPlayer({ station }: { station: Station }) {
  const frame = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const { provider, playlistId, name } = station;
  const platform = PROVIDERS[provider];

  useEffect(() => {
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

    if (provider === "spotify") {
      iframe.src = `https://open.spotify.com/embed/playlist/${playlistId}`;
      iframe.height = "352";
    } else {
      const params = new URLSearchParams({
        listType: "playlist",
        list: playlistId,
        enablejsapi: "1",
        origin: window.location.origin,
        playsinline: "1",
      });
      iframe.src = `https://www.youtube.com/embed?${params}`;
      void loadYouTubeApi().then((api) => {
        if (!alive) return;
        player = new api.Player(iframe, {
          events: { onError: (event) => { if (alive) setError(youtubeError(event.data)); } },
        });
      }).catch(() => {
        // The standards-based iframe still works when the optional API is blocked.
      });
    }
    container.append(iframe);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      player?.destroy();
      iframe.remove();
    };
  }, [playlistId, provider]);

  useEffect(() => {
    const iframe = frame.current?.querySelector("iframe");
    if (iframe) iframe.title = `${platform} · ${name}`;
  }, [name, platform, playlistId]);

  return (
    <section className="player-section" aria-labelledby="player-heading">
      <div className="player-heading">
        <h3 id="player-heading">Reproductor</h3>
        <a href={providerUrl(station)} target="_blank" rel="noopener noreferrer">
          Abrir en {platform} <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
      <div ref={frame} className={`embed-frame embed-${provider}`} />
      {error && (
        <p className="player-error" role="status">
          <TriangleAlert size={17} aria-hidden="true" /> {error} Usa el enlace para abrirlo en {platform}.
        </p>
      )}
    </section>
  );
}
