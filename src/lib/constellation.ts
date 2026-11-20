import { effectPalettes, type FieldPalette } from "./theme-effects";

export type Point = { x: number; y: number };
export type SafeBox = { left: number; top: number; right: number; bottom: number };

export const constellationProfiles = {
  hero: { ambient: .69, active: .89 },
  about: { ambient: .85, active: .78 },
  experience: { ambient: 1, active: .8 },
  projects: { ambient: .92, active: .89 },
  ai: { ambient: 1.03, active: 1 },
  contact: { ambient: .62, active: .62 },
} as const;

export type ConstellationRegion = keyof typeof constellationProfiles;
export type RegionBand = { top: number; bottom: number; region: ConstellationRegion };

const quality = {
  spacing: 58,
  influence: 210,
  displacement: 24,
  stiffness: 125,
  damping: 20,
  reach: 105,
  hysteresis: 15,
  maxEdges: 70,
  maxDegree: 3,
  pulseInterval: 1400,
  pulseDuration: 520,
};

const cutoff = .006;

type Particle = {
  id: string; x: number; y: number; dx: number; dy: number; vx: number; vy: number;
  radius: number; opacity: number; color: "cyan" | "violet"; rest: 0 | 1 | 2; energy: number; degree: number; strength: number;
};

type Edge = { a: Particle; b: Particle; alpha: number; selected: boolean; color: "cyan" | "violet" | "mixed" };
type Viewport = { x: number; y: number; width: number; height: number };

