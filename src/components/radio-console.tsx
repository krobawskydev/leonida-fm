"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  AudioLines, ChevronLeft, ChevronRight, Copy, ListMusic, LockKeyhole, Pencil,
  Plus, Radio, RadioTower, Share2, Trash2, X,
} from "lucide-react";
import { useStations } from "@/hooks/use-stations";
import { DEFAULT_KEY, PROVIDERS, nextPlayable, shareHref, stationKey } from "@/lib/stations";
import type { Station } from "@/types/station";
import { RadioPlayer } from "./radio-player";
import { StationDialog } from "./station-dialog";

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

export function RadioConsole() {
  const radio = useStations();
  const [editor, setEditor] = useState<"new" | Station>();
  const [shared, setShared] = useState<Station>();
  const failed = useRef(new Set<string>());
  const { preview } = radio;
  const activeKey = stationKey(radio.active);
  const activeIndex = radio.stations.findIndex((station) => stationKey(station) === activeKey);
  const frequency = (88.1 + 19.8 * (activeIndex / Math.max(5, radio.stations.length - 1))).toFixed(1);
  const dialPosition = ((Number(frequency) - 88) / 20) * 100;

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
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <div className="brand">
            <span className="brand-symbol"><RadioTower size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <span>Leonida<span className="brand-fm"> FM</span></span>
          </div>
          <a className="header-link" href="#collection-heading"><ListMusic size={17} aria-hidden="true" /> Mis estaciones</a>
        </div>
      </header>

      <main className="shell">
        <section className="hero" aria-labelledby="site-title">
          <div className="hero-content">
            <h1 id="site-title">Your World.<br /><em>Your Frequency.</em></h1>
            <p>Sintoniza tu música. Crea tu propia radio.</p>
          </div>
        </section>

        {(radio.invalidShare || radio.storageUnavailable) && (
          <div className="app-notice" role="status">
            {radio.invalidShare && <p>El enlace compartido es inválido o está incompleto.</p>}
            {radio.storageUnavailable && <p>El almacenamiento del navegador no está disponible. Los cambios durarán esta sesión.</p>}
          </div>
        )}

        <div className="console-grid">
          <section className="panel tuner" aria-labelledby="active-station-heading">
            <div className="tuner-content">
              <div className="tuner-top">
                <span className="section-label"><Radio size={16} aria-hidden="true" /> Sintonizador</span>
                <button
                  type="button" className="secondary-button share-button" disabled={!radio.ready}
                  onClick={() => setShared(radio.active)}
                >
                  <Share2 size={15} aria-hidden="true" /> Compartir
                </button>
              </div>
              <div className="now-tuned" aria-live="polite">
                <div className="signal">
                  <span>{frequency}</span> <b>FM</b>
                </div>
                <h2 id="active-station-heading">{radio.active.name}</h2>
                {radio.preview && <span className="preview-label">Estación compartida</span>}
              </div>

              <div className="dial-controls">
                <button
                  className="icon-button tune-button" type="button" aria-label="Estación anterior"
                  disabled={radio.stations.length < 2} onClick={() => tune(-1)}
                >
                  <ChevronLeft size={21} aria-hidden="true" />
                </button>
                <div className="dial" aria-hidden="true">
                  <div className="dial-ruler" style={{ "--position": `${dialPosition}%` } as CSSProperties}>
                    {ticks.map((tick) => <i key={tick} className={tick % 12 === 0 ? "major-tick" : ""} />)}
                    <span className="dial-needle" />
                  </div>
                  <div className="dial-labels"><span>88</span><span>93</span><span>98</span><span>103</span><span>108</span></div>
                </div>
                <button
                  className="icon-button tune-button" type="button" aria-label="Estación siguiente"
                  disabled={radio.stations.length < 2} onClick={() => tune(1)}
                >
                  <ChevronRight size={21} aria-hidden="true" />
                </button>
              </div>
            </div>
            {radio.ready
              ? <RadioPlayer key={activeKey} station={radio.active} onUnplayable={reportUnplayable} onSkip={skipUnplayable} />
              : <div className="player-skeleton" aria-busy="true" aria-label="Cargando reproductor" />}
          </section>

          <aside className="panel collection" aria-labelledby="collection-heading">
            <div className="collection-head">
              <span className="section-label"><AudioLines size={17} aria-hidden="true" /> Colección</span>
              <h2 id="collection-heading" tabIndex={-1}>Mis estaciones</h2>
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
            {preview && (
              <button type="button" className="primary-button save-preview" onClick={() => radio.add(preview)}>
                Guardar estación
              </button>
            )}
            <button type="button" className="add-station" disabled={!radio.ready} onClick={() => setEditor("new")}>
              <Plus size={19} aria-hidden="true" /> Añadir estación
            </button>
            {radio.collection.length === 1 && !radio.preview && (
              <p className="collection-note">Convierte una playlist de Spotify o YouTube en una estación de tu radio.</p>
            )}
          </aside>
        </div>
      </main>

      <footer className="shell site-footer">
        <span className="footer-brand"><RadioTower size={17} aria-hidden="true" /> Leonida FM</span>
        <small>Unofficial fan-made project. Not affiliated with Rockstar Games or Take-Two Interactive.</small>
      </footer>

      {editor && <StationDialog station={editor === "new" ? undefined : editor} onSave={save} onClose={() => setEditor(undefined)} />}
      {shared && <ShareDialog station={shared} onClose={() => setShared(undefined)} />}
    </>
  );
}
