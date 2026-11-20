"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// The 3D chunk (three.js + react-three-fiber) is only fetched once the desktop cockpit is on screen.
const DrivingScene = dynamic(() => import("./driving-scene"), { ssr: false });

export type SceneStatus = "static" | "loading" | "ready";

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

/** Static photo stays visible until the first 3D frame is drawn; any failure drops back to it. */
export function CarSceneLayer({ playing, onStatus }: { playing: boolean; onStatus: (status: SceneStatus) => void }) {
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
  const [phase, setPhase] = useState<"idle" | "mounted" | "ready" | "lost" | "failed">("idle");

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

  const status: SceneStatus = !desktop || phase === "failed" || phase === "lost" ? "static" : phase === "ready" ? "ready" : "loading";
  useEffect(() => { onStatus(status); }, [status, onStatus]);

  const ready = useCallback(() => setPhase((p) => (p === "mounted" || p === "lost" ? "ready" : p)), []);
  const fail = useCallback(() => setPhase("failed"), []);
  const lost = useCallback(() => setPhase("lost"), []);

  if (!desktop || phase === "idle" || phase === "failed") return null;
  return (
    <div className={`car-world${phase === "ready" ? " is-ready" : ""}`} data-scene={phase} aria-hidden="true">
      <DrivingScene playing={playing} warming={phase !== "ready"} onReady={ready} onFail={fail} onContextLost={lost} onContextRestored={ready} />
    </div>
  );
}
