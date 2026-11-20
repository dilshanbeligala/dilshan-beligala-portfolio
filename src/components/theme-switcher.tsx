"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { themePreferences } from "@/lib/theme";

const options = {
  light: { label: "Light", Icon: Sun },
  dark: { label: "Dark", Icon: Moon },
  system: { label: "System", Icon: Monitor },
};

export function ThemeSwitcher({ placement }: { placement: "desktop" | "mobile" }) {
  const { preference, setPreference } = useTheme();
  const name = `appearance-${placement}`;
  return <fieldset className={`theme-switcher theme-switcher-${placement}`}>
    <legend className="sr-only">Appearance</legend>
    {themePreferences.map(value => {
      const { Icon, label } = options[value];
      return <label key={value} title={label}>
        <input className="sr-only" type="radio" name={name} value={value}
          checked={preference === value} onChange={() => setPreference(value)} />
        <span><Icon size={16} aria-hidden="true" /><span className={placement === "desktop" ? "sr-only" : undefined}>{label}</span></span>
      </label>;
    })}
  </fieldset>;
}
