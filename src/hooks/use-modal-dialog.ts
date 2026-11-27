"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

export function bindBackdropDismissal(dialog: HTMLDialogElement, canDismiss: () => boolean) {
  let backdropPointer: number | undefined;
  let backdropClick = false;
  const listeners = new AbortController();
  const { signal } = listeners;

  function isBackdrop(event: MouseEvent) {
    if (event.target !== dialog) return false;
    const { left, right, top, bottom } = dialog.getBoundingClientRect();
    return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom;
  }

  dialog.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;
    backdropPointer = event.button === 0 && isBackdrop(event) ? event.pointerId : undefined;
    backdropClick = false;
  }, { signal });

  dialog.addEventListener("pointerup", (event) => {
    if (event.pointerId !== backdropPointer) return;
    backdropPointer = undefined;
    backdropClick = isBackdrop(event);
  }, { signal });

  dialog.addEventListener("pointercancel", (event) => {
    if (event.pointerId === backdropPointer) backdropPointer = undefined;
  }, { signal });

  dialog.addEventListener("click", (event) => {
    const dismiss = backdropClick && event.detail > 0 && isBackdrop(event);
    backdropClick = false;
    if (dismiss && canDismiss()) dialog.close();
  }, { signal });

  return () => listeners.abort();
}

export function useModalDialog(dialogRef: RefObject<HTMLDialogElement | null>, canDismiss = () => true) {
  const canDismissBackdrop = useEffectEvent(canDismiss);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return bindBackdropDismissal(dialog, () => canDismissBackdrop());
  }, [dialogRef]);
}
