import * as THREE from "three";

// Every texture in the driving scene is drawn procedurally on a canvas at load time.
// No external image, model or font file is used, so there is nothing to license.

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { canvas, ctx };
}

interface TextureOptions { repeat?: boolean; anisotropy?: number; srgb?: boolean }

export function toTexture(canvas: HTMLCanvasElement, { repeat = false, anisotropy = 8, srgb = true }: TextureOptions = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, rand: () => number, light: string, dark: string, maxSize = 1.6) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rand() > 0.5 ? light : dark;
    const s = 0.4 + rand() * maxSize;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

/** Mid-grey grain tile used as the base of asphalt, concrete, stucco and grass. */
export function grainCanvas(size: number, seed: number, base: [number, number, number], amp: number) {
  const { canvas, ctx } = makeCanvas(size, size);
  const rand = rng(seed);
  const data = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (rand() + rand() + rand() - 1.5) * amp;
    data.data[i * 4] = Math.max(0, Math.min(255, base[0] + n));
    data.data[i * 4 + 1] = Math.max(0, Math.min(255, base[1] + n * 0.95));
    data.data[i * 4 + 2] = Math.max(0, Math.min(255, base[2] + n * 0.9));
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export const ROAD = { x0: -9.4, x1: 4.9, length: 40 };
const ROAD_W = ROAD.x1 - ROAD.x0;

/** One 40 m stretch of road. Lane paint repeats every 10 m so the stretches join without a seam. */
export function asphaltTexture(variant: number, anisotropy: number) {
  const W = 1024;
  const H = 2048;
  const { canvas, ctx } = makeCanvas(W, H);
  const rand = rng(900 + variant * 31);
  const px = (x: number) => ((x - ROAD.x0) / ROAD_W) * W;
  const ppm = H / ROAD.length;

  const grain = grainCanvas(256, 70 + variant, [112, 106, 114], 36);
  ctx.fillStyle = ctx.createPattern(grain, "repeat") ?? "#4a464c";
  ctx.fillRect(0, 0, W, H);

  const wrap = (draw: (dy: number) => void) => { draw(0); draw(-H); draw(H); };

  // Worn tyre tracks inside both lanes.
  for (const x of [-1.25, 0.25, 2.55, 3.85, -4.4, -3.2]) {
    const g = ctx.createLinearGradient(px(x - 0.55), 0, px(x + 0.55), 0);
    g.addColorStop(0, "rgba(20,18,24,0)");
    g.addColorStop(0.5, "rgba(20,18,24,.14)");
    g.addColorStop(1, "rgba(20,18,24,0)");
    ctx.fillStyle = g;
    ctx.fillRect(px(x - 0.55), 0, px(x + 0.55) - px(x - 0.55), H);
  }
  // Repair patches, oil stains and seams.
  for (let i = 0; i < 9; i++) {
    const x = px(ROAD.x0 + rand() * ROAD_W);
    const y = rand() * H;
    const w = 60 + rand() * 150;
    const h = 90 + rand() * 260;
    wrap((dy) => {
      ctx.fillStyle = `rgba(${28 + rand() * 20},${26 + rand() * 18},${30 + rand() * 20},.38)`;
      ctx.fillRect(x, y + dy, w, h);
      ctx.strokeStyle = "rgba(12,10,14,.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y + dy, w, h);
    });
  }
  for (let i = 0; i < 14; i++) {
    const x = px(ROAD.x0 + rand() * ROAD_W);
    const y = rand() * H;
    const r = 18 + rand() * 46;
    wrap((dy) => {
      const g = ctx.createRadialGradient(x, y + dy, 0, x, y + dy, r);
      g.addColorStop(0, "rgba(14,12,18,.5)");
      g.addColorStop(1, "rgba(14,12,18,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y + dy - r, r * 2, r * 2);
    });
  }
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 16; i++) {
    let x = px(ROAD.x0 + rand() * ROAD_W);
    let y = rand() * H;
    const path: [number, number][] = [[x, y]];
    for (let s = 0; s < 6; s++) { x += (rand() - 0.5) * 50; y += 20 + rand() * 50; path.push([x, y]); }
    wrap((dy) => {
      ctx.strokeStyle = "rgba(8,7,10,.55)";
      ctx.beginPath();
      path.forEach(([a, b], k) => (k ? ctx.lineTo(a, b + dy) : ctx.moveTo(a, b + dy)));
      ctx.stroke();
    });
  }
  // Transverse tar seams.
  for (let i = 0; i < 4; i++) {
    const y = (i + 0.3 + rand() * 0.4) * (H / 4);
    ctx.fillStyle = "rgba(10,9,12,.5)";
    ctx.fillRect(0, y, W, 2.2);
  }

  const paint = (x: number, width: number, color: string, dash?: [number, number], alpha = 0.9) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    if (!dash) { ctx.fillRect(px(x), 0, width * (W / ROAD_W), H); }
    else {
      const period = dash[0] + dash[1];
      for (let y = 0; y < ROAD.length; y += period) ctx.fillRect(px(x), y * ppm, width * (W / ROAD_W), dash[0] * ppm);
    }
    ctx.globalAlpha = 1;
  };
  paint(-2.62, 0.13, "#dcb23c");
  paint(-2.32, 0.13, "#dcb23c");
  paint(1.2, 0.14, "#e8e4da", [3.5, 6.5]);
  paint(-6.0, 0.13, "#e8e4da", [3.5, 6.5], 0.8);
  paint(4.62, 0.14, "#e8e4da");
  paint(-9.12, 0.12, "#e8e4da", undefined, 0.75);

  // Occasional zebra crossing.
  if (variant === 0) {
    ctx.fillStyle = "rgba(232,228,218,.82)";
    for (let x = ROAD.x0 + 0.4; x < ROAD.x1 - 0.2; x += 0.9) {
      ctx.fillRect(px(x), 22 * ppm, 0.45 * (W / ROAD_W), 3.4 * ppm);
    }
  }
  // Paint wear.
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalCompositeOperation = "source-over";
  speckle(ctx, W, H, 5200, rand, "rgba(120,114,118,.5)", "rgba(10,10,14,.5)", 2);

  // Manhole cover.
  const mx = px(-0.9 + variant * 0.4);
  const my = (8 + variant * 9) * ppm;
  ctx.fillStyle = "#2c2a30";
  ctx.beginPath(); ctx.arc(mx, my, 20, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#17151a"; ctx.lineWidth = 2.5; ctx.stroke();

  return toTexture(canvas, { anisotropy });
}

export function paverTexture(anisotropy: number, base: [number, number, number], seed: number) {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.drawImage(grainCanvas(size, seed, base, 22), 0, 0);
  const rand = rng(seed + 5);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,240,220" : "40,30,30"},.05)`;
    ctx.fillRect(rand() * size, rand() * size, 100 + rand() * 160, 100 + rand() * 160);
  }
  ctx.strokeStyle = "rgba(60,50,50,.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
  ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(60,50,50,.28)"; ctx.stroke();
  return toTexture(canvas, { repeat: true, anisotropy });
}

