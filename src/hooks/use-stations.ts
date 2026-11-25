"use client";

import { startTransition, useEffect, useReducer, useRef } from "react";
import {
  DEFAULT_KEY, DEFAULT_STATION, STORAGE_KEY, emptyRadio, readSavedRadio,
  matchingPresetKey, readSharedStation, stationCollection, stationForProvider, stationKey,
} from "@/lib/stations";
import type { Provider, SavedRadio, Station } from "@/types/station";

interface RadioState {
  saved: SavedRadio;
  preview: Station | null;
  ready: boolean;
  write: boolean;
  storageUnavailable: boolean;
  invalidShare: boolean;
}

type Action =
  | { type: "initialize"; state: RadioState }
  | { type: "select" | "remove"; key: string }
  | { type: "add"; station: Station }
  | { type: "rename"; key: string; name: string }
  | { type: "storage-unavailable" };

const initialState: RadioState = {
  saved: emptyRadio(),
  preview: null,
  ready: false,
  write: false,
  storageUnavailable: false,
  invalidShare: false,
};

function updateSaved(state: RadioState, saved: SavedRadio, preview = state.preview): RadioState {
  return { ...state, saved, preview, write: true };
}

function reducer(state: RadioState, action: Action): RadioState {
  const { saved } = state;

  switch (action.type) {
    case "initialize":
      return state.ready ? state : action.state;
    case "storage-unavailable":
      return { ...state, storageUnavailable: true };
    case "select":
      if (!stationCollection(saved.stations).some((station) => stationKey(station) === action.key)) return state;
      return updateSaved({ ...state, invalidShare: false }, { ...saved, selectedKey: action.key }, null);
    case "add": {
      const key = stationKey(action.station);
      if (stationCollection(saved.stations).some((station) => stationKey(station) === key)) return state;
      return updateSaved({ ...state, invalidShare: false }, { ...saved, stations: [...saved.stations, action.station], selectedKey: key }, null);
    }
    case "remove": {
      const removed = saved.stations.find((station) => stationKey(station) === action.key);
      if (!removed) return state;
      const stations = saved.stations.filter((station) => station !== removed);
      return updateSaved(state, {
        ...saved,
        stations,
        selectedKey: saved.selectedKey === action.key
          ? stationKey(stationForProvider(stationCollection(stations), removed.provider))
          : saved.selectedKey,
      });
    }
    case "rename": {
      if (action.key === DEFAULT_KEY) return state;
      const stations = saved.stations.map((station) => stationKey(station) === action.key
        ? { ...station, name: action.name }
        : station);
      return updateSaved(state, { ...saved, stations });
    }
  }
}

export function useStations() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const lastByProvider = useRef<Partial<Record<Provider, string>>>({});

  useEffect(() => {
    let saved = emptyRadio();
    let storageUnavailable = false;
    try {
      saved = readSavedRadio(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      storageUnavailable = true;
    }

    const url = new URL(window.location.href);
    const hasShare = url.searchParams.has("station");
    const shared = hasShare ? readSharedStation(url.searchParams) : null;
    let preview = shared;
    if (shared) {
      const key = stationKey(shared);
      if (stationCollection(saved.stations).some((station) => stationKey(station) === key)) {
        saved = { ...saved, selectedKey: key };
        preview = null;
      }
      // Keep the incoming URL until the listener deliberately leaves the shared selection.
    }

    startTransition(() => dispatch({
      type: "initialize",
      state: { saved, preview, ready: true, write: false, storageUnavailable, invalidShare: hasShare && !shared },
    }));
  }, []);

  useEffect(() => {
    if (!state.write) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
    } catch {
      startTransition(() => dispatch({ type: "storage-unavailable" }));
    }
  }, [state.saved, state.write]);

  const collection = stationCollection(state.saved.stations);
  const active = state.preview ?? collection.find((station) => stationKey(station) === state.saved.selectedKey) ?? DEFAULT_STATION;
  const providerStations = collection.filter((station) => station.provider === active.provider);
  const stations = state.preview ? [...providerStations, state.preview] : providerStations;

  function select(key: string) {
    if (key === stationKey(active) && !state.invalidShare) return;
    clearShare();
    dispatch({ type: "select", key });
  }

  function selectProvider(provider: Provider) {
    if (provider === active.provider) return;
    const current = collection.find((station) => stationKey(station) === state.saved.selectedKey);
    if (current) lastByProvider.current[current.provider] = stationKey(current);
    const targetKey = matchingPresetKey(active, provider) ?? lastByProvider.current[provider];
    select(stationKey(stationForProvider(collection, provider, targetKey)));
  }

  function clearShare() {
    const url = new URL(window.location.href);
    if (url.searchParams.has("station")) {
      for (const param of ["station", "provider", "playlist", "video", "name"]) url.searchParams.delete(param);
      window.history.replaceState(null, "", url);
    }
  }

  function add(station: Station) {
    if (!state.preview || stationKey(state.preview) !== stationKey(station)) clearShare();
    dispatch({ type: "add", station });
  }

  function remove(key: string) {
    if (key === stationKey(active)) clearShare();
    dispatch({ type: "remove", key });
  }

  return { ...state, active, stations, collection, select, selectProvider, add, remove, dispatch };
}
