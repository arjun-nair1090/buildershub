const KEY = "jtvs.session";

/**
 * "Keep me signed in" stores the token in localStorage; otherwise sessionStorage,
 * so the session ends when the browser is closed.
 */
export const tokenStore = {
  get(): string | null {
    try {
      return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string, remember: boolean) {
    try {
      this.clear();
      (remember ? localStorage : sessionStorage).setItem(KEY, token);
    } catch {
      /* storage unavailable (private mode) */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