export function grassTexture(anisotropy: number) {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.drawImage(grainCanvas(size, 21, [92, 112, 52], 38), 0, 0);
  const rand = rng(22);
  for (let i = 0; i < 1800; i++) {
    ctx.strokeStyle = rand() > 0.5 ? "rgba(150,160,70,.45)" : "rgba(40,70,30,.45)";
    ctx.lineWidth = 1;
    const x = rand() * size;
    const y = rand() * size;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 4, y - 3 - rand() * 5); ctx.stroke();
  }
  return toTexture(canvas, { repeat: true, anisotropy });
}

export function sandTexture(anisotropy: number) {
  const { canvas } = makeCanvas(256, 256);
  canvas.getContext("2d")?.drawImage(grainCanvas(256, 33, [214, 190, 150], 20), 0, 0);
  return toTexture(canvas, { repeat: true, anisotropy });
}

export function limestoneTexture(anisotropy: number) {
  const { canvas, ctx } = makeCanvas(512, 128);
  ctx.drawImage(grainCanvas(128, 41, [214, 198, 172], 16), 0, 0, 512, 128);
  ctx.fillStyle = ctx.createPattern(grainCanvas(128, 42, [214, 198, 172], 16), "repeat") ?? "#d6c6ac";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "rgba(90,70,50,.45)"; ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(512, 64); ctx.stroke();
  return toTexture(canvas, { repeat: true, anisotropy });
}

