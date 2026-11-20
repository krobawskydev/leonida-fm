"use client";

import { Component, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EYE_HEIGHT, FOG_COLOR, FOG_FAR, FOG_NEAR, VANISHING_POINT, createWorld, type World } from "./scene/world";

// Per-frame data-* attributes on the canvas are only written outside production (used by the browser checks).
const DIAGNOSTICS = process.env.NODE_ENV !== "production";

interface SceneProps {
  playing: boolean;
  /** Keep the render loop running until the first frames are on screen, even if paused. */
  warming: boolean;
  onReady: () => void;
  onFail: () => void;
  onContextLost: () => void;
  onContextRestored: () => void;
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Moves the principal point so the 3D vanishing point lands on the road's vanishing point in the photograph. */
function installLensShift(camera: THREE.PerspectiveCamera) {
  const original = camera.updateProjectionMatrix.bind(camera);
  camera.updateProjectionMatrix = () => {
    original();
    const e = camera.projectionMatrix.elements;
    e[8] = 1 - 2 * VANISHING_POINT.x;
    e[9] = 2 * VANISHING_POINT.y - 1;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  };
  camera.updateProjectionMatrix();
}

function Street({ worldRef, playing, onReady }: { worldRef: RefObject<World | null>; playing: boolean; onReady: () => void }) {
  const playingRef = useRef(playing);
  const clock = useRef({ time: 0, frames: 0, fpsFrames: 0, fpsTime: 0, ready: false });

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useFrame((state, delta) => {
    const world = worldRef.current;
    if (!world) return;
    const c = clock.current;
    const data = DIAGNOSTICS ? state.gl.domElement.dataset : null;
    if (playingRef.current) {
      const dt = Math.min(delta, 0.1);
      c.time += dt;
      world.update(dt);
      // Tiny suspension sway; translation only, so the horizon never moves.
      state.camera.position.set(Math.sin(c.time * 0.7) * 0.012, EYE_HEIGHT + Math.sin(c.time * 2.3) * 0.004 + Math.sin(c.time * 0.9 + 1) * 0.003, 0);
      c.fpsFrames++;
      c.fpsTime += delta;
      if (c.fpsTime >= 1) {
        if (data) data.fps = String(Math.round(c.fpsFrames / c.fpsTime));
        c.fpsFrames = 0;
        c.fpsTime = 0;
      }
    }
    c.frames++;
    if (data) {
      data.frames = String(c.frames);
      data.recycles = String(world.stats.recycles);
      data.distance = world.stats.distance.toFixed(1);
      data.segmentSpawn = Number.isFinite(world.stats.segmentSpawnDistance) ? world.stats.segmentSpawnDistance.toFixed(1) : "";
      data.seamError = world.stats.seamError.toExponential(2);
    }
    if (!c.ready && c.frames > 2) { c.ready = true; onReady(); }
  });
  return null;
}

export default function DrivingScene({ playing, warming, onReady, onFail, onContextLost, onContextRestored }: SceneProps) {
  const worldRef = useRef<World | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Mirrors the run state on the canvas element so it can be inspected without touching React state.
  useEffect(() => { if (DIAGNOSTICS && canvasRef.current) canvasRef.current.dataset.playing = playing ? "true" : "false"; }, [playing]);
  useEffect(() => {
    const ref = worldRef;
    return () => { ref.current?.dispose(); ref.current = null; };
  }, []);
  return (
    <SceneBoundary onError={onFail}>
      <Canvas
        flat dpr={[1, 1.5]} frameloop={playing || warming ? "always" : "demand"}
        camera={{ fov: 44, near: 0.3, far: 6000, position: [0, EYE_HEIGHT, 0], rotation: [0, 0, 0] }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
        onCreated={({ gl, scene, camera }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); onContextLost(); });
          canvas.addEventListener("webglcontextrestored", () => onContextRestored());
          canvas.setAttribute("aria-hidden", "true");
          if (DIAGNOSTICS) canvas.dataset.playing = "true";
          canvasRef.current = canvas;
          installLensShift(camera as THREE.PerspectiveCamera);
          scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
          const world = createWorld(Math.min(8, gl.capabilities.getMaxAnisotropy()));
          scene.add(world.group);
          worldRef.current = world;
        }}
      >
        <Street worldRef={worldRef} playing={playing} onReady={onReady} />
      </Canvas>
    </SceneBoundary>
  );
}
