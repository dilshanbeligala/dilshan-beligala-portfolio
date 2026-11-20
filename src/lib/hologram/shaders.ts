// Use the same breathing motion on the points and the opt-in portrait.
const portraitMotion = /* glsl */ `
  vec3 portraitPosition(vec3 p, float time) {
    p.xy *= 1.0 + sin(time * 0.5) * 0.0005;
    return p;
  }
`;

export const faceVertexShader = /* glsl */ `
  uniform sampler2D uPortrait;
  uniform float uReveal;
  uniform float uLightTheme;
  uniform float uTime;
  uniform float uScatter;
  uniform float uWord;
  uniform float uPointSize;
  uniform float uDpr;
  uniform vec3 uCursor;
  uniform float uCursorRadius;
  uniform float uCursorStrength;
  uniform vec3 uDarkColors[4];
  uniform vec3 uLightColors[2];
  uniform vec2 uDarkOpacity;
  uniform vec2 uLightOpacity;
  attribute vec3 aTint;
  attribute float aSize;
  attribute float aSeed;
  attribute float aFeature;
  attribute vec3 aWordTarget;
  varying vec3 vTint;
  varying float vAlpha;
  varying float vFeather;
  ${portraitMotion}

  void main() {
    float matte = smoothstep(0.06, 0.74, texture2D(uPortrait, uv).a);
    vec3 p = portraitPosition(position, uTime);
    vec2 fromCursor = p.xy - uCursor.xy;
    float distanceToCursor = length(fromCursor);
    float influence = 1.0 - smoothstep(0.0, uCursorRadius, distanceToCursor);
    p.xy += fromCursor / max(distanceToCursor, 0.045)
      * influence * uCursorStrength * uCursor.z * matte * (1.0 - uReveal) * (1.0 - uScatter) * (1.0 - uWord);

    // Each point follows the same path back to its original facial sample.
    vec2 cloud = vec2(fract(aSeed * 127.1), fract(aSeed * 311.7)) * 2.0 - 1.0;
    p.xy = mix(p.xy, p.xy * 0.43 + cloud * vec2(1.02, 0.98), uScatter);
    float phase = aSeed * 6.2831853;
    p.z += 0.008;
    float lane = 0.52 * smoothstep(-1.3, 1.3, position.x);
    float morph = smoothstep(lane, lane + 0.48, uWord);
    p = mix(p, vec3(aWordTarget.xy, 0.0), morph);

    vec3 tint;
    float opacity;
    if (uLightTheme > 0.5) {
      float ink = aTint.r;
      tint = mix(uLightColors[0], uLightColors[1], ink);
      opacity = mix(uLightOpacity.y, uLightOpacity.x, ink);
    } else {
      float gray = dot(aTint, vec3(0.2126, 0.7152, 0.0722));
      float localDetail = smoothstep(0.13, 0.36, gray) * (1.0 - smoothstep(0.43, 0.68, gray));
      float tone = smoothstep(0.025, 0.88, gray + 0.13 * aFeature * localDetail);
      float low = smoothstep(0.0, 0.56, tone);
      float high = smoothstep(0.44, 1.0, tone);
      float violet = 0.22 * smoothstep(0.0, 0.83, position.x) * (1.0 - tone);
      tint = mix(mix(mix(uDarkColors[0], uDarkColors[1], low), uDarkColors[2], high), uDarkColors[3], violet);
      opacity = mix(uDarkOpacity.x, uDarkOpacity.y, tone);
    }
    vec3 wordTint = uLightTheme > 0.5 ? uLightColors[1] : mix(uDarkColors[1], uDarkColors[2], 0.45);
    vTint = mix(tint * mix(0.80, 1.0, smoothstep(-0.44, 0.20, position.z)), wordTint, morph);
    float shimmer = 0.985 + 0.015 * sin(uTime * 0.65 + phase);
    float faceAlpha = opacity * mix(0.92, 1.0, aFeature) * matte * shimmer;
    float wordAlpha = mix(faceAlpha, 0.98, morph);
    float mergeAlpha = 1.0 - smoothstep(0.1, 0.85, morph);
    vAlpha = mix(faceAlpha * mergeAlpha, wordAlpha, aWordTarget.z)
      * (1.0 - smoothstep(0.04, 0.94, uReveal));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    float portraitSize = uPointSize * aSize * mix(0.75, 1.0, matte);
    float diameter = clamp(mix(portraitSize, uPointSize * 0.62, morph) * uDpr, 1.0, 6.0);
    gl_PointSize = diameter;
    vFeather = clamp(1.5 / diameter, 0.32, 0.85);
  }
`;

export const faceFragmentShader = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  varying float vFeather;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = (1.0 - smoothstep(1.0 - vFeather, 1.0, radius)) * vAlpha;
    if (alpha < 0.0039) discard;
    gl_FragColor = vec4(vTint, alpha);
    #include <colorspace_fragment>
  }
`;

export const detailVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  ${portraitMotion}

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(portraitPosition(position, uTime), 1.0);
  }
`;

export const detailFragmentShader = /* glsl */ `
  uniform sampler2D uPortrait;
  uniform float uReveal;
  varying vec2 vUv;

  void main() {
    vec4 source = texture2D(uPortrait, vUv);
    float alpha = source.a * uReveal;
    if (alpha < 0.0039) discard;
    // The offline texture stores linear-premultiplied RGB. Three blends straight alpha.
    gl_FragColor = vec4(clamp(source.rgb / source.a, 0.0, 1.0), alpha);
    #include <colorspace_fragment>
  }
`;
