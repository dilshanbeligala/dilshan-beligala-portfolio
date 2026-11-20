# Portfolio themes

The appearance control offers **Light**, **Dark**, and **System** on desktop and in the mobile navigation. The browser saves the choice under `portfolio-theme`. System is the default and follows the browser's `prefers-color-scheme` preference. An explicit choice takes precedence. If storage is unavailable, the choice works in the current document. Other tabs synchronize through the storage event.

## Initial paint and state

The root layout executes the small bootstrap from `src/lib/theme.ts` in the document head. It resolves the saved choice before the browser paints the page and sets `data-theme` on `<html>`. CSS also follows the system color scheme when the attribute is absent, including with JavaScript disabled. Hydration suppression is scoped to the HTML element, whose attribute the bootstrap owns before React loads.

`ThemeProvider` attaches the operating-system and storage listeners once. The external store distinguishes `ThemePreference` from `ResolvedTheme`. Client controls can read them through `useTheme()` and change the choice with `setPreference()`. Components that only need colors can stay server-rendered and use CSS variables. Theme transitions are scoped to selected surfaces and run only on updates with motion enabled.

## Tokens

Add a semantic CSS token to `src/app/theme.css` with both palette values adjacent. CSS `light-dark()` lists the light value first and the dark value second. The browser selects the value using the root color scheme.

| Purpose | Main tokens | Light | Dark |
| --- | --- | --- | --- |
| Page | `--background`, `--foreground` | `#f6f8fc`, `#142235` | `#05060b`, `#f4f7ff` |
| Surfaces | `--surface`, `--surface-glass`, `--surface-panel` | White, blue-gray glass | Deep navy, translucent blue |
| Supporting type | `--text-support`, `--muted`, `--foreground-subtle` | Slate blue | Cool blue-gray |
| Accents | `--accent`, `--accent-secondary`, `--foreground-accent` | Teal and violet | Cyan and violet |
| Interaction | `--primary`, `--primary-ink`, `--border-control`, `--focus-ring` | Teal with white text | Pale cyan with navy text |
| Statistics | `--stat-accent`, `--stat-label` | Olive and slate | Lime and cool white |
| Effects | `--cursor-stroke`, `--cursor-halo`, `--code-teal`, `--code-violet`, `--glitch-violet` | Navy cursor, muted glow | White cursor, cool highlights |

Older CSS can continue to use `--cyan`, `--violet`, and `--line`. They alias `--accent`, `--accent-secondary`, and `--border`. The Tailwind v4 `@theme inline` block in `globals.css` exposes utilities such as `bg-background`, `bg-surface`, `text-foreground`, `text-muted`, `text-accent`, `border-border`, and `ring-focus`.

```tsx
<section className="rounded-lg border border-border bg-surface p-6 text-foreground">
  <h2>Engineering notes</h2>
  <p className="text-muted">Notes about the project.</p>
</section>
```

## Canvas and WebGL

Imperative renderers subscribe to `watchResolvedTheme()` and release the subscription on cleanup. The magnetic field looks up each node and edge's color role in `theme-effects.ts` and schedules a redraw without replacing physics state. Falling code caches a glyph atlas per palette and keeps its elapsed time and reveal progress when swapping atlases. The portrait shaders use a theme uniform on the existing materials. The digital fallback is tinted by CSS, and the realistic photo uses its source colors.

Use this same subscription for new renderers. Keep geometry, time accumulators, and interaction state independent of palettes. For new DOM components, prefer tokens and reserve `useTheme()` for behavior that actually needs the preference. Give meaningful text 4.5:1 contrast, large text and meaningful non-text states 3:1, visible keyboard focus, and a reduced-motion path.

## Verification

Run lint, TypeScript, and a production build.

```sh
npm run lint
npm run build
npx tsc --noEmit
npm run start -- --port 3021
```

Open Chrome with an isolated user-data directory and `--remote-debugging-port=9223`. Run the browser check with Node 24. Give it an output directory to capture the homepage sections, navigation, and About route for both palettes at 1440, 768, and 390 CSS pixels.

```sh
PORTFOLIO_URL=http://localhost:3021 \
PORTFOLIO_THEME_SCREENSHOTS=/tmp/portfolio-theme-screens \
node tools/theme/browser-check.mjs
```

The browser script checks the saved preference before framework code runs, storage errors, automatic System updates, explicit choices, browser history, keyboard selection, sampled contrast, reduced motion, and renderer reuse. Review screenshots for gradients and artwork that text contrast checks cannot evaluate. Scroll-driven effects were previously removed from this portfolio. The current project uses archive links and a LinkedIn contact action.
