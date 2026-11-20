import portraitManifest from "../../../public/hologram/manifest.json";

export type Quality = "high" | "medium" | "low";
export type PointerTarget = { x: number; y: number };

export const qualityPresets = {
  high: { particles: portraitManifest.particles, lightParticles: portraitManifest.lightParticles, dpr: 1.5, pointSize: 3.6 },
  medium: { particles: 16000, lightParticles: 20400, dpr: 1.5, pointSize: 3.9 },
  low: { particles: 11000, lightParticles: 14900, dpr: 1.5, pointSize: 4.55 },
} as const;

export const hologram = {
  framing: 4,
  horizontalRotation: 5 * Math.PI / 180,
  verticalRotation: 3 * Math.PI / 180,
  cursorRadius: .32,
  cursorStrength: .026,
  particlesUrl: "/hologram/facial-particles.bin",
  lightParticlesUrl: "/hologram/facial-particles-light.bin",
  detailUrl: "/hologram/facial-detail.bin",
  textureUrl: "/hologram/portrait-detail.webp",
  fallbackUrl: portraitManifest.digitalFallback,
  realFallbackUrl: portraitManifest.realFallback,
};
