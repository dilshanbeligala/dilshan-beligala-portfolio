import { BufferAttribute, BufferGeometry } from "three";

export type PortraitData = {
  positions: Float32Array;
  colors: Uint8Array;
  sizes: Float32Array;
  seeds: Float32Array;
  contours: Float32Array;
};

export function decodePortrait(particles: ArrayBuffer, contours: ArrayBuffer): PortraitData {
  const view = new DataView(particles);
  if (view.byteLength < 16 || view.getUint32(0, false) !== 0x44424850 || view.getUint32(4, true) !== 1) {
    throw new Error("Unsupported portrait asset.");
  }
  const count = view.getUint32(8, true);
  const stride = view.getUint32(12, true);
  if (count < 1000 || count > 30000 || stride !== 20 || particles.byteLength !== 16 + count * stride || contours.byteLength % 24 !== 0) {
    throw new Error("Invalid portrait buffer dimensions.");
  }
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const offset = 16 + i * stride;
    for (let axis = 0; axis < 3; axis++) {
      const coordinate = view.getFloat32(offset + axis * 4, true);
      if (!Number.isFinite(coordinate) || Math.abs(coordinate) > 3) throw new Error("Invalid portrait coordinate.");
      positions[i * 3 + axis] = coordinate;
      colors[i * 3 + axis] = view.getUint8(offset + 12 + axis);
    }
    sizes[i] = view.getUint8(offset + 15) / 150;
    seeds[i] = view.getFloat32(offset + 16, true);
    if (!Number.isFinite(seeds[i]) || seeds[i] < 0 || seeds[i] > 1) throw new Error("Invalid particle phase.");
  }
  const contourPositions = new Float32Array(contours);
  if (contourPositions.some(value => !Number.isFinite(value) || Math.abs(value) > 3)) throw new Error("Invalid contour coordinate.");
  return { positions, colors, sizes, seeds, contours: contourPositions };
}

export function createFaceGeometry(data: PortraitData) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
  geometry.setAttribute("aTint", new BufferAttribute(data.colors, 3, true));
  geometry.setAttribute("aSize", new BufferAttribute(data.sizes, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(data.seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createAmbientGeometry(count: number) {
  const positions = new Float32Array(count * 3);
  // Deterministic, sparse atmosphere; no random values during React rendering.
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963;
    const radius = 1.15 + (i % 11) / 12;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = Math.sin(i * 1.91) * .55 - .5;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  return geometry;
}
