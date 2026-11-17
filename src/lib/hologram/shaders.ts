export const faceVertexShader = /* glsl */ `
  uniform float uReveal;
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
    p += vec3(sin(aSeed * 123.0), cos(aSeed * 87.0), sin(aSeed * 61.0)) * (scattered * 0.3 + sin(uReveal * 3.14159) * 0.012);
    // Keep particles aligned with the detail surface. Subpixel breathing is shared.
    p.z += 0.005;
    p.xy *= 1.0 + sin(uTime * 0.5) * 0.0005;
    vec3 source = decodeSRGB(aTint);
    float luminance = dot(source, vec3(0.2126, 0.7152, 0.0722));
    float value = pow(max(luminance, 0.0), 0.8);
    vec3 cyan = vec3(0.12, 0.72, 0.93) * (0.025 + value * 1.15);
    vTint = mix(cyan, vec3(0.78, 0.95, 1.0) * value, aFeature * 0.36);
    vTint *= 1.0 + sin(uReveal * 3.14159) * 0.18;
    // Features use smaller, less opaque points so eyes and lips remain legible.
    float neckFade = smoothstep(-1.23, -0.90, position.y);
    float depthFade = mix(0.75, 1.0, smoothstep(-0.5, 0.2, position.z));
    vAlpha = smoothstep(0.02, 0.35, uAssembly) * mix(0.72, 0.80, aFeature) * neckFade * depthFade * (1.0 - smoothstep(0.08, 0.88, uReveal));
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
  uniform float uReveal;
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
  uniform float uReveal;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFeature;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec4 source = texture2D(uPortrait, vUv);
    float assembly = mix(smoothstep(0.38, 0.98, uAssembly), 1.0, uReveal);
    vec3 n = normalize(vNormal);
    float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec2 texel = vec2(1.0 / 143.0, 1.0 / 197.0);
    float horizontal = dot(texture2D(uPortrait, vUv + vec2(texel.x, 0.0)).rgb - texture2D(uPortrait, vUv - vec2(texel.x, 0.0)).rgb, vec3(0.2126, 0.7152, 0.0722));
    float vertical = dot(texture2D(uPortrait, vUv + vec2(0.0, texel.y)).rgb - texture2D(uPortrait, vUv - vec2(0.0, texel.y)).rgb, vec3(0.2126, 0.7152, 0.0722));
    float edge = min(length(vec2(horizontal, vertical)) * 2.0, 0.65);
    // A quantized structural signal, not photographic skin or source RGB.
    float level = floor(clamp(luminance, 0.0, 0.999) * 6.0) / 5.0;
    float frontal = 0.5 + 0.5 * max(0.0, dot(n, normalize(vec3(-0.2, 0.3, 1.0))));
    vec3 digital = vec3(0.008, 0.035, 0.065) + vec3(0.10, 0.31, 0.40) * level * frontal;
    digital += vec3(0.10, 0.35, 0.43) * edge * (0.3 + 0.7 * vFeature);
    float rim = pow(1.0 - max(n.z, 0.0), 2.5);
    digital += mix(vec3(0.01, 0.10, 0.15), vec3(0.09, 0.035, 0.16), smoothstep(-0.3, 0.8, vPosition.x)) * rim * 0.22;
    float scanY = mod(uTime * 0.16 + 2.4, 4.4) - 2.2;
    float scan = exp(-pow((vPosition.y - scanY) / 0.025, 2.0));
    digital += vec3(0.01, 0.035, 0.045) * scan;
    float digitalAlpha = mix(0.32, 0.46, vFeature);
    float alpha = source.a * mix(digitalAlpha, 1.0, uReveal) * assembly;
    if (alpha < 0.015) discard;
    vec3 color = mix(digital, source.rgb, uReveal);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
