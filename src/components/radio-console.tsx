"use client";

import { startTransition, useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  AudioLines, ChevronLeft, ChevronRight, Copy, ListMusic, LockKeyhole, Pencil,
  Pause, Play, Plus, Radio, RadioTower, Share2, Trash2, X,
} from "lucide-react";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { useStations } from "@/hooks/use-stations";
import { DEFAULT_KEY, PROVIDERS, nextPlayable, shareHref, stationKey } from "@/lib/stations";
import type { Station } from "@/types/station";
import { CarSceneLayer, type SceneStatus } from "./car-scene-layer";
import { RadioPlayer } from "./radio-player";
import { StationDialog } from "./station-dialog";

function initials(name: string) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => Array.from(word)[0]);
  return letters.join("").toUpperCase();
}

const ticks = Array.from({ length: 49 }, (_, index) => index);

function ShareDialog({ station, onClose }: { station: Station; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");
  const url = shareHref(station, window.location.href);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Enlace copiado.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setFeedback("Copia el enlace seleccionado.");
    }
  }

  return (
    <dialog ref={dialog} className="station-dialog" aria-labelledby="share-title" onClose={onClose}>
      <div className="flex items-center justify-between gap-4">
        <h2 id="share-title">Compartir estación</h2>
        <button type="button" className="icon-button" aria-label="Cerrar" onClick={() => dialog.current?.close()}>
          <X size={20} />
        </button>
      </div>
      <p className="share-description">Quien reciba el enlace podrá sintonizar {station.name} y guardarla en su radio.</p>
      <label className="form-field">
        Enlace de la estación
        <input ref={input} type="url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
      </label>
      <div className="dialog-actions">
        <span className="copy-feedback" role="status">{feedback}</span>
        <button type="button" className="primary-button" onClick={() => void copy()}>
          <Copy size={16} aria-hidden="true" /> Copiar enlace
        </button>
      </div>
    </dialog>
  );
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

