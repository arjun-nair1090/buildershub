const KEY = "jewlerify.city";

/** The city a buyer last picked, offered again when location isn't available. */
export function lastCity(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberCity(city: string | null): void {
  try {
    if (city) window.localStorage.setItem(KEY, city);
  } catch {
    // Storage blocked (some private modes): nothing to remember.
  }
}
