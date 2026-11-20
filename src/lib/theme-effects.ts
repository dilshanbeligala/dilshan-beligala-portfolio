import type { ResolvedTheme } from "./theme";

export const effectPalettes = {
  dark: {
    field: {
      cyan: "#49e5ff", violet: "#ae91ff", mixed: "#9cb5ff", signal: "#dcf9ff",
      idle: ["#8c83b2", "#78a5bd", "#bfd0dd"],
    },
    code: {
      keyword: "#b99bff", function: "#49e5ff", type: "#d9f7ff",
      string: "#a2a7ff", symbol: "#829cb6", variable: "#8bc9ea",
    },
    codeOpacity: 1,
  },
  light: {
    field: {
      cyan: "#086a86", violet: "#6543ac", mixed: "#47619c", signal: "#13558c",
      idle: ["#7d6b9d", "#557a92", "#6b849b"],
    },
    code: {
      keyword: "#584093", function: "#08657d", type: "#16456a",
      string: "#4e4c8b", symbol: "#526c88", variable: "#275c81",
    },
    codeOpacity: .81,
  },
} as const satisfies Record<ResolvedTheme, {
  field: Record<"cyan" | "violet" | "mixed" | "signal", string> & { idle: readonly [string, string, string] };
  code: Record<"keyword" | "function" | "type" | "string" | "symbol" | "variable", string>;
  codeOpacity: number;
}>;

export type FieldPalette = (typeof effectPalettes)[ResolvedTheme]["field"];
export type CodePalette = (typeof effectPalettes)[ResolvedTheme]["code"];
