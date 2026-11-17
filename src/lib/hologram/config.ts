export type Quality = "high" | "medium" | "low";
export type PointerTarget = { x: number; y: number };

// Conservative starting budgets; the renderer may step down after slow frames.
export const qualityPresets = {
  high: { particles: 24000, ambient: 130, dpr: 1.5, pointSize: 2.1 },
  medium: { particles: 16000, ambient: 70, dpr: 1.25, pointSize: 2.5 },
  low: { particles: 5000, ambient: 30, dpr: 1, pointSize: 3.1 },
} as const;
export const hologram = {
  horizontalRotation: 5 * Math.PI / 180,
  verticalRotation: 3 * Math.PI / 180,
  assemblySeconds: 2.1,
  surfaceUrl: "/hologram/facial-particles.bin",
  contourUrl: "/hologram/facial-contours.bin",
  fallbackUrl: "/hologram/portrait-fallback.webp",
};
