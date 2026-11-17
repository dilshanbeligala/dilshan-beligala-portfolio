# Digital identity — hold to reveal

## Checkpoint and scope

Git commit `b64169f` preserves the complete working V2 implementation before this refinement. V3 changes remain uncommitted for review. Navigation, identity text, CTAs, metadata, and other portfolio sections are unchanged. Portrait-local annotations and sizing were adjusted to keep the interaction instructions visible inside the hero.

No dependencies or models were installed. The original portrait and all processing remain local. The existing Next.js 16.4.6 / React 19.3.0 / Fiber 9.8.2 / Three.js 0.187.0 stack is retained.

## Visual states and alignment

The default shader has no natural skin colors. It combines cyan/white feature-aware particles, a low-opacity normal-shaded navy relief, quantized structural luminance, image-gradient features, faint violet rim accents, precision landmark contours, source-derived hair/facial-hair strands, and a restrained scan. Original RGB is used only for the real reveal. The digital base never renders the V2 photographic skin material.

The real face is the original masked photograph sampled on the exact same 7,128-vertex relief and UV mapping. One shader blends its digital and real materials. No second 3D scene or billboard is rendered. Both states keep the same position, crop, head transform, and shared subtle breathing. The existing ±5° yaw / ±3° pitch tracking remains depth-aligned; touch-only devices do not track pointer motion.

15,641 existing deterministic feature samples and their sizes are preserved. Nose contours and source-gradient hair/mustache strands extend the precision line geometry to 1,176 vertices. These are drawn in one line call; no heavy wireframe is added.

Static mode uses two identically framed, alpha-masked local assets:

- `public/hologram/portrait-digital-v3.webp`: digital particles, structural shading and contours.
- `public/hologram/portrait-real-v3.webp`: original natural portrait, without its background.

Both are generated from the same coordinate mapping and mask as the GPU data. Their versioned paths avoid stale optimized image caches. Mobile, reduced-motion, save-data and WebGL-failure modes retain the interaction. Without JavaScript, the digital image remains visible and the unavailable controls are disabled.

## Controller and input

`use-portrait-reveal.ts` owns one continuous MotionValue from 0 to 1. The GPU reads it into uniforms; static layers use it directly for opacity. React state changes only for input/intent, not each frame. Reveal takes approximately 400 ms, reconstruction 550 ms; interrupted animations start from their current value and scale duration to the remaining distance.

The face is a semantic button with visible keyboard focus and descriptive instructions. It captures the primary pointer on press. Pointer up, cancellation, lost capture, window blur, page hiding and control blur restore digital mode. A window-level release listener covers missed target releases. Late capture-loss events cannot clear a newer input. The latest pointer or keyboard initiation owns the hold.

Enter/Space keydown starts reveal, keyup restores it, and repeat events do not restart animation. A separate `aria-pressed` toggle provides reveal without maintaining a hold. Intentional toggle mode persists within the portrait until toggled off or superseded by a hold; leaving the portrait focus, window blur or page hiding restores digital mode. Focus transfer from the toggle to the hold control does not cancel the new hold.

Touch uses the same Pointer Events. `touch-action: pan-y pinch-zoom` preserves vertical scrolling and zoom; a scrolling cancellation restores digital mode. Image dragging, selection and the portrait context menu are disabled only within the interaction. The native cursor is preserved.

Reduced-motion preference is subscribed live with `useSyncExternalStore`. It uses immediate transitions and a fully assembled static portrait. Document hiding immediately clears the reveal value so returning to the tab cannot expose a stuck real portrait. Offscreen/hidden-tab GPU pausing, adaptive quality, fetch cancellation, texture/bitmap closure and resource disposal are retained.

## Files

- `src/components/hologram/use-portrait-reveal.ts`: reusable input and animation controller.
- `src/components/hologram/holographic-portrait.tsx`: aligned static layers, semantic hold button, toggle, labels and accessibility.
- `src/components/hologram/hologram-scene.tsx`: shared reveal uniforms and contour dissolution.
- `src/lib/hologram/shaders.ts`: digital material, original-photo reveal, particle softening and reconstruction.
- `src/lib/hologram/config.ts`: new static asset URLs.
- `src/app/globals.css`: portrait-only controls, focus/hover states and responsive instruction placement.
- `tools/hologram/generate.py`: aligned static states and precise local contours.
- `public/hologram/facial-contours.bin`, `manifest.json`, and the two V3 images: generated data. The obsolete V2 fallback is removed; it remains recoverable in the checkpoint.
- `tools/hologram/hold-check.mjs`: local Chrome native-input regression checks and paired screenshots.
- Documentation: this file, `README.md`, and `IMPLEMENTATION.md`.

## Validation

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Native Chrome checks run with `node tools/hologram/hold-check.mjs` against local production port 3001 and the installed Chrome's local DevTools port 9223. No browser package is required. The suite tests actual mouse and touch inputs, keyboard holds, repeat handling, focus transfer, rapid reversal, lost pointer capture, cancellation, visibility reset, reduced motion and no-WebGL interaction.

Paired screenshots and results are saved in ignored `tools/hologram/private/hold/`. The suite also compares the actual model-view matrices between held and digital states, checks instruction visibility, and records page exceptions and external HTTP requests. Synthetic cancellation/visibility events exercise those exact handlers; these do not substitute for physical-device OS interruption testing.

## Limits

The source remains 400 × 400, with the face occupying only part of it. The relief is approximate front-facing 2.5D; hair/ear/neck depth is extrapolated. No missing detail is hallucinated or enhanced, and the result is not a full 3D identity scan. Real-phone Safari/Android interruptions, assistive technology and sustained thermal/battery use still require manual testing. No Lighthouse or real-device performance score is claimed.

## Recorded results

- Lint, TypeScript, production build and whitespace checks passed.
- Native pointer hold/release, rapid reversal, pointer cancel, actual lost capture, keyboard Enter/Space and repeat handling, control/window blur, visibility reset, toggle behavior and toggle-to-hold handoff passed.
- Native touch hold/release/cancel, live reduced-motion changes, and hold/release without WebGL passed.
- Measured maximum model-view difference between digital and held states: less than 0.000005.
- Responsive checks at 320/375/390/768/1440px, navigation anchors, mobile menu Escape/focus restoration, JavaScript-disabled digital fallback, context loss and offscreen pause passed.
- GPU draws during the offscreen sample: zero. Browser page exceptions/errors and external HTTP requests: zero.
- A local 90-frame scheduling sample averaged approximately 16.67 ms (p95 16.7 ms). This is requestAnimationFrame timing on this machine, not GPU timing or a real-device guarantee.
- Desktop and mobile state screenshots were visually inspected. `private/hold/desktop-states.jpg` pairs matching crops of the actual desktop WebGL renders; original screenshots and JSON reports remain alongside it.
