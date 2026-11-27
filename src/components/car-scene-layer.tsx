"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Load the 3D chunk only on displays that can show the driving view.
const DrivingScene = dynamic(() => import("./driving-scene"), { ssr: false });

const DESKTOP = "(hover: hover) and (pointer: fine) and (min-width: 40.0625rem) and (min-aspect-ratio: 1501 / 1000) and (prefers-reduced-motion: no-preference)";

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function CarSceneLayer({ playing, speedKmh, onSpeedChange, onReadyChange }: {
  playing: boolean;
  speedKmh: number;
  onSpeedChange: (speedKmh: number) => void;
  onReadyChange: (ready: boolean, pending: boolean) => void;
}) {
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
  const [phase, setPhase] = useState<"idle" | "mounted" | "ready" | "lost" | "failed">("idle");
  const [overlayReady, setOverlayReady] = useState(false);

  // Leaving the desktop layout unmounts the canvas, so the next one must earn "ready" again with its own first frame.
  if (!desktop && (phase === "mounted" || phase === "ready" || phase === "lost")) setPhase("idle");

  // Wait for the page to settle before downloading the 3D chunk, and never try without WebGL.
  useEffect(() => {
    if (!desktop || phase !== "idle") return;
    if (!hasWebGL()) { queueMicrotask(() => setPhase("failed")); return; }
    const mount = () => setPhase("mounted");
    if (typeof window.requestIdleCallback === "function") {
      const idle = window.requestIdleCallback(mount, { timeout: 1500 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(mount, 400);
    return () => window.clearTimeout(timer);
  }, [desktop, phase]);

  const sceneReady = desktop && phase === "ready" && overlayReady;
  const scenePending = desktop && (phase === "idle" || phase === "mounted" || (phase === "ready" && !overlayReady));
  useEffect(() => { onReadyChange(sceneReady, scenePending); }, [sceneReady, scenePending, onReadyChange]);

  const ready = useCallback(() => setPhase((p) => (p === "mounted" || p === "lost" ? "ready" : p)), []);
  const fail = useCallback(() => setPhase("failed"), []);
  const lost = useCallback(() => setPhase("lost"), []);

  if (!desktop || phase === "idle" || phase === "failed") return null;
  return (
    <div className={`car-world${sceneReady ? " is-ready" : ""}`} aria-hidden="true">
      <DrivingScene playing={playing} speedKmh={speedKmh} onSpeedChange={onSpeedChange} warming={phase !== "ready"}
        onReady={ready} onFail={fail} onContextLost={lost} onContextRestored={ready} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="car-overlay" src="/car/car.webp" width={1280} height={720} alt=""
        onLoad={() => setOverlayReady(true)} onError={fail} />
    </div>
  );
}