export function RadioConsole() {
  const radio = useStations();
  const [editor, setEditor] = useState<"new" | Station>();
  const [shared, setShared] = useState<Station>();
  const failed = useRef(new Set<string>());
  const [view, setView] = useState<"car" | "radio">("car");
  const [collectionOpen, setCollectionOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const collectionButton = useRef<HTMLButtonElement>(null);
  const stationHeading = useRef<HTMLHeadingElement>(null);
  const collectionHeading = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<"open" | "station" | "collection" | null>(null);
  const look = useRef<HTMLDivElement>(null);
  const consolePanel = useRef<HTMLDivElement>(null);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("static");
  const [scenePaused, setScenePaused] = useState(false);
  const tabHidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
  const transition = useScreenTransition(view, consolePanel, openButton);
  const onSceneStatus = useCallback((status: SceneStatus) => setSceneStatus(status), []);
  // The landscape only moves while the cockpit is in view, the tab is visible and the user has not paused it.
  const sceneRunning = view === "car" && !tabHidden && !scenePaused;
  const { preview } = radio;
  const activeKey = stationKey(radio.active);
  const activeIndex = radio.stations.findIndex((station) => stationKey(station) === activeKey);
  const frequency = (88.1 + 19.8 * (activeIndex / Math.max(5, radio.stations.length - 1))).toFixed(1);
  const dialPosition = ((Number(frequency) - 88) / 20) * 100;

  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === "open") openButton.current?.focus();
    if (target === "station") stationHeading.current?.focus();
    if (target === "collection") collectionHeading.current?.focus();
  }, [view, collectionOpen]);

  useEffect(() => {
    if (view !== "radio") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      if (collectionOpen) {
        setCollectionOpen(false);
        collectionButton.current?.focus();
        return;
      }
      transition.markClosing();
      focusTarget.current = "open";
      setView("car");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, collectionOpen, transition]);

  // Keep the last camera position while the radio is open.
  useEffect(() => {
    const node = look.current;
    const wide = window.matchMedia("(pointer: fine) and (min-width: 40.0625rem) and (min-aspect-ratio: 1501 / 1000) and (prefers-reduced-motion: no-preference)");
    if (view !== "car" || !node || !wide.matches) return;
    let x = Number(node.style.getPropertyValue("--look-x"));
    let y = Number(node.style.getPropertyValue("--look-y"));
    let targetX = x;
    let targetY = y;
    let frame = 0;
    function tick() {
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      node?.style.setProperty("--look-x", x.toFixed(4));
      node?.style.setProperty("--look-y", y.toFixed(4));
      const settled = Math.abs(targetX - x) < 0.001 && Math.abs(targetY - y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    }
    function onMove(event: PointerEvent) {
      if (event.pointerType !== "mouse" || !wide.matches) return;
      // Hold the view still over controls so the button does not drift away from the cursor.
      if (event.target instanceof Element && event.target.closest(".open-radio, .scene-toggle, .site-header, .cabin")) return;
      targetX = (event.clientX / window.innerWidth) * 2 - 1;
      targetY = (event.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(tick);
    }
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [view]);

  // A shared link or an invalid share needs the radio view's preview and notices.
  const needsRadio = radio.ready && (!!radio.preview || radio.invalidShare);
  useEffect(() => {
    if (needsRadio) startTransition(() => setView("radio"));
  }, [needsRadio]);

  function openRadio(target: "station" | "collection" = "station") {
    if (view === "radio") {
      (target === "collection" ? collectionHeading : stationHeading).current?.focus();
      return;
    }
    if (target === "station") transition.markOpening(openButton.current?.getBoundingClientRect() ?? null);
    focusTarget.current = target;
    setView("radio");
  }

  function toggleCollection() {
    if (collectionOpen) {
      setCollectionOpen(false);
      return;
    }
    if (view === "car") openRadio("collection");
    else focusTarget.current = "collection";
    setCollectionOpen(true);
  }

  function backToCar() {
    transition.markClosing();
    focusTarget.current = "open";
    setCollectionOpen(false);
    setView("car");
  }

  function tune(direction: number) {
    const { stations } = radio;
    const next = stations[(activeIndex + direction + stations.length) % stations.length];
    radio.select(stationKey(next));
  }

  function reportUnplayable() {
    failed.current.add(activeKey);
    return nextPlayable(radio.stations, activeIndex, failed.current)?.name ?? null;
  }

  function skipUnplayable() {
    const next = nextPlayable(radio.stations, activeIndex, failed.current);
    if (next) radio.select(stationKey(next));
  }

  function save(station: Station) {
    const key = stationKey(station);
    if (editor !== "new") {
      radio.dispatch({ type: "rename", key, name: station.name });
      return;
    }
    if (radio.collection.some((existing) => stationKey(existing) === key)) {
      return "Esta playlist ya está en tus estaciones.";
    }
    radio.add(station);
  }

  return (
    <div className="app" data-view={view}>
      <header className="site-header">
        <div className="shell header-inner">
          <div className="brand">
            <span className="brand-symbol"><RadioTower size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <span>Leonida<span className="brand-fm"> FM</span></span>
          </div>
          <button
            ref={collectionButton} type="button" className="header-link"
            aria-controls="station-collection" aria-expanded={collectionOpen}
            onClick={toggleCollection}
          >
            <ListMusic size={17} aria-hidden="true" /> Mis estaciones
          </button>
        </div>
      </header>

      <main className="car-main">
        <div className="stage" data-view={view}>
          <section className="car-scene" aria-label="Cabina de conducción">
            <h1 className="sr-only">Leonida FM · Your World. Your Frequency.</h1>
            <div className="car-look" ref={look}>
              <div className="car-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/car/cockpit-sunset.webp" width={1600} height={900} fetchPriority="high"
                  alt="Vista desde el asiento del conductor de un descapotable al atardecer, con una avenida costera de palmeras y edificios art déco al frente."
                />
                <CarSceneLayer playing={sceneRunning} onStatus={onSceneStatus} />
              </div>
              <div className="car-band" aria-hidden={view === "radio" || undefined}>
                <button
                  ref={openButton} type="button" className="open-radio"
                  aria-label="Abrir radio" aria-describedby="car-radio-summary" aria-controls="car-radio"
                  onClick={() => openRadio()} disabled={!radio.ready || view !== "car"}
                >
                  <span className="car-preview-dial" aria-hidden="true">
                    <span>{frequency}</span><small>FM</small>
                  </span>
                  <span className="car-preview-details">
                    <span className="car-preview-summary" id="car-radio-summary">
                      <span className="sr-only">{frequency} FM. </span>
                      <strong>{radio.active.name}</strong>
                      <span className="car-preview-provider">{PROVIDERS[radio.active.provider]}</span>
                    </span>
                    <span className="car-preview-action" aria-hidden="true">
                      Abrir radio <ChevronRight size={15} />
                    </span>
                  </span>
                </button>
              </div>
            </div>
            {sceneStatus === "ready" && (
              <button
                type="button" className="scene-toggle" disabled={view !== "car"}
                onClick={() => setScenePaused((paused) => !paused)}
              >
                {scenePaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
                {scenePaused ? "Reanudar paisaje" : "Pausar paisaje"}
              </button>
            )}
          </section>
          {(radio.invalidShare || radio.storageUnavailable) && (
            <div className="app-notice" role="status">
              {radio.invalidShare && <p>El enlace compartido es inválido o está incompleto.</p>}
              {radio.storageUnavailable && <p>El almacenamiento del navegador no está disponible. Los cambios durarán esta sesión.</p>}
            </div>
          )}
          <div className="cabin" id="car-radio" ref={consolePanel}>
            <div className="radio-bezel" aria-hidden="true" />
            <div className="radio-toolbar" hidden={view !== "radio"}>
              <button type="button" className="secondary-button" onClick={backToCar}>
                <ChevronLeft size={16} aria-hidden="true" /> Volver al volante
              </button>
              <button
                type="button" className="secondary-button share-button" disabled={!radio.ready}
                onClick={() => setShared(radio.active)}
              >
                <Share2 size={15} aria-hidden="true" /> Compartir
              </button>
              {preview && (
                <button type="button" className="primary-button" onClick={() => radio.add(preview)}>
                  Guardar estación
                </button>
              )}
            </div>

            <section className="screen tuner" aria-labelledby="active-station-heading" hidden={view !== "radio"}>
              <div className="tuner-content">
                <div className="dial-controls">
                  <button
                    className="icon-button tune-button tune-prev" type="button" aria-label="Estación anterior"
                    disabled={radio.stations.length < 2} onClick={() => tune(-1)}
                  >
                    <ChevronLeft size={26} aria-hidden="true" />
                  </button>
                  <div
                    className="wheel" role="group" aria-label="Rueda de estaciones"
                    style={{ "--count": radio.stations.length + 1 } as CSSProperties}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); tune(1); }
                      if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); tune(-1); }
                    }}
                  >
                    <div className="wheel-ring" aria-hidden="true" />
                    {radio.stations.map((station, index) => {
                      const key = stationKey(station);
                      const current = key === activeKey;
                      const isPreview = station === radio.preview;
                      return (
                        <button
                          key={key} type="button"
                          className={`wheel-node${current ? " is-active" : ""}`}
                          style={{ "--angle": `${(360 / (radio.stations.length + 1)) * index}deg`, "--tone": `var(--tone-${index % 3})` } as CSSProperties}
                          aria-label={`${station.name}, ${PROVIDERS[station.provider]}`}
                          aria-current={current ? "true" : undefined}
                          title={station.name}
                          disabled={!radio.ready || (isPreview && !current)}
                          onClick={() => { if (!isPreview) radio.select(key); }}
                        >
                          {key === DEFAULT_KEY ? <Radio size={20} aria-hidden="true" /> : initials(station.name)}
                        </button>
                      );
                    })}
                    <button
                      type="button" className="wheel-node wheel-add" aria-label="Añadir estación" title="Añadir estación"
                      style={{ "--angle": `${(360 / (radio.stations.length + 1)) * radio.stations.length}deg` } as CSSProperties}
                      disabled={!radio.ready} onClick={() => setEditor("new")}
                    >
                      <Plus size={20} aria-hidden="true" />
                    </button>
                    <div className="now-tuned" aria-live="polite">
                      <div className="signal">
                        <span>{frequency}</span> <b>FM</b>
                      </div>
                      <h2 id="active-station-heading" ref={stationHeading} tabIndex={-1}>{radio.active.name}</h2>
                      {radio.preview && <span className="preview-label">Estación compartida</span>}
                    </div>
                  </div>
                  <div className="dial" aria-hidden="true">
                    <div className="dial-ruler" style={{ "--position": `${dialPosition}%` } as CSSProperties}>
                      {ticks.map((tick) => <i key={tick} className={tick % 12 === 0 ? "major-tick" : ""} />)}
                      <span className="dial-needle" />
                    </div>
                    <div className="dial-labels"><span>88</span><span>93</span><span>98</span><span>103</span><span>108</span></div>
                  </div>
                  <button
                    className="icon-button tune-button tune-next" type="button" aria-label="Estación siguiente"
                    disabled={radio.stations.length < 2} onClick={() => tune(1)}
                  >
                    <ChevronRight size={26} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </section>

            <section className="tray" data-concealed={view === "car" && (!radio.ready || radio.active.provider !== "youtube") ? "" : undefined}>
              {radio.ready
                ? <RadioPlayer key={activeKey} station={radio.active} onUnplayable={reportUnplayable} onSkip={skipUnplayable} />
                : <div className="player-skeleton" aria-busy="true" aria-label="Cargando reproductor" />}
            </section>

            <aside
              id="station-collection" className="screen collection" aria-labelledby="collection-heading"
              hidden={view !== "radio" || !collectionOpen}
            >
              <div className="collection-head">
                <span className="section-label"><AudioLines size={17} aria-hidden="true" /> Colección</span>
                <h2 id="collection-heading" ref={collectionHeading} tabIndex={-1}>Mis estaciones</h2>
              </div>
              <ul className="station-list">
                {radio.stations.map((station) => {
                  const key = stationKey(station);
                  const current = activeKey === key;
                  const fixed = key === DEFAULT_KEY;
                  const preview = station === radio.preview;
                  return (
                    <li key={key} className={`station-row${current ? " is-active" : ""}`}>
                      <button
                        type="button" className="station-select" aria-current={current ? "true" : undefined}
                        onClick={() => { if (!preview) radio.select(key); }} disabled={!radio.ready || preview}
                      >
                        <span className="station-glyph">
                          {current ? <AudioLines size={21} aria-hidden="true" /> : <Radio size={21} aria-hidden="true" />}
                        </span>
                        <span className="station-label">
                          <strong>{station.name}</strong>
                          <small>{PROVIDERS[station.provider]}{preview ? " · Compartida" : fixed ? " · Predeterminada" : ""}</small>
                        </span>
                      </button>
                      {fixed && <span className="station-lock" title="Estación predeterminada"><LockKeyhole size={15} aria-hidden="true" /></span>}
                      {!fixed && !preview && (
                        <div className="station-actions">
                          <button
                            type="button" className="icon-button" aria-label={`Renombrar ${station.name}`}
                            title="Renombrar" onClick={() => setEditor(station)}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button" className="icon-button delete-button" aria-label={`Eliminar ${station.name}`}
                            title="Eliminar" onClick={() => {
                              if (window.confirm(`¿Eliminar «${station.name}» de tus estaciones?`)) radio.remove(key);
                            }}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="add-station" disabled={!radio.ready} onClick={() => setEditor("new")}>
                <Plus size={19} aria-hidden="true" /> Añadir estación
              </button>
              {radio.collection.length === 1 && !radio.preview && (
                <p className="collection-note">Convierte una playlist de Spotify o YouTube en una estación de tu radio.</p>
              )}
            </aside>
          </div>
        </div>
      </main>

      <footer className="shell site-footer">
        <span className="footer-brand"><RadioTower size={17} aria-hidden="true" /> Leonida FM</span>
        <small>Unofficial fan-made project. Not affiliated with Rockstar Games or Take-Two Interactive.</small>
      </footer>

      {editor && <StationDialog station={editor === "new" ? undefined : editor} onSave={save} onClose={() => setEditor(undefined)} />}
      {shared && <ShareDialog station={shared} onClose={() => setShared(undefined)} />}
    </div>
  );
}
