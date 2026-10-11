import { useSyncExternalStore } from "react";

export type SavedKind = "piece" | "design";
export const savedKey = (kind: SavedKind, id: string) => `${kind}:${id}`;

const KEY = "jewlerify.saved";
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
// The source of truth while the page is open; storage is a copy so saves survive a reload when allowed.
let memory: string[] | null = null;

function read(): string[] {
  if (memory) return memory;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    memory = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    memory = [];
  }
  return memory;
}

function write(next: string[]) {
  memory = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (some private modes): saves last until the tab closes.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      memory = null; // another tab changed the saves
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Saved pieces and designs, kept on this device only. Newest save first. */
export function useSaved() {
  const saved = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    saved,
    isSaved: (kind: SavedKind, id: string) => saved.includes(savedKey(kind, id)),
    toggle: (kind: SavedKind, id: string) => {
      const key = savedKey(kind, id);
      const current = read();
      write(current.includes(key) ? current.filter((k) => k !== key) : [key, ...current]);
    },
    remove: (key: string) => write(read().filter((k) => k !== key)),
  };
}