export function stuccoTexture(color: string, seed: number, anisotropy: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
  const rand = rng(seed);
  speckle(ctx, 256, 256, 2400, rand, "rgba(255,255,255,.13)", "rgba(40,20,20,.1)", 2);
  return toTexture(canvas, { repeat: true, anisotropy });
}

export function trunkTexture(anisotropy: number) {
  const { canvas, ctx } = makeCanvas(64, 256);
  ctx.drawImage(grainCanvas(64, 51, [206, 190, 160], 26), 0, 0, 64, 256);
  for (let y = 0; y < 256; y += 16) {
    const g = ctx.createLinearGradient(0, y, 0, y + 16);
    g.addColorStop(0, "rgba(40,30,20,.55)"); g.addColorStop(0.18, "rgba(40,30,20,0)");
    g.addColorStop(0.75, "rgba(255,240,215,.14)"); g.addColorStop(1, "rgba(40,30,20,.35)");
    ctx.fillStyle = g; ctx.fillRect(0, y, 64, 16);
  }
  return toTexture(canvas, { repeat: true, anisotropy });
}

export function frondTexture(anisotropy: number) {
  const W = 256;
  const H = 1024;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);
  const rand = rng(61);
  ctx.lineCap = "round";
  for (let y = 40; y < H - 8; y += 6.5) {
    const t = y / H; // 0 base, 1 tip
    const reach = Math.sin(Math.PI * Math.pow(t, 0.72)) * (W / 2 - 8) + 6;
    for (const side of [-1, 1]) {
      const end = reach * (0.9 + rand() * 0.2);
      const drop = end * (0.42 + rand() * 0.14);
      const g = ctx.createLinearGradient(W / 2, y, W / 2 + side * end, y + drop);
      g.addColorStop(0, "#2d5a24"); g.addColorStop(0.55, "#5f9232"); g.addColorStop(1, "#c3c25a");
      ctx.strokeStyle = g;
      ctx.lineWidth = 3.4 + rand() * 1.2;
      ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.quadraticCurveTo(W / 2 + side * end * 0.55, y + drop * 0.25, W / 2 + side * end, y + drop); ctx.stroke();
    }
  }
  ctx.strokeStyle = "#4a6a2a"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H - 8); ctx.stroke();
  return toTexture(canvas, { anisotropy });
}

export function blobTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,.95)"); g.addColorStop(0.55, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas, { srgb: false });
}

export function awningTexture(color: string) {
  const { canvas, ctx } = makeCanvas(128, 32);
  ctx.fillStyle = "#f4ede0"; ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = color;
  for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 8, 32);
  return toTexture(canvas, { repeat: true });
}

/** Vertical neon blade sign: one letter per row, fictional hotel names only. */
export function neonSignTexture(text: string, color: string) {
  const letters = text.toUpperCase().split("");
  const rowH = 96;
  const { canvas, ctx } = makeCanvas(128, rowH * letters.length + 24);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "800 74px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  letters.forEach((letter, i) => {
    const y = 12 + rowH * (i + 0.5);
    ctx.shadowColor = color; ctx.shadowBlur = 26; ctx.fillStyle = color; ctx.fillText(letter, 64, y);
    ctx.shadowBlur = 8; ctx.fillText(letter, 64, y);
    ctx.shadowBlur = 0; ctx.fillStyle = "#fff4ee"; ctx.globalAlpha = 0.85; ctx.fillText(letter, 64, y); ctx.globalAlpha = 1;
  });
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.strokeRect(10, 6, 108, canvas.height - 12);
  return toTexture(canvas);
}

