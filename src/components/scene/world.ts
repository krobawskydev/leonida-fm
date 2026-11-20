// Provenance: nothing in this scene is downloaded or taken from a third party. Every mesh is built from
// three.js primitives (boxes, cylinders and bent frond strips) and every texture is drawn
// on a 2D canvas at load time from the code in ./textures.ts. Hotel names (Solana, Marisol, Altair, ...) are
// fictional. Libraries: three r187 (MIT) and @react-three/fiber 9.8 (MIT).
import * as THREE from "three";
import { SEG_COUNT, SEG_LEN, createStreetKit } from "./street";

/** Cruising speed in m/s (~40 km/h). The camera never moves: the world scrolls past it. */
export const SPEED = 11;
export const FOG_COLOR = "#f3b295";
export const FOG_NEAR = 70;
export const FOG_FAR = 255;
// Horizon and vanishing point as fractions of the 16:9 cockpit image.
export const VANISHING_POINT = { x: 0.494, y: 0.402 };
export const EYE_HEIGHT = 1.22;
// Sun sits low over the sea, right of the road (matches the cockpit photograph).
export const SUN_DIRECTION = new THREE.Vector3(0.61, 0.05, -1).normalize();

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uSun;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
  vec3 ramp(float e) {
    vec3 c0 = vec3(0.969, 0.757, 0.627);
    vec3 c1 = vec3(0.957, 0.659, 0.576);
    vec3 c2 = vec3(0.918, 0.576, 0.659);
    vec3 c3 = vec3(0.714, 0.627, 0.769);
    vec3 c4 = vec3(0.455, 0.714, 0.769);
    vec3 c5 = vec3(0.247, 0.624, 0.698);
    vec3 c6 = vec3(0.110, 0.416, 0.522);
    vec3 c = mix(c0, c1, smoothstep(0.0, 0.05, e));
    c = mix(c, c2, smoothstep(0.05, 0.11, e));
    c = mix(c, c3, smoothstep(0.11, 0.19, e));
    c = mix(c, c4, smoothstep(0.19, 0.27, e));
    c = mix(c, c5, smoothstep(0.27, 0.42, e));
    c = mix(c, c6, smoothstep(0.42, 1.0, e));
    return c;
  }
  void main() {
    vec3 d = normalize(vDir);
    float e = max(d.y, 0.0);
    vec3 col = ramp(e);
    float az = atan(d.x, -d.z);
    float sd = max(dot(d, normalize(uSun)), 0.0);
    // Long pink and apricot cloud streaks, lit from below by the sun.
    vec2 cp = vec2(az * 2.6 + uTime * 0.004, e * 7.0);
    float cloud = smoothstep(0.52, 0.78, fbm(cp * vec2(1.4, 3.2)) * 1.1);
    cloud *= smoothstep(0.04, 0.12, e) * (1.0 - smoothstep(0.26, 0.42, e));
    vec3 cloudCol = mix(vec3(0.93, 0.52, 0.66), vec3(1.0, 0.80, 0.68), pow(sd, 2.0));
    col = mix(col, cloudCol, cloud * 0.8);
    col = mix(col, vec3(1.0, 0.60, 0.30), pow(sd, 5.0) * 0.5);
    col = mix(col, vec3(1.0, 0.78, 0.45), pow(sd, 120.0) * 0.75);
    col = mix(col, vec3(1.0, 0.96, 0.82), smoothstep(0.99935, 0.9997, sd));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SEA_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const SEA_FRAG = /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 uSun;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec3 v = normalize(vWorld - cameraPosition);
    float el = clamp(-v.y, 0.0, 1.0);
    vec3 deep = vec3(0.07, 0.28, 0.37);
    vec3 glow = vec3(0.98, 0.62, 0.45);
    float near = smoothstep(0.0, 0.05, el);
    vec3 col = mix(glow, deep, pow(near, 0.55));
    float az = atan(v.x, -v.z);
    float sunAz = atan(uSun.x, -uSun.z);
    float da = az - sunAz;
    float column = exp(-da * da * 38.0);
    float sparkle = noise(vec2(da * 260.0, el * 900.0 + uTime * 0.35));
    sparkle = smoothstep(0.55, 0.9, sparkle);
    col += vec3(1.0, 0.8, 0.5) * column * (0.35 + sparkle * 0.9) * (1.0 - smoothstep(0.0, 0.05, el) * 0.3);
    // Fine swell lines near the horizon.
    float lines = noise(vec2(vWorld.z * 0.02 + uTime * 0.02, el * 700.0));
    col *= 0.96 + lines * 0.08;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface World {
  group: THREE.Group;
  stats: { recycles: number; distance: number; segmentSpawnDistance: number; seamError: number };
  update(dt: number): void;
  dispose(): void;
}

export function createWorld(anisotropy: number): World {
  const group = new THREE.Group();
  const kit = createStreetKit(anisotropy);
  const stats = { recycles: 0, distance: 0, segmentSpawnDistance: Infinity, seamError: 0 };
  const disposables: { dispose(): void }[] = [];

  group.add(new THREE.HemisphereLight("#8fb8d6", "#a8624c", 1.55));
  const sun = new THREE.DirectionalLight("#ffb274", 3.3);
  sun.position.set(0.61, 0.24, -1).normalize().multiplyScalar(120);
  group.add(sun);

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIRECTION.clone() }, uTime: { value: 0 } },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.position.y = EYE_HEIGHT;
  group.add(sky);
  disposables.push(sky.geometry, skyMat);

  const seaMat = new THREE.ShaderMaterial({
    vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, fog: false,
    uniforms: { uSun: { value: SUN_DIRECTION.clone() }, uTime: { value: 0 } },
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), seaMat);
  sea.position.set(52.6 + 4500, -0.3, -4000);
  sea.frustumCulled = false;
  group.add(sea);
  disposables.push(sea.geometry, seaMat);

  const groundMat = new THREE.MeshLambertMaterial({ color: "#8d8a62" });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 3200).rotateX(-Math.PI / 2), groundMat);
  ground.position.set(52.6 - 1000, -0.06, -1400);
  group.add(ground);
  disposables.push(ground.geometry, groundMat);

  // Ring of road segments that is recycled from behind the camera to far ahead.
  const segments: THREE.Group[] = [];
  for (let i = 0; i < SEG_COUNT; i++) {
    const seg = kit.buildSegment(i);
    seg.position.z = SEG_LEN * 0.5 - i * SEG_LEN;
    segments.push(seg);
    group.add(seg);
  }
  const RECYCLE_Z = SEG_LEN * 1.5;

  function update(dt: number) {
    const d = SPEED * dt;
    stats.distance += d;
    for (const seg of segments) {
      seg.position.z += d;
      if (seg.position.z >= RECYCLE_Z) {
        seg.position.z -= SEG_COUNT * SEG_LEN;
        stats.recycles++;
        // Nearest edge of the recycled stretch, in metres ahead of the camera; must lie beyond the fog.
        stats.segmentSpawnDistance = Math.min(stats.segmentSpawnDistance, -(seg.position.z + SEG_LEN / 2));
      }
    }
    // Neighbouring stretches must stay exactly one stretch apart so lanes and kerbs line up.
    const order = segments.map((seg) => seg.position.z).sort((a, b) => b - a);
    for (let i = 1; i < order.length; i++) stats.seamError = Math.max(stats.seamError, Math.abs(order[i - 1] - order[i] - SEG_LEN));
    skyMat.uniforms.uTime.value += dt;
    seaMat.uniforms.uTime.value += dt;
  }

  return {
    group, stats, update,
    dispose() {
      disposables.forEach((o) => o.dispose());
      kit.dispose();
    },
  };
}
