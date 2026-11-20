"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { NAME_LIMIT, PROVIDERS, normalizeName, oembedProblem, parsePlaylist, youtubeOembedUrl } from "@/lib/stations";
import type { Provider, Station } from "@/types/station";

interface Props {
  station?: Station;
  onClose: () => void;
  onSave: (station: Station) => string | undefined;
}

export function StationDialog({ station, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<Provider>(station?.provider ?? "spotify");
  const [error, setError] = useState<{ field: "name" | "url"; message: string }>();
  const [checking, setChecking] = useState(false);
  const [warned, setWarned] = useState<string>();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function embedWarning(playlistId: string) {
    try {
      const response = await fetch(youtubeOembedUrl(playlistId), { signal: AbortSignal.timeout(4000) });
      return oembedProblem(response.status);
    } catch {
      return null; // Offline or blocked: the check is advisory only.
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeName(nameInput.current?.value);
    if (!name) {
      setError({ field: "name", message: "Escribe un nombre de hasta 60 caracteres." });
      nameInput.current?.focus();
      return;
    }
    const playlistId = station?.playlistId ?? parsePlaylist(urlInput.current?.value ?? "", provider);
    if (!playlistId) {
      setError({ field: "url", message: `Pega un enlace HTTPS de una playlist compatible con ${PROVIDERS[provider]}.` });
      urlInput.current?.focus();
      return;
    }
    if (!station && provider === "youtube" && warned !== playlistId) {
      setChecking(true);
      const warning = await embedWarning(playlistId);
      setChecking(false);
      if (warning) {
        setWarned(playlistId);
        setError({ field: "url", message: `${warning} Pulsa «Guardar estación» otra vez para añadirla de todos modos.` });
        urlInput.current?.focus();
        return;
      }
    }
    const message = onSave({ provider, playlistId, name });
    if (message) {
      setError({ field: "url", message });
      urlInput.current?.focus();
      return;
    }
    dialog.current?.close();
  }

  return (
    <dialog ref={dialog} className="station-dialog" aria-labelledby="dialog-title" onClose={onClose}>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="flex items-center justify-between gap-4">
          <h2 id="dialog-title">{station ? "Renombrar estación" : "Añadir estación"}</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={() => dialog.current?.close()}>
            <X size={20} />
          </button>
        </div>
        {!station && (
          <>
            <fieldset>
              <legend>Plataforma</legend>
              <div className="provider-options">
                {(Object.keys(PROVIDERS) as Provider[]).map((option) => (
                  <label key={option}>
                    <input
                      type="radio" name="provider" value={option} checked={provider === option}
                      onChange={() => { setProvider(option); setError(undefined); }}
                    />
                    {PROVIDERS[option]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="form-field">
              Enlace de la playlist
              <input
                ref={urlInput} type="url" name="url" autoFocus required maxLength={2048}
                placeholder={provider === "spotify" ? "https://open.spotify.com/playlist/…" : "https://www.youtube.com/playlist?list=…"}
                aria-invalid={error?.field === "url"}
                aria-describedby={error?.field === "url" ? "station-error" : "playlist-hint"}
                onChange={() => { if (error?.field === "url") setError(undefined); }}
              />
            </label>
            <p id="playlist-hint" className="form-hint">Usa el enlace de una playlist compartible.</p>
          </>
        )}
        <label className="form-field">
          Nombre de la estación
          <input
            ref={nameInput} name="station-name" defaultValue={station?.name} autoFocus={!!station}
            placeholder="Ej. Ruta nocturna" maxLength={NAME_LIMIT} required
            aria-invalid={error?.field === "name"}
            aria-describedby={error?.field === "name" ? "station-error" : undefined}
            onChange={() => { if (error?.field === "name") setError(undefined); }}
          />
        </label>
        {error && <p className="form-error" id="station-error" role="alert">{error.message}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={() => dialog.current?.close()}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={checking}>{checking ? "Comprobando…" : "Guardar estación"}</button>
        </div>
      </form>
    </dialog>
  );
}
