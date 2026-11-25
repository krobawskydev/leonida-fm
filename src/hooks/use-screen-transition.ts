import { useRef, useState, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const MOTION = "(prefers-reduced-motion: no-preference)";
const DESKTOP_MOTION = `${MOTION} and (min-width: 40.0625rem)`;

/**
 * Short GSAP choreography for the radio screen. It only moves the bezel and the dial/toolbar of the
 * radio; the player section is never animated, so the iframe keeps its node, position and controls.
 * Everything is reverted when the view changes again, so rapid toggling cannot leave a half-played state.
 * With reduced motion the views switch with no movement at all.
 */
export function useScreenTransition(view: "car" | "radio" | null, panel: RefObject<HTMLElement | null>, openButton: RefObject<HTMLElement | null>) {
  const origin = useRef<DOMRect | null>(null);
  const closing = useRef<DOMRect | null>(null);

  // Open: the bezel grows out of the console screen, then the toolbar and dial settle in.
  useGSAP(() => {
    const node = panel.current;
    const from = origin.current;
    origin.current = null;
    if (view !== "radio" || !node) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      const bezel = node.querySelector(".radio-bezel");
      const parts = node.querySelectorAll(".radio-toolbar, .tuner-content");
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (bezel) {
        const bounds = node.getBoundingClientRect();
        const start = from
          ? {
              x: from.left + from.width / 2 - bounds.left - bounds.width / 2,
              y: from.top + from.height / 2 - bounds.top - bounds.height / 2,
              scaleX: Math.min(0.95, from.width / bounds.width),
              scaleY: Math.min(0.95, from.height / bounds.height),
            }
          : { x: 0, y: 8, scaleX: 0.97, scaleY: 0.97 };
        tl.from(bezel, { ...start, opacity: 0.65, duration: 0.46, clearProps: "transform,opacity" }, 0);
      }
      if (parts.length) tl.from(parts, { opacity: 0, y: 10, duration: 0.3, stagger: 0.06, clearProps: "transform,opacity" }, 0.12);
      return () => { tl.kill(); };
    });
    return () => mm.revert();
  }, { dependencies: [view], scope: panel, revertOnUpdate: true });

  // Close: a short-lived ghost frame shrinks back into the console screen. Layout and focus are already final.
  useGSAP(() => {
    const frame = closing.current;
    closing.current = null;
    const button = openButton.current;
    if (view !== "car" || !frame || !button) return;
    const mm = gsap.matchMedia();
    mm.add(DESKTOP_MOTION, () => {
      const ghost = document.createElement("div");
      ghost.className = "radio-ghost";
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, { left: `${frame.left}px`, top: `${frame.top}px`, width: `${frame.width}px`, height: `${frame.height}px` });
      document.body.appendChild(ghost);
      const to = button.getBoundingClientRect();
      gsap.to(ghost, {
        x: to.left + to.width / 2 - frame.left - frame.width / 2,
        y: to.top + to.height / 2 - frame.top - frame.height / 2,
        scaleX: to.width / frame.width, scaleY: to.height / frame.height,
        opacity: 0, duration: 0.34, ease: "power2.in", onComplete: () => ghost.remove(),
      });
      return () => ghost.remove();
    });
    return () => mm.revert();
  }, { dependencies: [view], revertOnUpdate: true });

  const [api] = useState(() => ({
    markOpening(rect: DOMRect | null) { origin.current = rect; },
    markClosing() { closing.current = panel.current?.querySelector(".radio-bezel")?.getBoundingClientRect() ?? null; },
  }));
  return api;
}
