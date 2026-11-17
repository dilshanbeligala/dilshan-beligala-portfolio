export type Quality = "high" | "medium" | "low";
export type PointerTarget = { x: number; y: number };

// Conservative starting budgets; the renderer may step down after slow frames.
export const qualityPresets = {
  high: { particles: 15641, ambient: 80, dpr: 1.5, pointSize: 2.0 },
  medium: { particles: 11000, ambient: 45, dpr: 1.25, pointSize: 2.2 },
  low: { particles: 4500, ambient: 20, dpr: 1, pointSize: 2.6 },
} as const;
export const hologram = {
  horizontalRotation: 5 * Math.PI / 180,
  verticalRotation: 3 * Math.PI / 180,
  assemblySeconds: 2.1,
  surfaceUrl: "/hologram/facial-particles.bin",
  detailUrl: "/hologram/facial-detail.bin",
  textureUrl: "/hologram/portrait-detail.webp",
  contourUrl: "/hologram/facial-contours.bin",
  fallbackUrl: "/hologram/portrait-digital-v3.webp",
  realFallbackUrl: "/hologram/portrait-real-v3.webp",
};
