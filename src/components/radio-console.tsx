"use client";

import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  AudioLines, ChevronLeft, ChevronRight, Copy, ListMusic, LockKeyhole, Pencil,
  Pause, Play, Plus, Radio, RadioTower, Share2, Star, Trash2, X,
} from "lucide-react";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { useStations } from "@/hooks/use-stations";
import { MAX_SPEED_KMH, MIN_SPEED_KMH } from "@/lib/driving-speed";
import { projectAuthor } from "@/lib/project-author";
import { DEFAULT_KEY, PROVIDERS, favoriteStationKey, nextAutomaticStation, shareHref, stationKey, stationProfile, stationWindowStart } from "@/lib/stations";
import type { Provider, Station } from "@/types/station";
import { CarSceneLayer } from "./car-scene-layer";
import { RadioPlayer } from "./radio-player";
import type { SpotifyTuner } from "./spotify-embed";
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
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const collectionButton = useRef<HTMLButtonElement>(null);
  const directoryButton = useRef<HTMLButtonElement>(null);
  const collectionTrigger = useRef<"header" | "dial">("header");
  const stationHeading = useRef<HTMLHeadingElement>(null);
  const spotifyTuner = useRef<SpotifyTuner>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const focusTunedStation = useRef(false);
  const collectionHeading = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<"open" | "station" | "collection" | null>(null);
  const cockpit = useRef<HTMLDivElement>(null);
  const consolePanel = useRef<HTMLDivElement>(null);
  const playerTray = useRef<HTMLElement>(null);
  const speedometer = useRef<HTMLDivElement>(null);
  const speedReadout = useRef<HTMLElement>(null);
  const [scenePaused, setScenePaused] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(65);
  const tabHidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
  const transition = useScreenTransition(canDrive ? view : null, consolePanel);
  // Keep the landscape moving behind the radio while the scene is available and the tab is visible.
  const sceneRunning = canDrive && !tabHidden && !scenePaused;
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
  const favoriteKeys = new Set(radio.saved.favoriteKeys);
  const listedStations = favoritesOnly
    ? radio.stations.filter((station) => station !== preview && favoriteKeys.has(favoriteStationKey(station)))
    : radio.stations;
  const activeKey = stationKey(radio.active);
  const activeFavorite = favoriteKeys.has(favoriteStationKey(radio.active));
  const favoriteButton = !preview && (
    <button type="button" className="icon-button favorite-button"
      aria-label={`${radio.active.name} como favorita`} aria-pressed={activeFavorite}
      title={activeFavorite ? "Quitar de favoritas" : "Añadir a favoritas"}
      disabled={!radio.ready} onClick={() => radio.dispatch({ type: "toggle-favorite", key: activeKey })}>
      <Star size={16} aria-hidden="true" />
    </button>
  );
  const [tuning, setTuning] = useState<{ key: string; visible: boolean } | null>(null);
  if (radio.ready && tuning?.key !== activeKey) {
    setTuning({ key: activeKey, visible: tuning !== null && view === "radio" });
  }
  const showTuningCue = tuning?.key === activeKey && tuning.visible;
  const activeIndex = radio.stations.findIndex((station) => stationKey(station) === activeKey);
  const wheelStart = stationWindowStart(activeIndex, radio.stations.length, WHEEL_STATIONS);
  const wheelStations = radio.stations.slice(wheelStart, wheelStart + WHEEL_STATIONS);
  const wheelSlots = wheelStations.length + 1;
  const profile = stationProfile(radio.active);
  const customStart = radio.stations.findIndex((station) => !stationProfile(station));
  const frequencyValue = profile?.frequency ?? 107.2 + 0.7 * (activeIndex - customStart) / Math.max(1, radio.stations.length - customStart - 1);
  const frequency = frequencyValue.toFixed(1);
  const dialPosition = ((frequencyValue - 88) / 20) * 100;

  useEffect(() => {
    if (!tuning?.visible) return;
    const timeout = window.setTimeout(() => {
      setTuning((current) => current === tuning ? { ...tuning, visible: false } : current);
    }, TUNING_CUE_MS);
    return () => window.clearTimeout(timeout);
  }, [tuning]);

  useLayoutEffect(() => {
    if (view !== "car") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [view]);

  useLayoutEffect(() => {
    const tray = playerTray.current;
    if (view !== "car" || !tray) return;

    const spotify = radio.active.provider === "spotify";
    const fitPlayer = () => {
      const { clientWidth: width, clientHeight: height } = tray;
      if (width === 0 || height === 0) return;
      const minWidth = spotify ? 280 : 200;
      const minHeight = spotify ? 352 : 200;
      const scale = Math.min(1, width / minWidth, height / minHeight);
      tray.style.setProperty("--embed-width", `${Math.max(minWidth, width / scale)}px`);
      tray.style.setProperty("--embed-height", `${Math.max(minHeight, height / scale)}px`);
      tray.style.setProperty("--embed-scale", String(scale));
    };

    fitPlayer();
    const observer = new ResizeObserver(fitPlayer);
    observer.observe(tray);
    return () => observer.disconnect();
  }, [view, radio.active.provider]);

  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === "open") openButton.current?.focus({ preventScroll: true });
    if (target === "station") stationHeading.current?.focus();
    if (target === "collection") collectionHeading.current?.focus();
  }, [view, collectionOpen]);

  useEffect(() => {
    if (!focusTunedStation.current) return;
    focusTunedStation.current = false;
    wheel.current?.querySelector<HTMLButtonElement>("[aria-current=true]")?.focus();
  }, [activeKey]);

  const closeCollection = useCallback(() => {
    setCollectionOpen(false);
    const button = collectionTrigger.current === "dial" ? directoryButton : collectionButton;
    button.current?.focus();
  }, []);

  useEffect(() => {
    if (view !== "radio") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      if (collectionOpen) {
        closeCollection();
        return;
      }
      if (!canDrive) return;
      transition.markClosing();
      focusTarget.current = "open";
      setView("car");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, collectionOpen, canDrive, transition, closeCollection]);

  // Keep the last camera position while the radio is open.
  useEffect(() => {
    const node = cockpit.current;
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
      // Hold the view still over controls so they do not drift away from the cursor.
      if (event.target instanceof Element && event.target.closest(".scene-controls, .site-header, .cabin")) return;
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
    if (target === "station") transition.markOpening(consolePanel.current?.getBoundingClientRect() ?? null);
    focusTarget.current = target;
    setCollectionOpen(target === "collection");
    setView("radio");
  }

  function toggleCollection() {
    collectionTrigger.current = "header";
    if (view === "car") {
      openRadio("collection");
      return;
    }
    if (collectionOpen) {
      closeCollection();
      return;
    }
    focusTarget.current = "collection";
    setCollectionOpen(true);
  }

  function showCollection() {
    collectionTrigger.current = "dial";
    if (collectionOpen) {
      collectionHeading.current?.focus();
      return;
    }
    focusTarget.current = "collection";
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
    selectStation(next);
  }

  function selectStation(station: Station) {
    const key = stationKey(station);
    if (key !== activeKey && radio.active.provider === "spotify" && station.provider === "spotify") {
      spotifyTuner.current?.tune(station.playlistId);
    }
    radio.select(key);
  }

  function automaticStation() {
    return nextAutomaticStation(radio.stations, activeIndex, failed.current, new URLSearchParams(window.location.search));
  }

  function reportUnplayable() {
    failed.current.add(activeKey);
    return automaticStation()?.name ?? null;
  }

  function skipUnplayable() {
    const next = automaticStation();
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
        <div className="stage" ref={cockpit} data-view={view} data-radio-only={!canDrive || undefined}>
          <section className="car-scene" aria-label="Cabina de conducción" aria-hidden={!canDrive || undefined}>
            <div className="car-look">
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
                  const explore = radio.ready && !current && !radio.matchingStationKey(provider);
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
                          onClick={() => { if (!isPreview) selectStation(station); }}
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
                        {profile && <span className="station-genre">{profile.genre}</span>}
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
                <div className="tuner-actions">
                  <button ref={directoryButton} type="button" className="station-directory-link" onClick={showCollection}
                    aria-controls="station-collection" aria-expanded={collectionOpen}>
                    <ListMusic size={16} aria-hidden="true" />
                    <span className="sr-only">Ver lista de estaciones.</span>
                    Estación {activeIndex + 1} de {radio.stations.length}
                  </button>
                  {view === "radio" && favoriteButton}
                </div>
              </div>
            </section>

            <div className="dashboard-station" hidden={view !== "car"}>
              <span className="dashboard-frequency">{frequency} <small>FM</small></span>
              <strong className="dashboard-station-name">{radio.active.name}</strong>
              {profile && <span className="dashboard-station-genre">{profile.genre}</span>}
              <div className="dashboard-actions">
                <button
                  ref={openButton} type="button" className="secondary-button open-radio"
                  aria-controls="car-radio" onClick={() => openRadio()} disabled={!radio.ready}
                >
                  Ver radio <ChevronRight size={14} aria-hidden="true" />
                </button>
                {view === "car" && favoriteButton}
              </div>
            </div>
            <section ref={playerTray} className="tray" data-provider={radio.active.provider}>
              {radio.ready
                ? <RadioPlayer key={radio.active.provider === "spotify" ? "spotify" : activeKey}
                  station={radio.active} spotifyTuner={spotifyTuner} onUnplayable={reportUnplayable}
                  onSkip={view === "radio" ? skipUnplayable : undefined} />
                : <div className="player-skeleton" aria-busy="true" aria-label="Cargando reproductor" />}
            </section>

            <aside
              id="station-collection" className="screen collection" aria-labelledby="collection-heading"
              hidden={view !== "radio" || !collectionOpen}
            >
              <div className="collection-head">
                <div>
                  <span className="section-label"><AudioLines size={17} aria-hidden="true" /> Colección</span>
                  <h2 id="collection-heading" ref={collectionHeading} tabIndex={-1}>Mis estaciones · {PROVIDERS[radio.active.provider]}</h2>
                </div>
                <div className="collection-controls">
                  <div className="collection-filter" role="group" aria-label="Filtrar estaciones">
                    <button type="button" className="secondary-button" aria-pressed={!favoritesOnly} onClick={() => setFavoritesOnly(false)}>Todas</button>
                    <button type="button" className="secondary-button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(true)}>Favoritas</button>
                  </div>
                  <button type="button" className="secondary-button collection-close" onClick={closeCollection}>
                    <X size={16} aria-hidden="true" /> Ocultar lista
                  </button>
                </div>
              </div>
              {listedStations.length === 0 && <p className="collection-empty">Sintoniza una emisora y márcala con la estrella del dial.</p>}
              <ul className="station-list" hidden={listedStations.length === 0}>
                {listedStations.map((station) => {
                  const key = stationKey(station);
                  const current = activeKey === key;
                  const preview = station === radio.preview;
                  const fixed = !preview && !radio.saved.stations.some((saved) => stationKey(saved) === key);
                  const genre = stationProfile(station)?.genre;
                  return (
                    <li key={key} className={`station-row${current ? " is-active" : ""}`}>
                      <button
                        type="button" className="station-select" aria-current={current ? "true" : undefined}
                        onClick={() => { if (!preview) selectStation(station); }} disabled={!radio.ready || preview}
                      >
                        <span className="station-glyph">
                          {current ? <AudioLines size={21} aria-hidden="true" /> : <Radio size={21} aria-hidden="true" />}
                        </span>
                        <span className="station-label">
                          <strong>{station.name}</strong>
                          <small>{genre ?? PROVIDERS[station.provider]}{preview ? " · Compartida" : fixed ? " · Predeterminada" : ""}</small>
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
        <small>
          Creado por <a className="footer-author" href={projectAuthor.url}>{projectAuthor.name}</a>.
          {" "}Unofficial fan-made project. Not affiliated with Rockstar Games or Take-Two Interactive.
        </small>
      </footer>

      {editor && <StationDialog station={editor === "new" ? undefined : editor} initialProvider={radio.active.provider} onSave={save} onClose={() => setEditor(undefined)} />}
      {shared && <ShareDialog station={shared} onClose={() => setShared(undefined)} />}
    </div>
  );
}
