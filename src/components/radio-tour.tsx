"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { radioTourLayout } from "@/lib/radio-tour-layout";

const steps = [
  {
    target: "add",
    title: "Añade tu propia estación",
    description: "Pulsa + y pega una playlist de Spotify o un video o playlist de YouTube.",
  },
  {
    target: "tune",
    title: "Cambia de emisora",
    description: "Usa las flechas para sintonizar la anterior o la siguiente. También puedes elegir una emisora en la rueda.",
  },
  {
    target: "provider",
    title: "Cambia de plataforma",
    description: "Elige Spotify o YouTube para sintonizar las emisoras de su catálogo.",
  },
  {
    target: "directory",
    title: "Abre la lista completa",
    description: "Pulsa «Estación X de Y» para abrir «Mis estaciones» y ver el catálogo completo.",
  },
];

interface Props {
  panel: RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
  onAdd: () => void;
}

export function RadioTour({ panel, onDismiss, onAdd }: Props) {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<ReturnType<typeof radioTourLayout>>();
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = steps[index];
  const lastStep = index === steps.length - 1;

  useLayoutEffect(() => {
    dialog.current?.showModal();
  }, []);

  useLayoutEffect(() => {
    const layer = dialog.current;
    const coachMark = card.current;
    if (!layer || !coachMark) return;
    const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`) ?? []);
    heading.current?.focus({ preventScroll: true });

    const offscreen = targets.find((target) => {
      const rect = target.getBoundingClientRect();
      return rect.top < 12 || rect.bottom > layer.clientHeight - 12;
    });
    offscreen?.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });

    function reposition() {
      if (!layer || !coachMark) return;
      setLayout(radioTourLayout(
        targets.map((target) => target.getBoundingClientRect()),
        { width: layer.clientWidth, height: layer.clientHeight },
        { width: coachMark.offsetWidth, height: coachMark.offsetHeight },
      ));
    }

    reposition();
    const frame = requestAnimationFrame(reposition);
    // Measure once more after the radio's opening animation settles.
    const settled = window.setTimeout(reposition, 500);
    const resize = new ResizeObserver(reposition);
    resize.observe(layer);
    resize.observe(coachMark);
    if (panel.current) resize.observe(panel.current);
    window.addEventListener("scroll", reposition, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settled);
      resize.disconnect();
      window.removeEventListener("scroll", reposition);
    };
  }, [panel, step]);

  function finish(action = onDismiss) {
    dialog.current?.close();
    action();
  }

  return (
    <dialog ref={dialog} className="radio-tour" aria-labelledby="radio-tour-title" aria-describedby="radio-tour-progress radio-tour-description"
      onCancel={(event) => { event.preventDefault(); finish(); }}>
      <div className="tour-scrim" style={{ clipPath: layout?.clipPath }} aria-hidden="true" />
      {layout?.spots.map(({ left, right, top, bottom }, spotIndex) => {
        const style = { left, top, width: right - left, height: bottom - top };
        return step.target === "add"
          ? <button key={spotIndex} type="button" className="tour-spotlight" style={style}
              aria-label="Añadir estación" onClick={() => finish(onAdd)} />
          : <span key={spotIndex} className="tour-spotlight" style={style} aria-hidden="true" />;
      })}
      <section ref={card} className="tour-card" style={layout?.cardPosition}>
        <p className="tour-progress" id="radio-tour-progress">Paso {index + 1} de {steps.length}</p>
        <h2 ref={heading} id="radio-tour-title" tabIndex={-1}>{step.title}</h2>
        <p id="radio-tour-description">{step.description}</p>
        <div className="tour-actions">
          <button type="button" className="secondary-button tour-skip" onClick={() => finish()}>Omitir</button>
          <button type="button" className="secondary-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Atrás</button>
          <button type="button" className="primary-button" onClick={() => lastStep ? finish() : setIndex(index + 1)}>
            {lastStep ? "Entendido" : "Siguiente"}
          </button>
        </div>
      </section>
    </dialog>
  );
}
