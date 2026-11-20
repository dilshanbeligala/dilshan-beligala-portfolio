import { motion, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, type RefObject } from "react";
import { watchResolvedTheme } from "../theme-provider";
import { effectPalettes, type CodePalette } from "@/lib/theme-effects";
import type { ResolvedTheme } from "@/lib/theme";
import type { PointerTarget } from "@/lib/hologram/config";

const snippets = [
  "const signal = await compose();",
  "interface Agent {",
  "  model: Model;",
  "  state: State;",
  "}",
  "return pipeline.run();",
  "async function build() {",
  "  await agent.execute();",
  "}",
  "Widget build(BuildContext context)",
  "final state = ref.watch(provider);",
  "Future<void> initialize() async",
  "class Experience extends Widget",
  "model = load_model()",
  "vector = encoder.encode(text)",
  "agent.plan(context)",
  "pipeline.validate()",
  "repository.getData()",
  'config = { "mode": "digital" }',
  "layers.map(render);",
  "type Signal = Float32Array;",
  "const step = (x) => x + 1;",
  "await service.initialize()",
  "<Experience />",
  'route = "/inference"',
  "return JSON.parse(data);",
];

const shortSnippets = [
  "const signal", "await compose()", "interface Agent", "model: Model",
  "return pipeline", "async function", "Widget build()", "final state",
  "Future<void>", "agent.execute()", "encoder.encode()", "model = load()",
  "pipeline.run()", "type Signal", 'mode: "digital"', "<Experience />",
  "=> state", "JSON.parse()", "route = '/ai'", "01 · 10",
];

const keyword = /^(?:async|await|class|const|extends|final|function|interface|return|type|void)$/;
const tokens = /"[^"]*"|'[^']*'|[A-Za-z_][\w]*|\d+|[^\s\w]|\s+/g;
type Glyph = { x: number; color: string; points: { x: number; y: number }[] };
const cell = 10;
const rowHeight = 22;
const atlasScale = 2;
const modulo = (number: number, length: number) => ((number % length) + length) % length;
const unit = (value: number) => Math.max(0, Math.min(1, value));

