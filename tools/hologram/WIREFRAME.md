# Reference-style turquoise wireframe

The previous hold-to-reveal experience is checkpointed at `8638c7e`. This refinement preserves the original portrait, hairstyle, shallow relief, real reveal material, shared UV mapping, input controller, navigation and content.

The supplied reference's visual language is applied to the user's own face: a fine luminous turquoise triangular network, stronger anatomical contours, dark eye apertures, smooth iris rings, and a clear silhouette. The reference head itself is not substituted for the portrait.

## Geometry and rendering

- A deterministic Delaunay network connects the actual detected facial landmarks and 1,800 spatially distributed source-face samples. Edges crossing the silhouette or exceeding eight source pixels are excluded. The resulting 6,479 line segments follow the same depth map as the real reveal.
- Per-vertex wire strength uses source luminance, feature weights and distance to the actual silhouette. Eye interiors are intentionally quiet so eyelids and iris rings remain distinct. Neck strength fades rather than ending in a bright block.
- Smooth iris rings are fitted to the detected iris landmark axes. The external silhouette is taken from the local segmentation mask and lightly smoothed. Nose, lip, brow, jaw, hair and facial-hair contours remain portrait-specific.
- The surface is darker and less opaque; fine points are smaller and quieter. The wire network and bright mint/cyan feature contours carry the likeness. Natural skin colors appear only while revealing the real portrait.
- One additional GPU line draw call renders all 12,958 network vertices. There are five scene draw calls, no added postprocessing, no new dependencies, and no new AI models. GPU geometry is allocated once and disposed on unmount.
- Network and contour layers fade with the same reveal value as the existing materials. Model position, crop and rotation do not change between digital and real states.

## Assets and files

- `public/hologram/facial-wire.bin`: header `DBHW`, uint32 version 1, vertex count, stride 16; records contain little-endian float32 XYZ and strength. The decoder validates dimensions, finite coordinates and strength range.
- `public/hologram/portrait-wireframe-<content-hash>.webp`: locally generated, lossless static counterpart with fine lines and restrained contour glow. Next Image serves responsive sizes. The manifest supplies a content-hashed filename so regenerated images cannot reuse stale optimizer output. The old V3 digital fallback is removed and remains in the checkpoint.
- `facial-contours.bin`, `facial-particles.bin`, `facial-detail.bin`, and `manifest.json`: regenerated to include the detected iris features and additional contour data. The real fallback and original portrait are unchanged.
- `src/lib/hologram/geometry.ts`: validated wire buffer and GPU geometry.
- `src/lib/hologram/shaders.ts`: wire shader, darker surface and turquoise points.
- `src/components/hologram/hologram-scene.tsx`: single network layer, reveal opacity and cleanup.
- `src/lib/hologram/config.ts`: smaller point sizes, updated point budget and versioned wireframe fallback.
- `tools/hologram/generate.py`: reproducible local network, iris/silhouette curves and static counterpart.

The original source/model checksums are verified before asset generation. No portrait or face data is uploaded.

## Verification and limitations

Lint, TypeScript, production build, wire decoder/corrupt-buffer/GPU attribute checks, and whitespace checks pass. Local Chrome input and responsive regression reports are stored in ignored `private/hold/report.json` and `private/browser/report.json`. Screenshots of both states are captured at matching desktop/mobile viewports and inspected visually.

This is the reference's rendering style adapted to the supplied 400 × 400 portrait. It remains a front-facing approximate 2.5D relief; hidden surfaces and accurate hair volume cannot be reconstructed from the single photo. No exact 360° or photorealistic geometry claim is made. Real-device Safari/Android, assistive technology, and sustained battery/thermal performance remain manual checks.

Fine anatomical contours render as a controlled overlay so approximate relief depth cannot hide eyelids or the nose. Structural mesh lines still depth-test against the relief. The eye interiors remain dark, and the artificial lower neck-cap contour is excluded.

Final local validation: hold/release, rapid reversal, keyboard, touch, cancellation, toggle, reduced motion, and no-WebGL reveal passed. Responsive/navigation checks at 320–1440px passed with no horizontal overflow. WebGL error code, offscreen draw count, browser page errors, and external page requests were all zero. The 90-frame local scheduling sample averaged 16.67 ms (p95 16.8 ms), without implying a real-device performance guarantee. Final actual-render previews are in `private/hold/wireframe-preview.png` and `private/hold/wireframe-states.jpg`.
