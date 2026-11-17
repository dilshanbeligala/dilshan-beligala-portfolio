# Local portrait reconstruction

This is an offline asset-generation tool. It never sends the portrait, landmark arrays, or geometry to an external inference service. Python, model weights, and reconstruction libraries are not part of the website runtime. Runtime requests use local site assets only.

## Verified environment and dependencies

- macOS 27.2.1, Apple Silicon arm64; Python 3.9.6.
- Isolated `.venv-hologram` at the project root; system Python is unchanged.
- `requirements.txt` pins the direct packages. `requirements.lock.txt` records all installed dependencies.
- MediaPipe 0.10.21: Google, Apache-2.0. Its official PyPI universal2 wheel is approximately 49 MB.
- NumPy 1.26.4 (BSD-3-Clause, approximately 14 MB), SciPy 1.13.1 (BSD-3-Clause, approximately 30 MB), Pillow 11.3.0 (MIT-CMU, approximately 5 MB), OpenCV-contrib 4.11.0.86 (Apache-2.0, approximately 46 MB).
- MediaPipe's declared dependencies include JAX/JAXlib, Matplotlib, protobuf, and supporting libraries. JAXlib is approximately 67 MB. No additional depth-estimation model was downloaded.
- Runtime: Three.js 0.187.0, React Three Fiber 9.8.2, plus development types `@types/three` 0.187.0, all MIT. Fiber 9.8.2 declares React `>=19 <19.4`, matching the existing React 19.3.0. Drei is unnecessary.

### Upstream wheel packaging limitation

The MediaPipe PyPI file is advertised as macOS universal2 and contains an actual universal x86_64/arm64 `_framework_bindings` binary (verified with `file`). Its internal WHEEL metadata incorrectly tags x86_64 only. Consequently `pip check` reports `mediapipe 0.10.21 is not supported on this platform`. No package metadata was modified or compatibility check bypassed. The model successfully ran on ARM64 and produced the checked-in assets. The warning is confined to offline tooling and does not affect the production website.

### Model provenance

Google Face Landmarker, float16, version 1:

https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

3,758,596 bytes; SHA-256:

`64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

The generator verifies the checksum before inference. The model is ignored by Git and kept outside `public/`.

Official documentation and Apache-2.0 model cards:

- https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker
- https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf
- https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20%28Short%20Range%29.pdf
- https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf
- https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE

## Reproduce

From the project root, after downloading the model to `tools/hologram/models/face_landmarker.task`:

```sh
python3 -m venv .venv-hologram
.venv-hologram/bin/python -m pip install pip==25.3
.venv-hologram/bin/python -m pip install --no-cache-dir -r tools/hologram/requirements.lock.txt
MPLCONFIGDIR="$PWD/.cache/matplotlib" XDG_CACHE_HOME="$PWD/.cache" .venv-hologram/bin/python tools/hologram/generate.py
```

MediaPipe on macOS needs a graphics context for image preprocessing even with CPU inference selected. A restrictive process sandbox may prevent initialization. Processing remains entirely local when run with that permission.

## Geometry and likeness

The generator uses the actual `public/images/dilshan-portrait.jpg` (400 × 400). Its SHA-256 is checked because the hand-traced hair/ear/neck silhouette is specific to this photograph. If the source changes, inspect and trace the new silhouette rather than reusing it silently.

MediaPipe detects 478 landmarks. The first 468 establish a source-specific facial surface. A Delaunay triangulation and linear depth interpolation generate the shallow facial relief; a small Gaussian smoothing kernel reduces interpolation artifacts. The hair outline is traced from the photograph and its depth, ears, and neck are conservatively extrapolated from nearby facial landmarks. Source luminance and local contrast preserve eyes, facial hair, skin shading, and hairstyle in the particles. No generic head model is used.

Outputs:

- `public/hologram/facial-surface.glb`: 468 vertices, 898 triangles, reusable approximate face surface. Not loaded by the website.
- `facial-particles.bin`: 24,000 randomized, source-weighted samples. A 16-byte header (`DBHP`, uint32 version/count/stride), then 20 bytes per point: float32 XYZ, RGB bytes, size byte, float32 seed, all multi-byte numbers little-endian. Decoder validates dimensions and values.
- `facial-contours.bin`: float32 XYZ pairs for selected facial feature contours.
- `portrait-fallback.webp`: locally rendered from the same particle data, not an AI-generated replacement face.
- `manifest.json`: source/model/asset hashes, counts, byte sizes, and limitations.

Local review images and intermediate landmarks are in ignored `tools/hologram/private/`, outside the served assets. No recognition embeddings, blendshape coefficients, or identity classifiers are produced.

## Rendering

The hero keeps server-rendered text and the static portrait visible immediately. Three/Fiber is dynamically loaded on eligible screens. The GPU uses one face `Points` draw call, one faint contour draw call, and one ambient draw call; no bloom or postprocessing is used.

Presets: high 24,000 points / DPR 1.5; medium 16,000 / DPR 1.25; low 5,000 / DPR 1. Initial desktop quality is medium, large displays high, touch tablets low. Mobile at 700px or narrower and reduced motion use the static image and do not load the scene. Quality steps down after sustained slow frames; these are starting budgets, not guaranteed performance targets. No hardware fingerprinting is used.

Pointer tracking is limited to ±5° yaw / ±3° pitch with delta-based damping. Pointer exit returns to neutral. Shader displacement remains bounded at a fraction of one source pixel. The main assembly takes about 2.1 seconds, followed by a slow, narrow scanning band and subtle shimmer. Offscreen/hidden-tab rendering stops, and time resumes without a large jump. Context loss, invalid assets, capability failure, shader errors, component failure, and a 12-second loading timeout retain or restore the static portrait. Geometry, listeners, capability contexts, and fetches are cleaned up.

## Limitations

This is approximate, primarily front-facing 2.5D, not an accurate 360° head reconstruction. Landmark Z is inferred, not measured. Hair volume and hidden surfaces cannot be recovered reliably from the single 400px photograph. Existing lighting remains baked into source-derived point intensity. Conservative rotation avoids exposing missing back/side geometry. Safari, real iPhone/Android devices, and sustained battery/GPU performance need manual testing; no Lighthouse score is claimed.

## Browser checks

`browser-check.mjs` uses the installed Chrome through its local DevTools protocol. It needs no npm browser dependency. Launch Chrome in headless mode with port 9223, an isolated project-local profile, background networking disabled, and serve the production website on localhost:3001. Then run:

```sh
node tools/hologram/browser-check.mjs
```

Screenshots and JSON results are written to ignored `private/browser/`. The script simulates reduced motion, context loss, unavailable WebGL, pointer positions, viewport changes, and mobile navigation. It checks that the page makes no external HTTP requests.

## Validation results

- `npm run lint`: passed without warnings.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; home page statically prerendered.
- `git diff --check`: passed.
- Portrait decoder checks: 24,000 samples, nonzero depth, correct GPU attribute count, rejection of malformed/truncated assets, and disposal passed.
- Local Chrome production checks: 1440px WebGL rendering, pointer-position screenshots, reduced motion, context loss, unavailable WebGL, JavaScript disabled, 320/375/390/768px responsive layouts, valid anchors, and mobile menu Escape/focus restoration passed.
- WebGL error code: 0. Draw calls while offscreen over the sampled interval: 0. Browser console errors: 0. External HTTP requests from the page: 0.
- The tablet test exercised the static fallback after the simulated context failure; hardware tablet GPU performance is not inferred from this result.
- Screenshots were inspected locally. These checks do not establish Lighthouse scores or real-device frame-rate/battery guarantees.
