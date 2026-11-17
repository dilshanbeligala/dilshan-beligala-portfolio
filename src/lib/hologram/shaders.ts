export const faceVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAssembly;
  uniform float uPointSize;
  uniform float uDpr;
  attribute vec3 aTint;
  attribute float aSize;
  attribute float aSeed;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float scattered = 1.0 - uAssembly;
    p += vec3(sin(aSeed * 123.0), cos(aSeed * 87.0), sin(aSeed * 61.0)) * scattered * 0.55;
    // Maximum idle displacement is a fraction of a source-photo pixel.
    p.z += sin(uTime * 0.65 + aSeed * 6.28) * 0.002;
    p.xy *= 1.0 + sin(uTime * 0.5) * 0.001;
    float scanY = mod(uTime * 0.22 + 2.5, 4.4) - 2.2;
    float scan = exp(-pow((position.y - scanY) / 0.045, 2.0));
    float shimmer = 0.94 + 0.06 * sin(uTime * 0.8 + aSeed * 40.0);
    vTint = aTint * shimmer + vec3(0.12, 0.21, 0.25) * scan;
    vAlpha = smoothstep(0.02, 0.35, uAssembly) * (0.82 + 0.13 * aSeed);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float depthScale = clamp(5.0 / -mvPosition.z, 0.85, 1.2);
    gl_PointSize = clamp(uPointSize * uDpr * aSize * depthScale, 1.0, 5.0);
  }
`;

export const faceFragmentShader = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    if (radius > 1.0) discard;
    float falloff = 1.0 - smoothstep(0.15, 1.0, radius);
    gl_FragColor = vec4(vTint, falloff * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
