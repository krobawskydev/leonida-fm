import * as THREE from "three";
import { createPalmKit, type PalmSpec } from "./props";
import {
  ROAD, asphaltTexture, awningTexture, blobTexture, facadeTextures, grassTexture, limestoneTexture, lowerSignTexture,
  neonSignTexture, paverTexture, rng, sandTexture, sideWallTexture, type FacadeSpec,
} from "./textures";

export const SEG_LEN = ROAD.length;
const FRONT = -14.6; // hotel frontage line (x)
export const SHADOW_DIR = new THREE.Vector2(-0.52, 0.85); // where shadows fall (x, z): away from the sun at the right

interface HotelSpec extends FacadeSpec {
  name: string;
  w: number;
  depth: number;
  floors: number;
  floorH: number;
  awning: string;
  round?: boolean;
  tower?: { w: number; extra: number; z: number; sign?: string };
  step?: boolean;
  roofSign?: boolean;
}

// Eight different original hotels. Names are fictional.
const HOTELS: HotelSpec[] = [
  { name: "Solana", w: 26, depth: 12, floors: 3, floorH: 3.5, wall: "#bfe3d2", trim: "#f6f0e4", accent: "#e7a29a", neon: "#ff5fa8", style: "bands", seed: 1, awning: "#e8837a", tower: { w: 7, extra: 2, z: -6, sign: "SOLANA" } },
  { name: "Coral Cove", w: 28, depth: 12, floors: 3, floorH: 3.3, wall: "#f2a58f", trim: "#fcf2e6", accent: "#7fd4c6", neon: "#4ff0e0", style: "portholes", seed: 2, awning: "#3fb7ab", step: true, roofSign: true },
  { name: "Aurelia", w: 30, depth: 12, floors: 3, floorH: 3.6, wall: "#f6ecda", trim: "#ffffff", accent: "#f2a2a8", neon: "#ff7a59", style: "streamline", seed: 3, awning: "#d95b6a", round: true },
  { name: "Marisol", w: 24, depth: 12, floors: 4, floorH: 3.2, wall: "#f7d1b2", trim: "#faf3ea", accent: "#78b9d6", neon: "#7be0ff", style: "grid", seed: 4, awning: "#4aa5c8", tower: { w: 5, extra: 1, z: 8, sign: "MARISOL" } },
  { name: "Luna Palm", w: 27, depth: 12, floors: 3, floorH: 3.4, wall: "#f3b4c3", trim: "#fff5ee", accent: "#8fd9c9", neon: "#ffd36a", style: "bands", seed: 5, awning: "#4bb8a6", round: true, roofSign: true },
  { name: "Altair", w: 25, depth: 12, floors: 4, floorH: 3.2, wall: "#d8cdea", trim: "#ffffff", accent: "#f09aa5", neon: "#9ef0ff", style: "portholes", seed: 6, awning: "#c75a86", step: true, tower: { w: 6, extra: 2, z: 5, sign: "ALTAIR" } },
  { name: "Seabreeze", w: 29, depth: 12, floors: 3, floorH: 3.5, wall: "#9edad7", trim: "#fff6ea", accent: "#f5b27a", neon: "#ff6fa5", style: "streamline", seed: 7, awning: "#f08a5a" },
  { name: "Casa Vera", w: 26, depth: 12, floors: 4, floorH: 3.2, wall: "#f5e1a6", trim: "#fffaf0", accent: "#e9857a", neon: "#7ae8d8", style: "bands", seed: 8, awning: "#e0605d", tower: { w: 5.5, extra: 1, z: -7, sign: "VERA" } },
];

const PROMENADE_SEGMENTS = 4;
const COAST_SEGMENTS = 3;
export const SEG_COUNT = HOTELS.length + PROMENADE_SEGMENTS + COAST_SEGMENTS;

function scaleUV(geo: THREE.BufferGeometry, su: number, sv: number) {
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}

function flatPlane(w: number, l: number, su = 1, sv = 1) {
  const g = new THREE.PlaneGeometry(w, l);
  g.rotateX(-Math.PI / 2);
  return scaleUV(g, su, sv);
}

