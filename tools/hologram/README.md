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

## V2 reconstruction, formats, and renderer

The current implementation is Digital Identity / Hold to Reveal. Read [HOLD_REVEAL.md](HOLD_REVEAL.md) for its state materials, controller, input behavior, alignment, assets, and validation. Read [V2.md](V2.md) for the audit, interpolation and sampling methods, depth-aligned photographic layer, binary formats, quality policy, diagnostics, measurements, checkpoint, and limitations. The original V1 implementation is recoverable at Git commit `e3c0102`.

The generator verifies both the original portrait and model hashes, runs locally, and writes optimized assets to `public/hologram/`. Source-derived diagnostics and intermediate landmarks remain in ignored `tools/hologram/private/`, outside the served assets. No recognition embeddings or facial classifiers are produced.

## Browser checks

`browser-check.mjs` uses the installed Chrome through its local DevTools protocol. It needs no npm browser dependency. Launch Chrome in headless mode with port 9223, an isolated project-local profile, background networking disabled, and serve the production website on localhost:3001. Then run:

```sh
node tools/hologram/browser-check.mjs
```

Screenshots and JSON results are written to ignored `private/browser/`. The script simulates reduced motion, context loss, unavailable WebGL, pointer positions, viewport changes, and mobile navigation. It checks that the page makes no external HTTP requests.

## Validation results

See [HOLD_REVEAL.md](HOLD_REVEAL.md), `private/hold/report.json`, and the general regression report at `private/browser/report.json`. Browser screenshots are inspected at identical viewport sizes before claiming a visual improvement. The previously documented MediaPipe wheel metadata warning remains confined to offline tooling; the verified ARM64 binary successfully generates the assets.
