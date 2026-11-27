import assert from "node:assert/strict";
import { test } from "node:test";
import { bindBackdropDismissal } from "../src/hooks/use-modal-dialog.ts";

function dialogFixture(canDismiss = () => true) {
  let closes = 0;
  const dialog = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({ left: 10, right: 100, top: 10, bottom: 100 }),
    close: () => { closes++; },
  });
  const unbind = bindBackdropDismissal(dialog as unknown as HTMLDialogElement, canDismiss);

  function dispatch(type: string, clientX: number, detail = 1) {
    const event = Object.assign(new Event(type), {
      clientX, clientY: 20, detail, pointerId: 1, isPrimary: true, button: 0,
    });
    dialog.dispatchEvent(event);
  }

  function gesture(start: number, end: number) {
    dispatch("pointerdown", start);
    dispatch("pointerup", end);
    dispatch("click", end);
  }

  return { gesture, dispatch, unbind, closeCount: () => closes };
}

test("solo cierra cuando el gesto empieza y termina fuera del diálogo", () => {
  const dialog = dialogFixture();
  dialog.gesture(20, 20);
  dialog.gesture(20, 5);
  dialog.gesture(5, 20);
  assert.equal(dialog.closeCount(), 0);
  dialog.gesture(5, 5);
  assert.equal(dialog.closeCount(), 1);
});

test("el fondo conserva el formulario si hay cambios pendientes", () => {
  let dirty = true;
  const dialog = dialogFixture(() => !dirty);
  dialog.gesture(5, 5);
  assert.equal(dialog.closeCount(), 0);
  dirty = false;
  dialog.gesture(5, 5);
  assert.equal(dialog.closeCount(), 1);
});

test("ignora un puntero cancelado, un clic de teclado y eventos tras desmontar", () => {
  const dialog = dialogFixture();
  dialog.dispatch("pointerdown", 5);
  dialog.dispatch("pointercancel", 5);
  dialog.dispatch("pointerup", 5);
  dialog.dispatch("click", 5);
  dialog.dispatch("pointerdown", 5);
  dialog.dispatch("pointerup", 5);
  dialog.dispatch("click", 5, 0);
  dialog.unbind();
  dialog.gesture(5, 5);
  assert.equal(dialog.closeCount(), 0);
});