export function lowerSignTexture(text: string, color: string) {
  const { canvas, ctx } = makeCanvas(512, 96);
  ctx.clearRect(0, 0, 512, 96);
  ctx.font = "700 54px 'Avenir Next', 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = color; ctx.shadowBlur = 22; ctx.fillStyle = color; ctx.fillText(text.toUpperCase(), 256, 50);
  ctx.shadowBlur = 0; ctx.fillStyle = "#fff6f0"; ctx.globalAlpha = 0.8; ctx.fillText(text.toUpperCase(), 256, 50);
  return toTexture(canvas);
}

export interface FacadeSpec {
  wall: string;
  trim: string;
  accent: string;
  neon: string;
  style: "bands" | "portholes" | "streamline" | "grid";
  seed: number;
}

/** Draws one street-facing facade plus its emissive map (lit rooms and neon trim). */
export function facadeTextures(spec: FacadeSpec, widthM: number, floors: number, floorH: number, anisotropy: number, kind: "main" | "tower" = "main") {
  const ppm = 44;
  const W = Math.min(1536, Math.round(widthM * ppm));
  const heightM = floors * floorH;
  const H = Math.min(1536, Math.round(heightM * ppm));
  const sx = W / widthM;
  const sy = H / heightM;
  const { canvas, ctx } = makeCanvas(W, H);
  const { canvas: glow, ctx: gctx } = makeCanvas(W, H);
  const rand = rng(spec.seed + (kind === "tower" ? 77 : 0));
  gctx.fillStyle = "#000"; gctx.fillRect(0, 0, W, H);

  ctx.fillStyle = spec.wall; ctx.fillRect(0, 0, W, H);
  speckle(ctx, W, H, Math.round(W * H / 90), rand, "rgba(255,255,255,.12)", "rgba(60,30,30,.09)", 1.8);

  const floorTop = (f: number) => H - (f + 1) * floorH * sy; // f = 0 ground floor
  const glass = (x: number, y: number, w: number, h: number, round = false, lit = rand() < 0.38) => {
    ctx.fillStyle = spec.trim;
    if (round) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 3, h / 2 + 3, 0, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#f0a9bd"); g.addColorStop(0.4, "#9aa4c2"); g.addColorStop(1, "#66739a");
    ctx.fillStyle = g;
    if (round) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath(); if (round) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = "rgba(255,206,190,.32)";
    ctx.beginPath(); ctx.moveTo(x - 2, y + h * 0.55); ctx.lineTo(x + w * 0.7, y - 2); ctx.lineTo(x + w * 1.05, y - 2); ctx.lineTo(x - 2, y + h * 0.95); ctx.fill();
    ctx.restore();
    if (lit) {
      gctx.fillStyle = `rgba(255,${170 + rand() * 40},${90 + rand() * 40},.85)`;
      if (round) { gctx.beginPath(); gctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); gctx.fill(); }
      else gctx.fillRect(x, y, w, h);
    }
    if (!round) { ctx.fillStyle = spec.trim; ctx.fillRect(x + w / 2 - 1, y, 2, h); }
  };

  const bay = kind === "tower" ? widthM : 2.9;
  const bays = Math.max(1, Math.round(widthM / bay));
  const bayW = widthM / bays;

  // Upper floors.
  for (let f = 1; f < floors; f++) {
    const top = floorTop(f);
    const fh = floorH * sy;
    if (spec.style === "streamline") {
      ctx.fillStyle = spec.trim;
      ctx.fillRect(0, top + fh * 0.2, W, fh * 0.06);
      ctx.fillRect(0, top + fh * 0.82, W, fh * 0.05);
      for (let b = 0; b < bays; b++) {
        glass((b * bayW + 0.35) * sx, top + fh * 0.3, (bayW - 0.7) * sx, fh * 0.46, false);
      }
    } else if (spec.style === "portholes" && f === 1) {
      for (let b = 0; b < bays * 2; b++) {
        const r = Math.min(bayW * sx * 0.2, fh * 0.28);
        glass(((b + 0.5) * bayW / 2) * sx - r, top + fh * 0.5 - r, r * 2, r * 2, true);
      }
    } else if (spec.style === "grid") {
      for (let b = 0; b < bays; b++) {
        const x0 = b * bayW * sx;
        ctx.fillStyle = spec.accent; ctx.fillRect(x0 - 3, top, 6, fh);
        glass(x0 + bayW * sx * 0.22, top + fh * 0.22, bayW * sx * 0.56, fh * 0.56);
      }
    } else {
      for (let b = 0; b < bays; b++) {
        const w = bayW * sx * 0.46;
        glass((b + 0.5) * bayW * sx - w / 2, top + fh * 0.2, w, fh * 0.6);
      }
    }
    // Brim shadow line under each floor slab.
    const shade = ctx.createLinearGradient(0, top, 0, top + fh * 0.16);
    shade.addColorStop(0, "rgba(60,20,40,.38)"); shade.addColorStop(1, "rgba(60,20,40,0)");
    ctx.fillStyle = shade; ctx.fillRect(0, top, W, fh * 0.16);
  }
  if (spec.style === "streamline") {
    ctx.fillStyle = spec.accent;
    for (let i = 0; i < 3; i++) ctx.fillRect(0, floorTop(floors - 1) + (floorH * sy) * (0.05 + i * 0.045), W, 3);
  }

  // Ground floor: storefront glass glowing warm, recessed doors and pilasters.
  const gTop = floorTop(0);
  const gH = floorH * sy;
  ctx.fillStyle = spec.trim; ctx.fillRect(0, gTop, W, gH);
  for (let b = 0; b < bays; b++) {
    const x0 = b * bayW * sx;
    const w = bayW * sx * 0.78;
    const x = x0 + (bayW * sx - w) / 2;
    const door = b % 3 === 1;
    const g = ctx.createLinearGradient(0, gTop, 0, gTop + gH);
    g.addColorStop(0, "#2a2431"); g.addColorStop(1, "#16121c");
    ctx.fillStyle = g; ctx.fillRect(x, gTop + gH * 0.22, w, gH * 0.78);
    gctx.fillStyle = door ? "rgba(255,196,120,.55)" : "rgba(255,172,96,.8)";
    gctx.fillRect(x + 4, gTop + gH * 0.26, w - 8, gH * (door ? 0.6 : 0.52));
    ctx.fillStyle = spec.accent; ctx.fillRect(x - 3, gTop + gH * 0.2, 3, gH * 0.8); ctx.fillRect(x + w, gTop + gH * 0.2, 3, gH * 0.8);
    if (door) { ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(x + w * 0.4, gTop + gH * 0.5, w * 0.2, gH * 0.5); }
  }

  // Neon trim line near the roof.
  gctx.fillStyle = spec.neon; gctx.fillRect(0, 5, W, 5);
  ctx.fillStyle = spec.neon; ctx.globalAlpha = 0.9; ctx.fillRect(0, 5, W, 5); ctx.globalAlpha = 1;

  const map = toTexture(canvas, { anisotropy });
  const emissiveMap = toTexture(glow, { anisotropy });
  return { map, emissiveMap };
}

export function sideWallTexture(color: string, trim: string, seed: number, anisotropy: number) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rand = rng(seed);
  ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 1600, rand, "rgba(255,255,255,.12)", "rgba(60,30,30,.1)", 1.8);
  for (let y = 28; y < 230; y += 128) {
    for (let x = 36; x < 230; x += 128) {
      ctx.fillStyle = trim; ctx.fillRect(x - 5, y - 5, 66, 82);
      const g = ctx.createLinearGradient(0, y, 0, y + 72);
      g.addColorStop(0, "#f0a9bd"); g.addColorStop(0.45, "#9aa4c2"); g.addColorStop(1, "#66739a");
      ctx.fillStyle = g; ctx.fillRect(x, y, 56, 72);
      ctx.fillStyle = trim; ctx.fillRect(x + 27, y, 2, 72);
    }
  }
  return toTexture(canvas, { repeat: true, anisotropy });
}