function buildAtlas(colors: CodePalette) {
  const lines = [...snippets, ...shortSnippets];
  const atlas = document.createElement("canvas");
  atlas.width = (Math.max(...lines.map(line => line.length)) * cell + 4) * atlasScale;
  atlas.height = lines.length * rowHeight * atlasScale;
  const ctx = atlas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(atlasScale, atlasScale);
  ctx.font = "500 16px ui-monospace, Menlo, monospace";
  ctx.textBaseline = "top";

  const rows = lines.map((line, row) => {
    const glyphs: Glyph[] = [];
    for (const match of line.matchAll(tokens)) {
      const token = match[0];
      if (!token.trim()) continue;
      const start = match.index;
      const shade = keyword.test(token) ? colors.keyword
        : /^["']/.test(token) ? colors.string
        : /^[A-Z]/.test(token) ? colors.type
        : /^\w/.test(token) ? (line[start + token.length] === "(" ? colors.function : colors.variable)
        : colors.symbol;
      ctx.fillStyle = shade;
      for (let index = 0; index < token.length; index++) {
        const x = (start + index) * cell;
        ctx.fillText(token[index], x, row * rowHeight + 3, cell);
        if (token[index] !== " ") glyphs.push({ x, color: shade, points: [] });
      }
    }
    return { width: line.length * cell + 2, glyphs };
  });

  // Sample points from the actual ink so the particles emerge from the glyphs.
  const { data } = ctx.getImageData(0, 0, atlas.width, atlas.height);
  for (const [row, { glyphs }] of rows.entries()) {
    for (const glyph of glyphs) {
      for (let stripe = 0; stripe < 3; stripe++) {
        const yStart = stripe * 5 + 3;
        for (let attempt = 0; attempt < 50; attempt++) {
          const x = (attempt * 7 + stripe * 3) % cell;
          const y = yStart + attempt % 5;
          const offset = ((row * rowHeight + y) * atlasScale * atlas.width + (glyph.x + x) * atlasScale) * 4;
          if (data[offset + 3] < 100) continue;
          glyph.points.push({ x, y });
          break;
        }
      }
    }
  }
  return { image: atlas, rows };
}

const layers = [
  { font: 11, speed: 17, opacity: .40, parallax: 4, gap: 23 },
  { font: 13, speed: 28, opacity: .79, parallax: 8, gap: 30 },
  { font: 15, speed: 42, opacity: .96, parallax: 14, gap: 39 },
];

type Stream = {
  anchor: number;
  layer: number;
  seed: number;
  length: number;
  band: [number, number];
  right?: boolean;
  short?: boolean;
};
// Separate vertical bands retain readable baselines as the layers fall at different speeds.
const desktop: Stream[] = [
  { anchor: .09, layer: 0, seed: 18, length: 7, band: [.02, .30] },
  { anchor: .92, layer: 0, seed: 13, length: 8, band: [.72, .99], right: true },
  { anchor: .045, layer: 1, seed: 2, length: 9, band: [.30, .66] },
  { anchor: .96, layer: 1, seed: 6, length: 8, band: [.35, .72], right: true },
  { anchor: .09, layer: 2, seed: 3, length: 7, band: [.66, .98], short: true },
  { anchor: .95, layer: 2, seed: 9, length: 7, band: [.04, .35], right: true, short: true },
];
const compact: Stream[] = [
  { anchor: .055, layer: 0, seed: 12, length: 5, band: [.60, .99] },
  { anchor: .035, layer: 1, seed: 2, length: 7, band: [.03, .60] },
  { anchor: .97, layer: 1, seed: 6, length: 7, band: [.04, .54], right: true },
  { anchor: .96, layer: 2, seed: 11, length: 6, band: [.54, .98], right: true },
];

type Atlas = NonNullable<ReturnType<typeof buildAtlas>>;

function drawRow(
  ctx: CanvasRenderingContext2D, atlas: Atlas, index: number,
  x: number, y: number, scale: number, opacity: number, reveal: number,
  stream: Stream, short: boolean, highlight: string,
) {
  const row = atlas.rows[index];
  const sourceY = index * rowHeight * atlasScale;
  const height = rowHeight * scale;
  if (reveal < .025) {
    ctx.globalAlpha = opacity;
    ctx.drawImage(atlas.image, 0, sourceY, row.width * atlasScale, rowHeight * atlasScale,
      x, y, row.width * scale, height);
    return;
  }

  for (const glyph of row.glyphs) {
    const seed = modulo(glyph.x * 19 + index * 47 + stream.seed * 53, 101) / 100;
    const split = unit((reveal - .09 - seed * .36) / .33);
    const shimmer = Math.sin(Math.PI * unit(reveal / .33)) * (.08 + stream.layer * .09);
    const glyphX = x + glyph.x * scale;
    if (split < 1) {
      ctx.globalAlpha = unit(opacity * (1 + shimmer) * (1 - split));
      ctx.drawImage(atlas.image, glyph.x * atlasScale, sourceY, cell * atlasScale, rowHeight * atlasScale,
        glyphX, y, cell * scale, height);
    }
    const sparks = Math.sin(Math.PI * unit((split + reveal) / 2.15)) * unit((reveal - .06) * 9) * unit((.96 - reveal) * 6);
    if (sparks < .03) continue;

    ctx.globalAlpha = unit(opacity * sparks * (1.1 + stream.layer * .23));
    ctx.fillStyle = seed > .82 ? highlight : glyph.color;
    const travel = split * split;
    const direction = stream.anchor > .5 ? 1 : -1;
    const pointCount = short ? Math.min(2, glyph.points.length) : glyph.points.length;
    for (let i = 0; i < pointCount; i++) {
      const point = glyph.points[i];
      const spread = 12 + seed * 29 + i * 6;
      const size = (1.45 + seed * .85) * scale;
      ctx.fillRect(glyphX + point.x * scale + direction * spread * travel,
        y + point.y * scale - (10 + seed * 29 + i * 7) * travel, size, size);
    }
  }
}

export function CodeRain({ pointer, reveal, wordMix, enabled, active }: {
  pointer: RefObject<PointerTarget>;
  reveal: MotionValue<number>;
  wordMix: MotionValue<number>;
  enabled: boolean;
  active: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const setRunning = useRef<(running: boolean) => void>(() => {});
  const fieldOpacity = useTransform(wordMix, [0, 1], [1, .18]);
  const staticOpacity = useTransform(reveal, [0, .85], [1, 0]);

  useEffect(() => {
    if (!enabled || !canvas.current) return;
    const element = canvas.current;
    let ctx: CanvasRenderingContext2D | null;
    const atlases: Partial<Record<ResolvedTheme, Atlas>> = {};
    let palette: (typeof effectPalettes)[ResolvedTheme] = effectPalettes.dark;
    let sprites: Atlas | undefined;
    try {
      ctx = element.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;

    const context = ctx;
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    let clock = 0;
    let offsetX = 0;
    let offsetY = 0;
    let running = false;
    let lost = false;

    const queue = () => {
      if (running && !lost && !frame && width && height) frame = requestAnimationFrame(draw);
    };
    function draw(now: number) {
      frame = 0;
      if (!running || lost || !sprites) return;
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
      previous = now;
      const progress = unit(reveal.get());
      context.clearRect(0, 0, width, height);
      element.dataset.ready = "true";
      if (progress >= .995) {
        previous = 0;
        return;
      }

      clock += dt * (1 - progress) ** 2;
      const damping = 1 - Math.exp(-dt * 4);
      offsetX += (pointer.current.x - offsetX) * damping;
      offsetY += (pointer.current.y - offsetY) * damping;
      const small = width < 510;
      for (const stream of small ? compact : desktop) {
        const layer = layers[stream.layer];
        const scale = (layer.font - (small && stream.layer > 0 ? 1 : 0)) / 16;
        const gap = layer.gap + stream.seed % 4;
        const travel = clock * layer.speed + stream.seed * 31;
        const shift = Math.floor(travel / gap);
        const remainder = travel % gap;
        const useShort = small || stream.short;
        const list = useShort ? shortSnippets : snippets;

        const top = stream.band[0] * height;
        const bottom = stream.band[1] * height;
        for (let slot = Math.floor(top / gap) - 1; slot <= Math.ceil(bottom / gap); slot++) {
          const rowNumber = slot - shift;
          const position = modulo(rowNumber + stream.seed, stream.length + 4);
          if (position >= stream.length) continue;
          const index = modulo(rowNumber + stream.seed * 7, list.length) + (useShort ? snippets.length : 0);
          const y = slot * gap + remainder - offsetY * layer.parallax;
          if (y <= top || y >= bottom) continue;
          const x = width * stream.anchor + offsetX * layer.parallax
            - (stream.right ? sprites.rows[index].width * scale : 0);
          const leading = .58 + .42 * (position / Math.max(1, stream.length - 1)) ** 2;
          const edge = unit((y - top) / (gap * 1.4)) * unit((bottom - y) / (gap * 1.4));
          drawRow(context, sprites, index, x, y, scale, palette.codeOpacity * layer.opacity * leading * edge, progress, stream, small, palette.code.type);
        }
      }
      queue();
    }

    const observer = new ResizeObserver(([entry]) => {
      ({ width, height } = entry.contentRect);
      const dpr = Math.min(window.devicePixelRatio || 1, width < 510 ? 1.25 : 1.5);
      element.width = Math.max(1, Math.round(width * dpr));
      element.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      queue();
    });
    observer.observe(element);
    const unwatch = watchResolvedTheme(theme => {
      palette = effectPalettes[theme];
      try {
        sprites = atlases[theme] ??= buildAtlas(palette.code) ?? undefined;
      } catch {
        // Keep the CSS fallback if the browser disallows canvas sampling.
        sprites = undefined;
      }
      if (!sprites) delete element.dataset.ready;
      queue();
    });
    const unsubscribe = reveal.on("change", queue);
    const fallback = () => {
      lost = true;
      delete element.dataset.ready;
      cancelAnimationFrame(frame);
      frame = 0;
    };
    element.addEventListener("contextlost", fallback);
    setRunning.current = next => {
      running = next;
      if (next) queue();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = 0;
      }
    };
    return () => {
      setRunning.current = () => {};
      cancelAnimationFrame(frame);
      unsubscribe();
      unwatch();
      observer.disconnect();
      element.removeEventListener("contextlost", fallback);
      delete element.dataset.ready;
      element.width = 1;
      element.height = 1;
    };
  }, [enabled, pointer, reveal]);

  useEffect(() => { setRunning.current(active); }, [active, enabled]);

  return (
    <div className="code-environment" aria-hidden="true">
      <motion.div className="code-light" style={{ opacity: staticOpacity }} />
      <motion.div className="code-field" style={{ opacity: fieldOpacity }}>
        <canvas className="code-rain" ref={canvas} />
        <motion.div className="code-fallback" style={{ opacity: staticOpacity }}>
          <div><code>const signal</code><code>await compose()</code><code>Future&lt;void&gt;</code><code>type Signal</code></div>
          <div><code>interface Agent</code><code>agent.plan()</code><code>encoder.encode()</code><code>pipeline.run()</code></div>
        </motion.div>
      </motion.div>
    </div>
  );
}
