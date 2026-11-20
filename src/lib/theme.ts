export const themePreferences = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const themeStorageKey = "portfolio-theme";
export const systemThemeQuery = "(prefers-color-scheme: dark)";

export function parseTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === "system" ? systemDark ? "dark" : "light" : preference;
}

// Synchronous and independent of the client bundle. The server emits no guessed preference.
export const initializeTheme = `(()=>{let p;try{p=localStorage.getItem(${JSON.stringify(themeStorageKey)})}catch{}if(p!=="light"&&p!=="dark")p="system";document.documentElement.dataset.theme=p==="system"?(matchMedia(${JSON.stringify(systemThemeQuery)}).matches?"dark":"light"):p})()`;
