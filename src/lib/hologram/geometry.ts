import { BufferAttribute, BufferGeometry } from "three";

type PortraitPoints = {
  positions: Float32Array;
  colors: Uint8Array;
  sizes: Float32Array;
  seeds: Float32Array;
  features: Float32Array;
};

export type PortraitData = PortraitPoints & {
  surface: { positions: Float32Array; uv: Float32Array; features: Float32Array; indices: Uint16Array };
};

function coordinate(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > 3) throw new Error("Invalid portrait coordinate.");
  return value;
}
function unit(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("Invalid portrait attribute.");
  return value;
}

export function decodePoints(particles: ArrayBuffer): PortraitPoints {
  const view = new DataView(particles);
  if (view.byteLength < 16 || view.getUint32(0, false) !== 0x44424850 || view.getUint32(4, true) !== 2) {
    throw new Error("Unsupported portrait asset.");
  }
  const count = view.getUint32(8, true);
  const stride = view.getUint32(12, true);
  if (count < 1000 || count > 30000 || stride !== 24 || particles.byteLength !== 16 + count * stride) {
    throw new Error("Invalid portrait buffer dimensions.");
  }
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const features = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const offset = 16 + i * stride;
    for (let axis = 0; axis < 3; axis++) {
      positions[i * 3 + axis] = coordinate(view.getFloat32(offset + axis * 4, true));
      colors[i * 3 + axis] = view.getUint8(offset + 12 + axis);
    }
    sizes[i] = view.getUint8(offset + 15) / 150;
    seeds[i] = unit(view.getFloat32(offset + 16, true));
    features[i] = unit(view.getFloat32(offset + 20, true));
  }
  return { positions, colors, sizes, seeds, features };
}

export function decodePortrait(particles: ArrayBuffer, surface: ArrayBuffer): PortraitData {
  const mesh = new DataView(surface);
  if (mesh.byteLength < 16 || mesh.getUint32(0, false) !== 0x44424853 || mesh.getUint32(4, true) !== 1) throw new Error("Unsupported detail surface.");
  const columns = mesh.getUint32(8, true), rows = mesh.getUint32(12, true);
  const vertices = columns * rows;
  if (columns < 2 || rows < 2 || vertices > 16000 || surface.byteLength !== 16 + vertices * 24) throw new Error("Invalid detail surface dimensions.");
  const surfacePositions = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const surfaceFeatures = new Float32Array(vertices);
  for (let i = 0; i < vertices; i++) {
    const offset = 16 + i * 24;
    for (let axis = 0; axis < 3; axis++) surfacePositions[i * 3 + axis] = coordinate(mesh.getFloat32(offset + axis * 4, true));
    uv[i * 2] = unit(mesh.getFloat32(offset + 12, true));
    uv[i * 2 + 1] = unit(mesh.getFloat32(offset + 16, true));
    surfaceFeatures[i] = unit(mesh.getFloat32(offset + 20, true));
  }
  const indices = new Uint16Array((columns - 1) * (rows - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const a = row * columns + col, b = a + 1, c = a + columns, d = c + 1;
      indices.set([a, c, b, b, c, d], cursor); cursor += 6;
    }
  }
  return { ...decodePoints(particles),
    surface: { positions: surfacePositions, uv, features: surfaceFeatures, indices } };
}

export function createFaceGeometry(data: PortraitPoints, surface: PortraitData["surface"]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
  geometry.setAttribute("aTint", new BufferAttribute(data.colors, 3, true));
  geometry.setAttribute("aSize", new BufferAttribute(data.sizes, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(data.seeds, 1));
  geometry.setAttribute("aFeature", new BufferAttribute(data.features, 1));
  const { positions, uv } = surface;
  const last = positions.length - 3;
  const uvLast = uv.length - 2;
  const scaleX = (uv[uvLast] - uv[0]) / (positions[last] - positions[0]);
  const scaleY = (uv[uvLast + 1] - uv[1]) / (positions[last + 1] - positions[1]);
  const pointUv = new Float32Array(data.seeds.length * 2);
  for (let i = 0; i < data.seeds.length; i++) {
    pointUv[i * 2] = uv[0] + (data.positions[i * 3] - positions[0]) * scaleX;
    pointUv[i * 2 + 1] = uv[1] + (data.positions[i * 3 + 1] - positions[1]) * scaleY;
  }
  geometry.setAttribute("uv", new BufferAttribute(pointUv, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createDetailGeometry(data: PortraitData) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(data.surface.positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(data.surface.uv, 2));
  geometry.setIndex(new BufferAttribute(data.surface.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
