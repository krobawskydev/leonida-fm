import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { blobTexture, frondTexture, rng, trunkTexture } from "./textures";

// ---------- Palms ----------

/** A single arching frond as a bent strip; the leaflets come from an alpha-tested texture. */
function frondGeometry(length: number, lift: number, bend: number, width: number) {
  const seg = 10;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const reach = length * t * Math.cos(lift);
    const y = length * t * Math.sin(lift) - bend * length * t * t;
    const w = (width * (0.35 + 0.65 * Math.sin(Math.PI * Math.pow(Math.max(t, 0.02), 0.7)))) / 2;
    pos.push(reach, y, -w, reach, y, w);
    uv.push(0, t, 1, t);
    if (i < seg) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function crownGeometry(count: number, size: number, seed: number) {
  const rand = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const old = i / count; // later fronds droop more
    const geo = frondGeometry(size * (0.82 + rand() * 0.34), 0.95 - old * 1.25 + rand() * 0.2, 0.55 + old * 0.5, size * 0.5);
    geo.rotateY((i / count) * Math.PI * 2 * 1.618 + rand() * 0.5);
    parts.push(geo);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

export interface PalmSpec { x: number; z: number; height: number; lean: number; dir: number; scale: number; tint: number }

export function createPalmKit(anisotropy: number) {
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.25, 1, 8, 1);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ map: trunkTexture(anisotropy), emissive: new THREE.Color("#6a4a34") });
  const frondMat = new THREE.MeshLambertMaterial({
    map: frondTexture(anisotropy), alphaTest: 0.22, transparent: true, side: THREE.DoubleSide, emissive: new THREE.Color("#4e3c12"),
  });
  const crowns = [crownGeometry(12, 3.4, 11), crownGeometry(13, 2.8, 12)];
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  blobGeo.rotateX(-Math.PI / 2);

  /** Builds trunks, crowns and ground shadows for a list of palms as three instanced meshes. */
  function build(specs: PalmSpec[], shadowDir: THREE.Vector2) {
    const group = new THREE.Group();
    if (!specs.length) return group;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, specs.length);
    const royal = specs.filter((s) => s.height >= 9);
    const coco = specs.filter((s) => s.height < 9);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const shadowCount = specs.length * 2;
    const shadows = new THREE.InstancedMesh(blobGeo, blobMat, shadowCount);
    specs.forEach((spec, i) => {
      e.set(Math.sin(spec.dir) * spec.lean, 0, Math.cos(spec.dir) * spec.lean);
      q.setFromEuler(e);
      p.set(spec.x, 0, spec.z);
      s.set(spec.scale, spec.height, spec.scale);
      trunks.setMatrixAt(i, m.compose(p, q, s));
      // Trunk-base blob and a long soft streak thrown away from the low sun.
      p.set(spec.x, 0.03, spec.z); s.set(2.2 * spec.scale, 1, 2.2 * spec.scale);
      shadows.setMatrixAt(i * 2, m.compose(p, new THREE.Quaternion(), s));
      const len = spec.height * 1.7;
      const angle = Math.atan2(shadowDir.x, shadowDir.y);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      p.set(spec.x + shadowDir.x * len * 0.5, 0.03, spec.z + shadowDir.y * len * 0.5);
      s.set(1.1 * spec.scale + 0.6, 1, len);
      shadows.setMatrixAt(i * 2 + 1, m.compose(p, q, s));
    });
    trunks.instanceMatrix.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
    group.add(trunks, shadows);

    for (const [list, geo] of [[royal, crowns[0]], [coco, crowns[1]]] as const) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(geo, frondMat, list.length);
      const color = new THREE.Color();
      list.forEach((spec, i) => {
        const topX = spec.x + Math.sin(spec.dir) * Math.sin(spec.lean) * spec.height;
        const topZ = spec.z + Math.cos(spec.dir) * Math.sin(spec.lean) * spec.height;
        p.set(topX, spec.height * Math.cos(spec.lean), topZ);
        q.setFromEuler(e.set(0, spec.dir * 3, 0));
        const k = spec.scale * (spec.height / 11);
        s.set(k * 1.05, k * 1.05, k * 1.05);
        mesh.setMatrixAt(i, m.compose(p, q, s));
        mesh.setColorAt(i, color.setHSL(0.24 + spec.tint * 0.06, 0.34 + spec.tint * 0.12, 0.42 + spec.tint * 0.1));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    }
    return group;
  }

  return { build, blobGeo, blobMat, dispose() { trunkGeo.dispose(); trunkMat.map?.dispose(); trunkMat.dispose(); frondMat.map?.dispose(); frondMat.dispose(); crowns.forEach((c) => c.dispose()); blobMat.map?.dispose(); blobMat.dispose(); blobGeo.dispose(); } };
}
