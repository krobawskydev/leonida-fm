import assert from "node:assert/strict";
import { test } from "node:test";
import { isYouTubeContentError, nextYouTubeTrack } from "../src/lib/youtube-recovery.ts";

test("avanza desde el primer video bloqueado y agota los candidatos si siguen fallando", () => {
  const visited = new Set<number>();
  const second = nextYouTubeTrack(3, -1, undefined, visited);
  assert.equal(second, 1);
  const third = nextYouTubeTrack(3, 0, second, visited);
  assert.equal(third, 2);
  assert.equal(nextYouTubeTrack(3, -1, third, visited), null);
  assert.deepEqual([...visited], [0, 1, 2]);
});

test("recupera una pista intermedia y vuelve al inicio para probar pistas pendientes", () => {
  const visited = new Set([1]);
  const next = nextYouTubeTrack(5, 2, undefined, visited);
  assert.equal(next, 3);
  visited.add(next);
  assert.equal(nextYouTubeTrack(5, 4, undefined, visited), 0);
});

test("identifica cuándo no hay una pista alternativa", () => {
  assert.equal(nextYouTubeTrack(0, -1, undefined, new Set()), null);
  assert.equal(nextYouTubeTrack(1, 0, undefined, new Set()), null);
});

test("distingue los bloqueos de contenido de los errores del reproductor", () => {
  assert.deepEqual([100, 101, 150].map(isYouTubeContentError), [true, true, true]);
  assert.deepEqual([2, 5, 153, 999].map(isYouTubeContentError), [false, false, false, false]);
});
