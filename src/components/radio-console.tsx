"use client";

import { startTransition, useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  AudioLines, ChevronLeft, ChevronRight, Copy, ListMusic, LockKeyhole, Pencil,
  Pause, Play, Plus, Radio, RadioTower, Share2, Trash2, X,
} from "lucide-react";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { useStations } from "@/hooks/use-stations";
import { MAX_SPEED_KMH, MIN_SPEED_KMH } from "@/lib/driving-speed";
import { DEFAULT_KEY, PROVIDERS, matchingPresetKey, nextPlayable, shareHref, stationKey, stationWindowStart } from "@/lib/stations";
import type { Provider, Station } from "@/types/station";
import { CarSceneLayer } from "./car-scene-layer";
import { RadioPlayer } from "./radio-player";
import { StationDialog } from "./station-dialog";

function initials(name: string) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => Array.from(word)[0]);
  return letters.join("").toUpperCase();
}

const ticks = Array.from({ length: 49 }, (_, index) => index);
const WHEEL_STATIONS = 8;
const TUNING_CUE_MS = 2000;
const providers = Object.entries(PROVIDERS) as [Provider, string][];

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
  const [desktopView, setView] = useState<"car" | "radio">("car");
  const [canDrive, setCanDrive] = useState(false);
  const view = canDrive ? desktopView : "radio";
  const [collectionOpen, setCollectionOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const collectionButton = useRef<HTMLButtonElement>(null);
  const stationHeading = useRef<HTMLHeadingElement>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const focusTunedStation = useRef(false);
  const collectionHeading = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<"open" | "station" | "collection" | null>(null);
  const look = useRef<HTMLDivElement>(null);
  const consolePanel = useRef<HTMLDivElement>(null);
  const speedometer = useRef<HTMLDivElement>(null);
  const speedReadout = useRef<HTMLElement>(null);
  const [scenePaused, setScenePaused] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(65);
  const tabHidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
  const transition = useScreenTransition(canDrive ? view : null, consolePanel, openButton);
  // The landscape only moves while the cockpit is in view, the tab is visible and the user has not paused it.
  const sceneRunning = view === "car" && !tabHidden && !scenePaused;
  const updateSpeedometer = useCallback((speed: number) => {
    const gauge = speedometer.current;
    const readout = speedReadout.current;
    if (!gauge || !readout) return;

    gauge.style.setProperty("--needle-angle", `${-120 + speed / MAX_SPEED_KMH * 240}deg`);
    const value = String(Math.round(speed));
    if (readout.textContent === value) return;

    readout.textContent = value;
    gauge.setAttribute("aria-valuenow", value);
    gauge.setAttribute("aria-valuetext", `${value} km/h`);
  }, []);
  const { preview } = radio;
  const activeKey = stationKey(radio.active);
  const [tuning, setTuning] = useState<{ key: string; visible: boolean } | null>(null);
  if (radio.ready && tuning?.key !== activeKey) {
    setTuning({ key: activeKey, visible: tuning !== null && view === "radio" });
  }
  const showTuningCue = tuning?.key === activeKey && tuning.visible;
  const activeIndex = radio.stations.findIndex((station) => stationKey(station) === activeKey);
  const wheelStart = stationWindowStart(activeIndex, radio.stations.length, WHEEL_STATIONS);
  const wheelStations = radio.stations.slice(wheelStart, wheelStart + WHEEL_STATIONS);
  const wheelSlots = wheelStations.length + 1;
  const frequency = (88.1 + 19.8 * (activeIndex / Math.max(5, radio.stations.length - 1))).toFixed(1);
  const dialPosition = ((Number(frequency) - 88) / 20) * 100;

  useEffect(() => {
    if (!tuning?.visible) return;
    const timeout = window.setTimeout(() => {
      setTuning((current) => current === tuning ? { ...tuning, visible: false } : current);
    }, TUNING_CUE_MS);
    return () => window.clearTimeout(timeout);
  }, [tuning]);

  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === "open") openButton.current?.focus();
    if (target === "station") stationHeading.current?.focus();
    if (target === "collection") collectionHeading.current?.focus();
  }, [view, collectionOpen]);

  useEffect(() => {
    if (!focusTunedStation.current) return;
    focusTunedStation.current = false;
    wheel.current?.querySelector<HTMLButtonElement>("[aria-current=true]")?.focus();
  }, [activeKey]);

  useEffect(() => {
    if (view !== "radio") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      if (collectionOpen) {
        setCollectionOpen(false);
        collectionButton.current?.focus();
        return;
      }
      if (!canDrive) return;
      transition.markClosing();
      focusTarget.current = "open";
      setView("car");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, collectionOpen, canDrive, transition]);

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
      if (event.target instanceof Element && event.target.closest(".open-radio, .scene-controls, .site-header, .cabin")) return;
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

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("station")) {
      startTransition(() => setView("radio"));
    }
  }, []);

  function keepRadioOpen() {
    if (!canDrive) setView("radio");
  }

  function openRadio(target: "station" | "collection" = "station") {
    if (view === "radio") {
      (target === "collection" ? collectionHeading : stationHeading).current?.focus();
      return;
    }
    if (target === "station") transition.markOpening(openButton.current?.getBoundingClientRect() ?? null);
    focusTarget.current = target;
    setCollectionOpen(target === "collection");
    setView("radio");
  }

  function toggleCollection() {
    if (view === "car") {
      openRadio("collection");
      return;
    }
    if (collectionOpen) {
      setCollectionOpen(false);
      return;
    }
    focusTarget.current = "collection";
    setCollectionOpen(true);
  }

  function showCollection() {
    if (collectionOpen) collectionHeading.current?.focus();
    else toggleCollection();
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
      return "Este enlace ya está en tus estaciones.";
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
            aria-controls="station-collection" aria-expanded={view === "radio" && collectionOpen}
            onClick={toggleCollection}
          >
            <ListMusic size={17} aria-hidden="true" /> Mis estaciones
          </button>
        </div>
      </header>

      <main className="car-main">
        <h1 className="sr-only">Leonida FM · Your World. Your Frequency.</h1>
        <div className="stage" data-view={view} data-radio-only={!canDrive || undefined}>
          <section className="car-scene" aria-label="Cabina de conducción" aria-hidden={!canDrive || undefined}>
            <div className="car-look" ref={look}>
              <div className="car-frame">
                <CarSceneLayer playing={sceneRunning} speedKmh={speedKmh} onSpeedChange={updateSpeedometer} onReadyChange={setCanDrive} />
              </div>
              <div ref={speedometer} className="car-speedometer" hidden={view !== "car"}
                role="meter" aria-label="Velocidad del vehículo" aria-valuemin={0} aria-valuemax={MAX_SPEED_KMH}
                aria-valuenow={0} aria-valuetext="0 km/h">
                <span className="speedometer-ticks" aria-hidden="true" />
                <span className="speedometer-needle" aria-hidden="true" />
                <span className="speedometer-readout" aria-hidden="true"><strong ref={speedReadout}>0</strong> km/h</span>
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
            {canDrive && view === "car" && (
              <div className="scene-controls">
                <label className="scene-speed">
                  Velocidad base <span aria-hidden="true">{speedKmh} km/h</span>
                  <input
                    type="range" min={MIN_SPEED_KMH} max={MAX_SPEED_KMH} step={5} value={speedKmh}
                    aria-valuetext={`${speedKmh} km/h`}
                    onChange={(event) => setSpeedKmh(event.currentTarget.valueAsNumber)}
                  />
                </label>
                <button type="button" className="scene-toggle" onClick={() => setScenePaused((paused) => !paused)}>
                  {scenePaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
                  {scenePaused ? "Reanudar paisaje" : "Pausar paisaje"}
                </button>
              </div>
            )}
          </section>
          {(radio.invalidShare || radio.storageUnavailable) && (
            <div className="app-notice" role="status">
              {radio.invalidShare && <p>El enlace compartido es inválido o está incompleto.</p>}
              {radio.storageUnavailable && <p>El almacenamiento del navegador no está disponible. Los cambios durarán esta sesión.</p>}
            </div>
          )}
          <div className="cabin" id="car-radio" ref={consolePanel} onFocusCapture={keepRadioOpen}>
            <div className="radio-bezel" aria-hidden="true" />
            <div className="radio-toolbar" hidden={view !== "radio"}>
              <div className="radio-providers" role="group" aria-label="Plataforma de reproducción">
                {providers.map(([provider, label]) => {
                  const current = radio.active.provider === provider;
                  const explore = radio.ready && !current && !matchingPresetKey(radio.active, provider);
                  return (
                    <button
                      key={provider} type="button" aria-pressed={current}
                      disabled={!radio.ready} onClick={() => radio.selectProvider(provider)}
                    >
                      {explore ? `Explorar ${label}` : label}
                      {explore && <small>Sin esta emisora</small>}
                    </button>
                  );
                })}
              </div>
              {canDrive && (
                <button type="button" className="secondary-button" onClick={backToCar}>
                  <ChevronLeft size={16} aria-hidden="true" /> Volver al volante
                </button>
              )}
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

            <section className="screen tuner" aria-labelledby="active-station-heading" hidden={view !== "radio"}
              data-tuning={showTuningCue || undefined}>
              <div className="tuner-content">
                <div className="dial-controls">
                  <button
                    className="icon-button tune-button tune-prev" type="button" aria-label="Estación anterior"
                    disabled={radio.stations.length < 2} onClick={() => tune(-1)}
                  >
                    <ChevronLeft size={26} aria-hidden="true" />
                  </button>
                  <div
                    ref={wheel} className="wheel" role="group" aria-label="Rueda de estaciones"
                    style={{ "--count": wheelSlots } as CSSProperties}
                    onKeyDown={(event) => {
                      if (radio.stations.length < 2) return;
                      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
                      const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
                      if (!forward && !backward) return;
                      event.preventDefault();
                      focusTunedStation.current = true;
                      tune(forward ? 1 : -1);
                    }}
                  >
                    <div className="wheel-ring" aria-hidden="true" />
                    {wheelStations.map((station, index) => {
                      const key = stationKey(station);
                      const current = key === activeKey;
                      const isPreview = station === radio.preview;
                      return (
                        <button
                          key={key} type="button"
                          className={`wheel-node${current ? " is-active" : ""}`}
                          style={{ "--angle": `${(360 / wheelSlots) * index}deg`, "--tone": `var(--tone-${(wheelStart + index) % 3})` } as CSSProperties}
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
                      style={{ "--angle": `${(360 / wheelSlots) * wheelStations.length}deg` } as CSSProperties}
                      disabled={!radio.ready} onClick={() => setEditor("new")}
                    >
                      <Plus size={20} aria-hidden="true" />
                    </button>
                    <div className="now-tuned">
                      <div className="tuned-station" aria-live="polite">
                        <div className="signal">
                          <span>{frequency}</span> <b>FM</b>
                        </div>
                        <h2 id="active-station-heading" ref={stationHeading} tabIndex={-1}>{radio.active.name}</h2>
                        {radio.preview && <span className="preview-label">Estación compartida</span>}
                        {showTuningCue && <span key={activeKey} className="tuning-cue" aria-hidden="true">La ciudad sigue despierta</span>}
                      </div>
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
                <button type="button" className="station-directory-link" onClick={showCollection} aria-controls="station-collection">
                  <ListMusic size={16} aria-hidden="true" />
                  <span className="sr-only">Ver lista de estaciones.</span>
                  Estación {activeIndex + 1} de {radio.stations.length}
                </button>
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
                <h2 id="collection-heading" ref={collectionHeading} tabIndex={-1}>Mis estaciones · {PROVIDERS[radio.active.provider]}</h2>
              </div>
              <ul className="station-list">
                {radio.stations.map((station) => {
                  const key = stationKey(station);
                  const current = activeKey === key;
                  const preview = station === radio.preview;
                  const fixed = !preview && !radio.saved.stations.some((saved) => stationKey(saved) === key);
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
            </aside>
          </div>
        </div>
      </main>

      <footer className="shell site-footer">
        <span className="footer-brand"><RadioTower size={17} aria-hidden="true" /> Leonida FM</span>
        <small>Unofficial fan-made project. Not affiliated with Rockstar Games or Take-Two Interactive.</small>
      </footer>

      {editor && <StationDialog station={editor === "new" ? undefined : editor} initialProvider={radio.active.provider} onSave={save} onClose={() => setEditor(undefined)} />}
      {shared && <ShareDialog station={shared} onClose={() => setShared(undefined)} />}
    </div>
  );
}