export function createStreetKit(anisotropy: number) {
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T) => { disposables.push(d); return d; };
  const palms = own(createPalmKit(anisotropy));

  const road = [0, 1, 2].map((v) => own(new THREE.MeshLambertMaterial({ map: own(asphaltTexture(v, anisotropy)), emissive: new THREE.Color("#34252d") })));
  const sidewalk = own(new THREE.MeshLambertMaterial({ map: own(paverTexture(anisotropy, [196, 184, 170], 3)) }));
  const path = own(new THREE.MeshLambertMaterial({ map: own(paverTexture(anisotropy, [210, 188, 168], 4)) }));
  const curbMat = own(new THREE.MeshLambertMaterial({ color: "#c9c0b6" }));
  const grass = own(new THREE.MeshLambertMaterial({ map: own(grassTexture(anisotropy)) }));
  const sand = own(new THREE.MeshLambertMaterial({ map: own(sandTexture(anisotropy)) }));
  const wallMat = own(new THREE.MeshLambertMaterial({ map: own(limestoneTexture(anisotropy)), emissive: new THREE.Color("#7a5a48") }));
  const roofMat = own(new THREE.MeshLambertMaterial({ color: "#9b8f86" }));
  const poleMat = own(new THREE.MeshLambertMaterial({ color: "#555866" }));
  const benchMat = own(new THREE.MeshLambertMaterial({ color: "#855a40" }));
  const lanternMat = own(new THREE.MeshBasicMaterial({ color: "#ffd9a0" }));
  const blobMat = own(new THREE.MeshBasicMaterial({ map: own(blobTexture()), transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const blobGeo = own(flatPlane(1, 1));
  const umbrellaMats = ["#f5efe4", "#e45d6f", "#3fb7ab", "#f5efe4"].map((c) => own(new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })));
  const umbrellaGeo = own(new THREE.ConeGeometry(1.15, 0.45, 10, 1, true));
  umbrellaGeo.translate(0, 2.35, 0);
  const tableGeo = own(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 10));
  tableGeo.translate(0, 0.75, 0);
  const stemGeo = own(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5));
  stemGeo.translate(0, 1.2, 0);
  const poleGeo = own(new THREE.CylinderGeometry(0.035, 0.055, 5.6, 8));
  poleGeo.translate(0, 2.8, 0);
  const lanternGeo = own(new THREE.SphereGeometry(0.26, 10, 8));
  lanternGeo.translate(0, 5.75, 0);

  function box(w: number, h: number, d: number, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) {
    const geo = own(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  function buildHotel(spec: HotelSpec) {
    const group = new THREE.Group();
    const H = spec.floors * spec.floorH;
    const main = facadeTextures(spec, spec.w, spec.floors, spec.floorH, anisotropy);
    own(main.map); own(main.emissiveMap);
    const facade = own(new THREE.MeshLambertMaterial({ map: main.map, emissiveMap: main.emissiveMap, emissive: new THREE.Color("#ffffff") }));
    const side = own(new THREE.MeshLambertMaterial({ map: own(sideWallTexture(spec.wall, spec.trim, spec.seed + 40, anisotropy)) }));
    const roof = roofMat;
    const trim = own(new THREE.MeshLambertMaterial({ color: spec.trim }));
    const accent = own(new THREE.MeshLambertMaterial({ color: spec.accent }));
    const neon = own(new THREE.MeshBasicMaterial({ color: spec.neon }));

    const mainBox = box(spec.depth, H, spec.w, [facade, side, roof, roof, side, side], -spec.depth / 2, H / 2, 0);
    // End walls get tiled windows at a believable scale instead of one stretched tile.
    const uv = mainBox.geometry.getAttribute("uv");
    for (let i = 4; i < 24; i++) {
      if (i >= 8 && i < 16) continue;
      const along = i < 8 ? spec.w : spec.depth;
      uv.setXY(i, uv.getX(i) * (along / 6), uv.getY(i) * (H / 6));
    }
    uv.needsUpdate = true;
    group.add(mainBox);
    // Horizontal sun-visors (brims) over every floor, with a thin neon line under the top one.
    for (let f = 1; f <= spec.floors; f++) {
      group.add(box(1.0, 0.14, spec.w + 0.3, trim, 0.5, f * spec.floorH, 0));
    }
    group.add(box(0.06, 0.07, spec.w + 0.1, neon, 1.0, spec.floors * spec.floorH - 0.14, 0));
    group.add(box(0.3, 0.6, spec.w + 0.3, accent, 0.1, H + 0.3, 0)); // parapet
    // Ground-floor awnings with stripes.
    const awnTex = own(awningTexture(spec.awning));
    awnTex.repeat.set(spec.w * 0.7, 1);
    const awnGeo = own(new THREE.BoxGeometry(1.6, 0.08, spec.w * 0.7));
    scaleUV(awnGeo, 1, spec.w * 0.7 / 1.0);
    const awn = new THREE.Mesh(awnGeo, own(new THREE.MeshLambertMaterial({ map: awnTex })));
    awn.position.set(0.85, spec.floorH * 0.78, 0);
    awn.rotation.z = -0.28;
    group.add(awn);

    if (spec.step) {
      const top = box(spec.depth * 0.7, spec.floorH, spec.w * 0.66, [facade, side, roof, roof, side, side], -spec.depth * 0.45, H + spec.floorH / 2 + 0.6, 0);
      group.add(top, box(1.0, 0.14, spec.w * 0.66 + 0.2, trim, -spec.depth * 0.1, H + spec.floorH + 0.6, 0));
    }
    if (spec.round) {
      const r = Math.min(5, spec.depth / 2);
      const drum = new THREE.Mesh(own(new THREE.CylinderGeometry(r, r, H + 0.9, 24)), side);
      drum.position.set(-r + 0.2, (H + 0.9) / 2, spec.w / 2 + r * 0.5);
      group.add(drum);
      const ring = new THREE.Mesh(own(new THREE.CylinderGeometry(r + 0.55, r + 0.55, 0.14, 24)), trim);
      ring.position.set(-r + 0.2, H, spec.w / 2 + r * 0.5);
      group.add(ring);
      const ringNeon = new THREE.Mesh(own(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.09, 24)), neon);
      ringNeon.position.set(-r + 0.2, H - 0.3, spec.w / 2 + r * 0.5);
      group.add(ringNeon);
    }
    if (spec.tower) {
      const t = spec.tower;
      const floors = spec.floors + t.extra;
      const tex = facadeTextures({ ...spec, style: "grid" }, t.w, floors, spec.floorH, anisotropy, "tower");
      own(tex.map); own(tex.emissiveMap);
      const towerMat = own(new THREE.MeshLambertMaterial({ map: tex.map, emissiveMap: tex.emissiveMap, emissive: new THREE.Color("#ffffff") }));
      const th = floors * spec.floorH;
      group.add(box(spec.depth * 0.6 + 0.8, th, t.w, [towerMat, side, roof, roof, side, side], -spec.depth * 0.3 + 0.4, th / 2, t.z));
      // Stepped crown and a spire.
      group.add(box(spec.depth * 0.45, 1.2, t.w * 0.72, trim, -spec.depth * 0.25 + 0.4, th + 0.6, t.z));
      group.add(box(spec.depth * 0.3, 1.0, t.w * 0.42, accent, -spec.depth * 0.2 + 0.4, th + 1.7, t.z));
      const spire = new THREE.Mesh(own(new THREE.CylinderGeometry(0.03, 0.12, 4, 6)), trim);
      spire.position.set(-spec.depth * 0.2 + 0.4, th + 4.2, t.z);
      group.add(spire);
      group.add(box(0.14, 0.14, t.w * 0.9, neon, 1.15, th - 0.5, t.z));
      if (t.sign) {
        const signTex = own(neonSignTexture(t.sign, spec.neon));
        const h = t.sign.length * 0.62 + 0.3;
        const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(0.82, h)), own(new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })));
        sign.position.set(1.5, spec.floorH * 1.4 + h / 2, t.z + t.w / 2 - 0.1);
        group.add(sign);
        group.add(box(1.5, 0.08, 0.08, poleMat, 0.75, spec.floorH * 1.4 + h / 2 + 0.4, t.z + t.w / 2 - 0.1));
      }
    }
    if (spec.roofSign) {
      const signTex = own(lowerSignTexture(spec.name, spec.neon));
      const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(6.6, 1.24)), own(new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })));
      sign.position.set(0.5, H + (spec.step ? spec.floorH + 0.6 : 0) + 1.6, 0);
      sign.rotation.y = Math.PI / 2;
      group.add(sign);
      group.add(box(0.1, 1.0, 0.1, poleMat, 0.2, H + (spec.step ? spec.floorH + 0.6 : 0) + 0.9, -2.8), box(0.1, 1.0, 0.1, poleMat, 0.2, H + (spec.step ? spec.floorH + 0.6 : 0) + 0.9, 2.8));
    }
    return group;
  }

  function shadowBlob(x: number, z: number, sx: number, sz: number, opacity = 1) {
    const mesh = new THREE.Mesh(blobGeo, blobMat);
    mesh.position.set(x, 0.045, z);
    mesh.scale.set(sx, 1, sz);
    mesh.renderOrder = 1;
    mesh.userData.opacity = opacity;
    return mesh;
  }

  /** Builds one 40 m stretch of the avenue, centred on z = 0 and facing the camera. */
  function buildSegment(index: number) {
    const rand = rng(1000 + index * 17);
    const g = new THREE.Group();
    const L = SEG_LEN;
    // Start near the end of the hotel district so the promenade comes into view early.
    const routeIndex = (index + HOTELS.length - 3) % SEG_COUNT;
    const district = routeIndex < HOTELS.length ? "hotels"
      : routeIndex < HOTELS.length + PROMENADE_SEGMENTS ? "promenade" : "coast";

    // Road with lane paint, kerbs and sidewalks.
    const roadMesh = new THREE.Mesh(own(flatPlane(ROAD.x1 - ROAD.x0, L)), road[index % 3]);
    roadMesh.position.set((ROAD.x0 + ROAD.x1) / 2, 0, 0);
    g.add(roadMesh);
    const kerbL = box(0.3, 0.17, L, curbMat, ROAD.x0 - 0.15, 0.085, 0);
    const kerbR = box(0.3, 0.17, L, curbMat, ROAD.x1 + 0.15, 0.085, 0);
    g.add(kerbL, kerbR);
    // Left sidewalk spans from the kerb to the frontage line.
    const lw = ROAD.x0 - 0.3 - FRONT;
    const walkL = new THREE.Mesh(own(flatPlane(lw, L, lw / 2, L / 2)), sidewalk);
    walkL.position.set(FRONT + lw / 2, 0.172, 0);
    g.add(walkL);
    const rw = 3.2;
    const walkR = new THREE.Mesh(own(flatPlane(rw, L, rw / 2, L / 2)), path);
    walkR.position.set(ROAD.x1 + 0.3 + rw / 2, 0.15, 0);
    g.add(walkR);
    // Lawn, sea wall, promenade and sand.
    const lawn = new THREE.Mesh(own(flatPlane(25.5, L, 25.5 / 4, L / 4)), grass);
    lawn.position.set(ROAD.x1 + 0.3 + rw + 12.75, 0.03, 0);
    g.add(lawn);
    const prom = new THREE.Mesh(own(flatPlane(3, L, 1.5, L / 2)), path);
    prom.position.set(35, 0.1, 0);
    g.add(prom);
    const wall = new THREE.Mesh(own(new THREE.BoxGeometry(0.6, 0.45, L)), wallMat);
    wall.position.set(36.9, 0.22, 0);
    scaleUV(wall.geometry, 1, L / 2);
    g.add(wall);
    const beach = new THREE.Mesh(own(flatPlane(15.7, L, 4, L / 4)), sand);
    beach.position.set(44.8, 0.0, 0);
    g.add(beach);

    if (district === "hotels") addHotelFrontage(g, HOTELS[routeIndex], rand);
    else {
      const verge = new THREE.Mesh(own(flatPlane(14, L, 3.5, L / 4)), grass);
      verge.position.set(FRONT - 7, 0.03, 0);
      g.add(verge);
    }
    if (district === "promenade") {
      for (const z of [-10, 10]) {
        const x = FRONT - 1.5;
        g.add(
          box(0.55, 0.12, 2.0, benchMat, x, 0.5, z),
          box(0.1, 0.33, 2.0, benchMat, x - 0.24, 0.73, z),
          box(0.44, 0.47, 0.12, poleMat, x, 0.26, z - 0.75),
          box(0.44, 0.47, 0.12, poleMat, x, 0.26, z + 0.75),
        );
      }
    }

    // Palms (right side park, plus planters on the left sidewalk).
    const palmSpecs: PalmSpec[] = [];
    const roadsidePalms = district === "coast" ? 0 : 5;
    for (let k = 0; k < roadsidePalms; k++) {
      palmSpecs.push({
        x: 9.3 + rand() * 1.6 + (k % 2) * 1.9, z: -L / 2 + (k + 0.2 + rand() * 0.6) * (L / 5), height: 8.5 + rand() * 4,
        lean: 0.03 + rand() * 0.07, dir: rand() * Math.PI * 2, scale: 0.9 + rand() * 0.3, tint: rand(),
      });
    }
    const parkPalms = district === "coast" ? 2 : 4;
    for (let k = 0; k < parkPalms; k++) {
      palmSpecs.push({
        x: 17 + rand() * 15, z: -L / 2 + rand() * L, height: 6.5 + rand() * 3.5,
        lean: 0.1 + rand() * 0.18, dir: rand() * Math.PI * 2, scale: 0.9 + rand() * 0.3, tint: rand(),
      });
    }
    const leftPalms = district === "promenade" ? 6 : district === "hotels" ? 3 : 1;
    for (let k = 0; k < leftPalms; k++) {
      const z = -L / 2 + (k + 0.5) * (L / leftPalms) + (rand() - 0.5) * 3;
      const x = district === "hotels" ? FRONT + 1.6 + rand() * 1.2 : FRONT - 4.0 - rand() * 7;
      const height = district === "promenade" ? 8.5 + rand() * 4 : 4.2 + rand() * 2.2;
      palmSpecs.push({ x, z, height, lean: 0.05 + rand() * 0.08, dir: rand() * Math.PI * 2, scale: 0.8, tint: rand() });
    }
    g.add(palms.build(palmSpecs, SHADOW_DIR));

    // Street lamps (kerb on both sides).
    const lampXs = [ROAD.x0 - 0.45, ROAD.x1 + 0.6];
    for (const lx of lampXs) {
      for (let k = 0; k < 2; k++) {
        const lz = -L / 2 + (k + 0.3 + rand() * 0.2) * (L / 2);
        const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(lx, 0.17, lz);
        const lantern = new THREE.Mesh(lanternGeo, lanternMat); lantern.position.set(lx, 0.17, lz);
        g.add(pole, lantern, shadowBlob(lx - 2.4, lz + 4, 0.9, 7, 0.6));
      }
    }

    // Leave the middle beach segment clear for an uninterrupted view of the sea.
    if (district === "coast" && (routeIndex === SEG_COUNT - COAST_SEGMENTS || routeIndex === SEG_COUNT - 1)) {
      const color = routeIndex === SEG_COUNT - 1 ? "#f6c26b" : "#f48fb1";
      const hutMat = own(new THREE.MeshLambertMaterial({ color }));
      const hut = box(2.2, 1.7, 2.2, hutMat, 42, 1.9, rand() * 20 - 10);
      const roofTop = box(2.8, 0.18, 2.8, own(new THREE.MeshLambertMaterial({ color: "#f6efe2" })), 42, 2.85, hut.position.z);
      const legGeo = own(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 5));
      const legs = [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].map(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, poleMat); leg.position.set(42 + lx, 0.55, hut.position.z + lz); return leg;
      });
      g.add(hut, roofTop, ...legs, shadowBlob(41.2, hut.position.z + 1.5, 4.5, 6));
    }

    return g;
  }

  function addHotelFrontage(g: THREE.Group, spec: HotelSpec, rand: ReturnType<typeof rng>) {
    const hotel = buildHotel(spec);
    const hz = -SEG_LEN / 2 + spec.w / 2 + 1 + rand() * (SEG_LEN - spec.w - 2);
    hotel.position.set(FRONT, 0.17, hz);
    g.add(hotel);

    // Café tables with umbrellas on the sidewalk.
    const count = 5;
    const tables = new THREE.InstancedMesh(tableGeo, poleMat, count);
    const stems = new THREE.InstancedMesh(stemGeo, poleMat, count);
    const m4 = new THREE.Matrix4();
    const tops = umbrellaMats.map((mat) => ({ mat, list: [] as THREE.Matrix4[] }));
    for (let k = 0; k < count; k++) {
      const x = FRONT + 3.3 + rand() * 0.9;
      const z = hz - spec.w / 2 + (k + 0.5) * (spec.w / count) + (rand() - 0.5);
      m4.makeTranslation(x, 0.172, z);
      tables.setMatrixAt(k, m4);
      stems.setMatrixAt(k, m4);
      tops[k % tops.length].list.push(new THREE.Matrix4().makeTranslation(x, 0.172, z));
      g.add(shadowBlob(x - 0.6, z + 0.5, 2.6, 2.2, 0.45));
    }
    g.add(tables, stems);
    for (const { mat, list } of tops) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(umbrellaGeo, mat, list.length);
      list.forEach((mx, i) => mesh.setMatrixAt(i, mx));
      g.add(mesh);
    }
  }

  return {
    buildSegment,
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}

