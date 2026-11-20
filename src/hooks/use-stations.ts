"use client";

import { startTransition, useEffect, useReducer } from "react";
import {
  DEFAULT_KEY, DEFAULT_STATION, STORAGE_KEY, emptyRadio, readSavedRadio,
  readSharedStation, stationKey,
} from "@/lib/stations";
import type { SavedRadio, Station } from "@/types/station";

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
      if (action.key !== DEFAULT_KEY && !saved.stations.some((station) => stationKey(station) === action.key)) return state;
      return updateSaved({ ...state, invalidShare: false }, { ...saved, selectedKey: action.key }, null);
    case "add": {
      const key = stationKey(action.station);
      if (key === DEFAULT_KEY || saved.stations.some((station) => stationKey(station) === key)) return state;
      return updateSaved({ ...state, invalidShare: false }, { ...saved, stations: [...saved.stations, action.station], selectedKey: key }, null);
    }
    case "remove": {
      const stations = saved.stations.filter((station) => stationKey(station) !== action.key);
      if (stations.length === saved.stations.length) return state;
      return updateSaved(state, {
        ...saved,
        stations,
        selectedKey: saved.selectedKey === action.key ? DEFAULT_KEY : saved.selectedKey,
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
      if (key === DEFAULT_KEY || saved.stations.some((station) => stationKey(station) === key)) {
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

  const collection = [DEFAULT_STATION, ...state.saved.stations];
  const active = state.preview ?? collection.find((station) => stationKey(station) === state.saved.selectedKey) ?? DEFAULT_STATION;
  const stations = state.preview ? [...collection, state.preview] : collection;

  function select(key: string) {
    if (key === stationKey(active) && !state.invalidShare) return;
    clearShare();
    dispatch({ type: "select", key });
  }

  function clearShare() {
    const url = new URL(window.location.href);
    if (url.searchParams.has("station")) {
      for (const param of ["station", "provider", "playlist", "name"]) url.searchParams.delete(param);
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

  return { ...state, active, stations, collection, select, add, remove, dispatch };
}
