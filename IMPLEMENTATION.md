# The Intelligence Interface

The home page uses server-rendered content with focused client components for the header, magnetic links, and a portrait-specific GPU particle hologram. Existing Motion and Lucide packages are reused; Three.js and React Three Fiber are lazy-loaded for the portrait.

## Files

- `src/app/page.tsx`: hero content and real section destinations.
- `src/app/globals.css`: design tokens, responsive composition, animations, focus styles, reduced motion, and scroll depth progressive enhancement.
- `src/app/layout.tsx`: portfolio title and description; existing self-hosted Geist font setup retained.
- `src/components/site-header.tsx`: scroll-aware navigation and native modal mobile menu with focus restoration, body scroll lock, Escape handling, and a no-JavaScript navigation fallback.
- `src/components/hero-stage.tsx`: hero pointer target, sparse background particles, pointer aura, and the integrated holographic portrait.
- `src/components/magnetic-link.tsx`: restrained pointer attraction on desktop, disabled for reduced motion.
- `src/lib/portfolio.ts`: navigation and verified LinkedIn URL. Email, GitHub, and resume are explicitly unset configuration fields.

## Content

No project names, employers, employment dates, email addresses, domains, or resume assets have been invented. The Experience destination explains the engineering approach; Projects invites a conversation. Add verified career history and case studies before using this as a full career portfolio.

## Verification

Passed `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. The production server returned HTTP 200; HTML checks confirmed the title, a single h1, and valid destinations for all fragment links. The existing `next/font/google` setup requires Google Fonts access during a clean build, then serves fonts locally to visitors.

Chrome DevTools browser checks and screenshots covered 320, 375, 390, 768, and 1440 pixel layouts, pointer movement, reduced motion, unavailable WebGL, context loss, JavaScript disabled, offscreen drawing pause, and mobile menu Escape/focus restoration. No horizontal overflow, normal-operation console errors, or external page requests were observed. Lighthouse was not measured. Additional manual checks:

- Safari and real iPhone/Android portrait rendering, pointer behavior, and sustained GPU/battery use.
- Mobile menu keyboard focus trap, Escape, focus restoration, selection close, and scroll lock.
- Reduced-motion preference, touch interactions, screen-reader navigation, and JavaScript disabled.
- Safari and Android browser rendering; CSS scroll depth is progressive enhancement and falls back to a static position.

## Personalized hologram

See [tools/hologram/README.md](tools/hologram/README.md) for the complete local asset pipeline, package/model sources and licenses, binary formats, quality presets, model checksum, validation steps, and the MediaPipe wheel metadata caveat. The original sphere is removed. The V2 hybrid uses 15,641 feature-aware samples and a depth-aligned original-photo detail layer; it uses the supplied portrait and locally inferred landmark depth; it is approximate 2.5D, not a full 3D identity reconstruction. Navigation, typography, page content, CTAs, and SEO metadata are preserved.

V2 refinement details and comparison methodology: [tools/hologram/V2.md](tools/hologram/V2.md). The working V1 portfolio is checkpointed at `e3c0102`. V2 does not modify navigation, typography, CTAs, metadata, or other section content.

## Digital identity interaction

The default is now a digital cyan/white particle sculpture with structural shading and precision contours. Holding reveals the original portrait on the same relief; release reconstructs the hologram. Static/mobile modes use aligned digital and real images with the same controller. Pointer, touch, keyboard, cancellation, focus/visibility reset, and a toggle alternative are documented in [tools/hologram/HOLD_REVEAL.md](tools/hologram/HOLD_REVEAL.md). V2 is checkpointed at `b64169f`.