function unit(column: number, row: number, salt: number) {
  let hash = Math.imul(column, 73856093) ^ Math.imul(row, 19349663) ^ Math.imul(salt, 83492791);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function particle(column: number, row: number, id: string): Particle {
  const depth = unit(column, row, 33);
  return {
    id,
    x: (column + .19 + unit(column, row, 12) * .62) * quality.spacing,
    y: (row + .19 + unit(column, row, 23) * .62) * quality.spacing,
    dx: 0, dy: 0, vx: 0, vy: 0, energy: 0, degree: 0, strength: 1,
    radius: .8 + depth * depth * 1.08, opacity: .22 + depth * .13,
    color: unit(column, row, 44) < .34 ? "violet" : "cyan",
    rest: depth < .34 ? 0 : depth < .83 ? 1 : 2,
  };
}

function integrate(node: Particle, x: number, y: number, dt: number) {
  const steps = Math.ceil(dt / .011);
  const step = dt / steps;
  for (let index = 0; index < steps; index++) {
    node.vx += ((x - node.dx) * quality.stiffness - node.vx * quality.damping) * step;
    node.vy += ((y - node.dy) * quality.stiffness - node.vy * quality.damping) * step;
    node.dx += node.vx * step;
    node.dy += node.vy * step;
    const displacement = Math.hypot(node.dx, node.dy);
    if (displacement > quality.displacement) {
      node.dx *= quality.displacement / displacement;
      node.dy *= quality.displacement / displacement;
    }
  }
  if (Math.hypot(x - node.dx, y - node.dy) > .08 || Math.hypot(node.vx, node.vy) > .18) return true;
  node.dx = x;
  node.dy = y;
  node.vx = node.vy = 0;
  return false;
}

export function createConstellation(ctx: CanvasRenderingContext2D) {
  let ink: FieldPalette = effectPalettes.dark.field;
  let nodes = new Map<string, Particle>();
  const edges = new Map<string, Edge>();
  let gridBounds = "";
  let pulse: { edge: Edge; start: number } | null = null;
  let lastPulse = -Infinity;

  function sync(view: Viewport) {
    // The buffer keeps nearby springs alive across incremental scrolling.
    const padding = quality.influence + quality.displacement;
    const left = Math.max(0, Math.floor((view.x - padding) / quality.spacing));
    const top = Math.max(0, Math.floor((view.y - padding) / quality.spacing));
    const right = Math.floor((view.x + view.width + padding) / quality.spacing);
    const bottom = Math.floor((view.y + view.height + padding) / quality.spacing);
    const bounds = `${left}:${top}:${right}:${bottom}`;
    if (bounds === gridBounds) return;

    const visible = new Map<string, Particle>();
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        const id = `${column}:${row}`;
        visible.set(id, nodes.get(id) ?? particle(column, row, id));
      }
    }
    for (const [key, edge] of edges) {
      if (!visible.has(edge.a.id) || !visible.has(edge.b.id)) edges.delete(key);
    }
    nodes = visible;
    gridBounds = bounds;
  }

  function draw(view: Viewport, pointer: Point | null, bands: RegionBand[], safe: SafeBox[],
    face: SafeBox | null, dt: number, now: number, allowPulse: boolean, interactive: boolean) {
    sync(view);
    let animating = false;
    const active: Particle[] = [];
    const response = 1 - Math.exp(-dt * 11);
    const mouseX = pointer ? pointer.x + view.x : 0;
    const mouseY = pointer ? pointer.y + view.y : 0;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.save();
    ctx.translate(-view.x, -view.y);

    for (const node of nodes.values()) {
      const region = bands.find(band => band.top <= node.y && node.y < band.bottom)?.region ?? "about";
      const profile = constellationProfiles[region];
      node.strength = profile.active;
      const x = mouseX - node.x;
      const y = mouseY - node.y;
      const nearby = pointer && Math.abs(x) < quality.influence && Math.abs(y) < quality.influence;
      const distance = nearby ? Math.hypot(x, y) : 0;
      const proximity = nearby ? Math.max(0, 1 - distance / quality.influence) : 0;
      if (interactive) {
        const pull = quality.displacement * proximity ** 2 / Math.max(44, distance);
        if (integrate(node, x * pull, y * pull, dt)) animating = true;
        const target = proximity ** 1.2;
        node.energy += (target - node.energy) * response;
        if (Math.abs(target - node.energy) > cutoff) animating = true;
        else node.energy = target;
      } else {
        node.dx = node.dy = node.vx = node.vy = node.energy = 0;
      }
      node.degree = 0;
      if (proximity > .07) active.push(node);
      const drawX = node.x + node.dx;
      const drawY = node.y + node.dy;
      if (drawX < view.x - 2 || drawX > view.x + view.width + 2 ||
          drawY < view.y - 2 || drawY > view.y + view.height + 2) continue;
      ctx.globalAlpha = Math.min(.94, node.opacity * profile.ambient + node.energy * .78 * profile.active);
      ctx.fillStyle = node.energy > .12 ? ink[node.color] : ink.idle[node.rest];
      ctx.beginPath();
      ctx.arc(drawX, drawY, node.radius + node.energy * .35, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!interactive) {
      edges.clear();
      pulse = null;
    }
    const candidates: { key: string; a: Particle; b: Particle; score: number }[] = [];
    for (let index = 0; index < active.length; index++) {
      const a = active[index];
      for (let next = index + 1; next < active.length; next++) {
        const b = active[next];
        const key = `${a.id}/${b.id}`;
        const retained = edges.get(key)?.selected;
        const separation = Math.hypot(a.x + a.dx - b.x - b.dx, a.y + a.dy - b.y - b.dy);
        if (separation <= quality.reach + (retained ? quality.hysteresis : 0)) {
          candidates.push({ key, a, b, score: separation - (retained ? quality.hysteresis : 0) });
        }
      }
    }
    for (const edge of edges.values()) edge.selected = false;
    candidates.sort((a, b) => a.score - b.score);
    for (const { key, a, b } of candidates) {
      if (a.degree >= quality.maxDegree || b.degree >= quality.maxDegree) continue;
      let edge = edges.get(key);
      if (!edge) {
        if (edges.size >= quality.maxEdges) continue;
        edge = { a, b, alpha: 0, selected: false, color: a.color === b.color ? a.color : "mixed" };
        edges.set(key, edge);
      }
      edge.selected = true;
      a.degree++;
      b.degree++;
    }

    let signalCandidate: Edge | undefined;
    ctx.lineWidth = .85;
    for (const [key, edge] of edges) {
      const { a, b } = edge;
      const target = edge.selected ? Math.sqrt(a.energy * b.energy) * (a.strength + b.strength) * .35 : 0;
      edge.alpha += (target - edge.alpha) * response;
      if (Math.abs(target - edge.alpha) > cutoff) animating = true;
      if (!edge.selected && edge.alpha < cutoff) {
        edges.delete(key);
        continue;
      }
      if (edge.selected && target > .19 && (!signalCandidate || edge.alpha > signalCandidate.alpha)) signalCandidate = edge;
      ctx.globalAlpha = edge.alpha;
      ctx.strokeStyle = ink[edge.color];
      ctx.beginPath();
      ctx.moveTo(a.x + a.dx, a.y + a.dy);
      ctx.lineTo(b.x + b.dx, b.y + b.dy);
      ctx.stroke();
    }

    if (allowPulse && signalCandidate && now - lastPulse > quality.pulseInterval) {
      pulse = { edge: signalCandidate, start: now };
      lastPulse = now;
    }
    if (pulse) {
      const progress = (now - pulse.start) / quality.pulseDuration;
      const { a, b, selected } = pulse.edge;
      if (progress >= 1 || !selected) pulse = null;
      else {
        ctx.globalAlpha = Math.sin(progress * Math.PI) * .65;
        ctx.fillStyle = ink.signal;
        ctx.beginPath();
        ctx.arc(a.x + a.dx + (b.x + b.dx - a.x - a.dx) * progress,
          a.y + a.dy + (b.y + b.dy - a.y - a.dy) * progress, 1.55, 0, Math.PI * 2);
        ctx.fill();
        animating = true;
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    for (const box of safe) {
      if (box.bottom >= view.y && box.top <= view.y + view.height) {
        ctx.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
      }
    }
    if (face && face.bottom >= view.y && face.top <= view.y + view.height) {
      // Feather the portrait exclusion into the surrounding code and background.
      ctx.translate((face.left + face.right) * .5, (face.top + face.bottom) * .5);
      ctx.scale((face.right - face.left) * .5, (face.bottom - face.top) * .5);
      const mask = ctx.createRadialGradient(0, 0, .66, 0, 0, 1);
      mask.addColorStop(0, "#000");
      mask.addColorStop(1, "#0000");
      ctx.fillStyle = mask;
      ctx.fillRect(-1, -1, 2, 2);
    }
    ctx.restore();
    return animating;
  }

  return { draw, setPalette(palette: FieldPalette) { ink = palette; } };
}
