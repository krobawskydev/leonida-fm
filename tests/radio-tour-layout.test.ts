import assert from "node:assert/strict";
import { test } from "node:test";
import { radioTourLayout } from "../src/lib/radio-tour-layout.ts";

test("sitúa la tarjeta junto al control destacado en escritorio", () => {
  const result = radioTourLayout(
    [{ left: 260, right: 304, top: 210, bottom: 254 }],
    { width: 1280, height: 720 },
    { width: 336, height: 180 },
  );
  assert.deepEqual(result.cardPosition, { left: 323, top: 142 });
  assert.deepEqual(result.spots, [{ left: 255, right: 309, top: 205, bottom: 259 }]);
  assert.match(result.clipPath, /^path\(evenodd, "M0 0 H1280 V720 H0 Z M/);
});

test("mantiene los dos focos separados y sitúa la tarjeta dentro de una pantalla estrecha", () => {
  const result = radioTourLayout(
    [{ left: 16, right: 60, top: 440, bottom: 484 }, { left: 260, right: 304, top: 440, bottom: 484 }],
    { width: 320, height: 568 },
    { width: 296, height: 200 },
  );
  assert.deepEqual(result.cardPosition, { left: 12, top: 221 });
  assert.equal(result.spots.length, 2);
  assert.ok(result.spots[0].right < result.spots[1].left);
});

test("recorta el foco en el borde y conserva una salida cuando el control no se ve", () => {
  const viewport = { width: 320, height: 568 };
  const card = { width: 296, height: 180 };
  const partial = radioTourLayout([{ left: -15, right: 20, top: -2, bottom: 25 }], viewport, card);
  assert.deepEqual(partial.spots, [{ left: 0, right: 25, top: 0, bottom: 30 }]);
  const offscreen = radioTourLayout([{ left: 10, right: 54, top: 600, bottom: 644 }], viewport, card);
  assert.deepEqual(offscreen.spots, []);
  assert.deepEqual(offscreen.cardPosition, { left: 12, top: 376 });
});
