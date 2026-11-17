export const faceVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAssembly;
  uniform float uPointSize;
  uniform float uDpr;
  attribute vec3 aTint;
  attribute float aSize;
  attribute float aSeed;
  attribute float aFeature;
  varying vec3 vTint;
  varying float vAlpha;
  vec3 decodeSRGB(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  }
  void main() {
    vec3 p = position;
    float scattered = 1.0 - uAssembly;
    p += vec3(sin(aSeed * 123.0), cos(aSeed * 87.0), sin(aSeed * 61.0)) * scattered * 0.3;
    // Keep particles aligned with the detail surface. Subpixel breathing is shared.
    p.z += 0.005;
    p.xy *= 1.0 + sin(uTime * 0.5) * 0.0005;
    vec3 source = decodeSRGB(aTint);
    float luminance = dot(source, vec3(0.2126, 0.7152, 0.0722));
    vec3 coolWhite = luminance * vec3(0.72, 0.90, 1.02);
    vTint = mix(coolWhite, source, 0.28);
    // Features use smaller, less opaque points so eyes and lips remain legible.
    float neckFade = smoothstep(-1.23, -0.90, position.y);
    float depthFade = mix(0.75, 1.0, smoothstep(-0.5, 0.2, position.z));
    vAlpha = smoothstep(0.02, 0.35, uAssembly) * mix(0.44, 0.26, aFeature) * neckFade * depthFade;
    vTint *= 0.98 + 0.02 * sin(uTime * 0.65 + aSeed * 20.0);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(uPointSize * uDpr * aSize * clamp(5.0 / -mvPosition.z, 0.9, 1.15), 1.0, 3.8);
  }
`;

export const faceFragmentShader = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    if (radius > 1.0) discard;
    float falloff = 1.0 - smoothstep(0.05, 1.0, radius);
    gl_FragColor = vec4(vTint, falloff * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const detailVertexShader = /* glsl */ `
  uniform float uTime;
  attribute float aFeature;
  varying vec2 vUv;
  varying float vFeature;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 p = position;
    p.xy *= 1.0 + sin(uTime * 0.5) * 0.0005;
    vUv = uv;
    vFeature = aFeature;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const detailFragmentShader = /* glsl */ `
  uniform sampler2D uPortrait;
  uniform float uAssembly;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFeature;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec4 source = texture2D(uPortrait, vUv);
    float assembly = smoothstep(0.38, 0.98, uAssembly);
    float alpha = source.a * mix(0.42, 0.78, vFeature) * assembly;
    if (alpha < 0.015) discard;
    // Texture is tagged sRGB by Three.js; sampling returns linear RGB.
    float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 color = mix(luminance * vec3(0.72, 0.90, 1.02), source.rgb, 0.28);
    vec3 n = normalize(vNormal);
    float frontal = 0.88 + 0.12 * max(0.0, dot(n, normalize(vec3(-0.2, 0.3, 1.0))));
    color *= frontal;
    float rim = pow(1.0 - max(n.z, 0.0), 3.0) * 0.5;
    color += mix(vec3(0.03, 0.12, 0.15), vec3(0.09, 0.05, 0.14), smoothstep(-0.3, 0.8, vPosition.x)) * rim;
    float scanY = mod(uTime * 0.16 + 2.4, 4.4) - 2.2;
    float scan = exp(-pow((vPosition.y - scanY) / 0.025, 2.0));
    color += vec3(0.01, 0.025, 0.03) * scan * (1.0 - vFeature * 0.65);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
