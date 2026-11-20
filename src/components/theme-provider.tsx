"use client";

import { useEffect, useSyncExternalStore } from "react";
import { parseTheme, resolveTheme, systemThemeQuery, themeStorageKey, type ResolvedTheme, type ThemePreference } from "@/lib/theme";

const initial = { preference: "system", resolved: "dark" } satisfies {
  preference: ThemePreference; resolved: ResolvedTheme;
};
let current: { preference: ThemePreference; resolved: ResolvedTheme } = initial;
const listeners = new Set<() => void>();
let media: MediaQueryList | undefined;
let transitionTimer: number | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function apply(preference: ThemePreference, animate = false) {
  const root = document.documentElement;
  const resolved = resolveTheme(preference, (media ?? matchMedia(systemThemeQuery)).matches);
  if (root.dataset.theme !== resolved && animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.setAttribute("data-theme-transition", "");
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => root.removeAttribute("data-theme-transition"), 260);
  }
  if (root.dataset.theme !== resolved) root.dataset.theme = resolved;
  if (preference === current.preference && resolved === current.resolved) return;
  current = { preference, resolved };
  listeners.forEach(listener => listener());
}

function setPreference(preference: ThemePreference) {
  apply(preference, true);
  try { localStorage.setItem(themeStorageKey, preference); } catch { /* Keep the in-memory choice. */ }
}

export function useTheme() {
  const state = useSyncExternalStore(subscribe, () => current, () => initial);
  return { ...state, setPreference };
}

// Renderers subscribe directly so a palette update can paint an idle canvas without a React render.
export function watchResolvedTheme(update: (theme: ResolvedTheme) => void) {
  let previous: ResolvedTheme | undefined;
  const sync = () => {
    const attribute = document.documentElement.dataset.theme;
    const resolved = attribute === "dark" || attribute === "light"
      ? attribute : resolveTheme("system", matchMedia(systemThemeQuery).matches);
    if (resolved !== previous) {
      previous = resolved;
      update(resolved);
    }
  };
  sync();
  return subscribe(sync);
}

export function ThemeProvider() {
  useEffect(() => {
    media = matchMedia(systemThemeQuery);
    function load() {
      try { apply(parseTheme(localStorage.getItem(themeStorageKey))); }
      catch { apply(current.preference); }
    }
    function systemChanged() {
      if (current.preference === "system") apply("system", true);
    }
    function storageChanged(event: StorageEvent) {
      if (event.key === themeStorageKey || event.key === null) load();
    }
    load();
    media.addEventListener("change", systemChanged);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("pageshow", load);
    return () => {
      media?.removeEventListener("change", systemChanged);
      media = undefined;
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("pageshow", load);
      window.clearTimeout(transitionTimer);
      document.documentElement.removeAttribute("data-theme-transition");
    };
  }, []);
  return null;
}
