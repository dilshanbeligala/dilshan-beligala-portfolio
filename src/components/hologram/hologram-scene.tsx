"use client";

import { watchResolvedTheme } from "../theme-provider";

import type { MotionValue } from "motion/react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BufferAttribute, Color, DynamicDrawUsage, Group, MathUtils, Mesh, Points, ShaderMaterial, SRGBColorSpace, Texture, Vector2, Vector3 } from "three";
import { hologram, qualityPresets, type PointerTarget, type Quality } from "@/lib/hologram/config";
import { createDetailGeometry, createFaceGeometry, decodePoints, decodePortrait, type PortraitData } from "@/lib/hologram/geometry";
import { createWordSampler, hologramFrame, hologramWords } from "@/lib/hologram/word-cycle";
import palettes from "@/lib/hologram/palettes.json";
import { detailFragmentShader, detailVertexShader, faceFragmentShader, faceVertexShader } from "@/lib/hologram/shaders";


type SceneProps = {
  pointer: RefObject<PointerTarget>;
  cursor: RefObject<PointerTarget & { active: boolean }>;
  reveal: MotionValue<number>;
  wordMix: MotionValue<number>;
  quality: Quality;
  active: boolean;
  onReady: () => void;
  onFailure: () => void;
};

function RendererLifecycle({ onFailure }: Pick<SceneProps, "onFailure">) {
  const { gl } = useThree();
  useLayoutEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onFailure(); };
    const oldHandler = gl.debug.onShaderError;
    // Three.js exposes this imperative callback on the renderer, not React state.
    // eslint-disable-next-line react-hooks/immutability
    gl.debug.onShaderError = () => onFailure();
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      gl.debug.onShaderError = oldHandler;
    };
  }, [gl, onFailure]);
  return null;
}

type Assets = { data: PortraitData; lightPoints: ReturnType<typeof decodePoints>; texture: Texture };

function Sculpture({ data, lightPoints, texture, pointer, cursor, reveal, wordMix, quality, active, onReady }: Omit<SceneProps, "onFailure"> & Assets) {
  const group = useRef<Group>(null);
  const photo = useRef<Mesh>(null);
  const portrait = useRef<Points>(null);
  const pointsMaterial = useRef<ShaderMaterial>(null);
  const photoMaterial = useRef<ShaderMaterial>(null);
  const elapsed = useRef(0);
  const cycleTime = useRef(0);
  const wordIndex = useRef(-1);
  const wordSampler = useRef<ReturnType<typeof createWordSampler>>(null);
  const hasRendered = useRef(false);
  const themeTarget = useRef(0);
  const skipDelta = useRef(true);
  const { size, gl } = useThree();
  const preset = qualityPresets[quality];
  const detail = useMemo(() => createDetailGeometry(data), [data]);
  const dark = useMemo(() => createFaceGeometry(data, data.surface), [data]);
  const light = useMemo(() => createFaceGeometry(lightPoints, data.surface), [lightPoints, data.surface]);
  useLayoutEffect(() => {
    wordSampler.current = createWordSampler();
    for (const geometry of [dark, light]) {
      const positions = geometry.getAttribute("position");
      const target = new BufferAttribute(new Float32Array(positions.count * 3), 3).setUsage(DynamicDrawUsage);
      geometry.setAttribute("aWordTarget", target);
    }
  }, [dark, light]);

  const uniforms = useMemo(() => {
    const colors = ({ shadow, mid, highlight, violet }: typeof palettes.dark) =>
      [shadow, mid, highlight, violet].map(color => new Color(color));
    return {
      uPortrait: { value: texture },
      uTime: { value: 0 },
      uScatter: { value: 1 },
      uWord: { value: 0 },
      uPointSize: { value: 1 },
      uDpr: { value: 1 },
      uReveal: { value: 0 },
      uLightTheme: { value: 0 },
      uCursor: { value: new Vector3() },
      uCursorRadius: { value: hologram.cursorRadius },
      uCursorStrength: { value: hologram.cursorStrength },
      uDarkColors: { value: colors(palettes.dark) },
      uLightColors: { value: [new Color(palettes.light.highlight), new Color(palettes.light.shadow)] },
      uDarkOpacity: { value: new Vector2(palettes.dark.shadowOpacity, palettes.dark.highlightOpacity) },
      uLightOpacity: { value: new Vector2(palettes.light.shadowOpacity, palettes.light.highlightOpacity) },
    };
  }, [texture]);
  const detailUniforms = useMemo(() => ({ uPortrait: { value: texture }, uTime: { value: 0 }, uReveal: { value: 0 } }), [texture]);

  useLayoutEffect(() => {
    dark.setDrawRange(0, Math.min(preset.particles, data.seeds.length));
    light.setDrawRange(0, Math.min(preset.lightParticles, lightPoints.seeds.length));
  }, [dark, light, preset, data.seeds.length, lightPoints.seeds.length]);
  useEffect(() => () => { dark.dispose(); light.dispose(); detail.dispose(); }, [dark, light, detail]);
  useLayoutEffect(() => watchResolvedTheme(theme => {
    themeTarget.current = theme === "light" ? 1 : 0;
  }), []);
  useLayoutEffect(() => { skipDelta.current = true; }, [active]);

  useFrame((_, frameDelta) => {
    if (!portrait.current || !pointsMaterial.current || !photoMaterial.current) return;
    // Fiber copies the uniform entries into the material when it applies props.
    const points = pointsMaterial.current.uniforms as typeof uniforms;
    const detail = photoMaterial.current.uniforms as typeof detailUniforms;
    // Ignore time spent paused and bound advances after a stalled frame.
    const delta = skipDelta.current ? 0 : Math.min(frameDelta, .1);
    skipDelta.current = false;
    const initializing = !hasRendered.current;
    const progress = reveal.get();
    elapsed.current += delta;
    if (progress <= .004) cycleTime.current += delta;
    const frame = hologramFrame(cycleTime.current);
    if (wordIndex.current !== frame.index && wordSampler.current) {
      for (const geometry of [dark, light]) {
        const target = geometry.getAttribute("aWordTarget");
        const positions = geometry.getAttribute("position");
        wordSampler.current(hologramWords[frame.index], target.array as Float32Array, positions.array as Float32Array);
        target.needsUpdate = true;
      }
      wordIndex.current = frame.index;
    }
    const visibility = 1 - MathUtils.smoothstep(progress, 0, .55);
    points.uScatter.value = frame.scatter * visibility;
    points.uWord.value = wordIndex.current === frame.index ? frame.word * visibility : 0;
    if (wordMix.get() !== points.uWord.value) wordMix.set(points.uWord.value);

    points.uTime.value = elapsed.current;
    points.uReveal.value = initializing ? 0 : progress;
    points.uPointSize.value = preset.pointSize * size.height / 768;
    points.uDpr.value = gl.getPixelRatio();
    // The selected geometry and its tone interpretation change in the same draw.
    portrait.current.geometry = themeTarget.current === 1 ? light : dark;
    points.uLightTheme.value = themeTarget.current;

    detail.uTime.value = elapsed.current;
    detail.uReveal.value = points.uReveal.value;
    if (photo.current) photo.current.visible = detail.uReveal.value > .004;

    const local = points.uCursor.value;
    if (cursor.current.active) {
      local.x = MathUtils.damp(local.x, cursor.current.x, 15, delta);
      local.y = MathUtils.damp(local.y, cursor.current.y, 15, delta);
    }
    local.z = MathUtils.damp(local.z, Number(cursor.current.active), 12, delta);

    if (group.current) {
      group.current.rotation.y = MathUtils.damp(group.current.rotation.y, pointer.current.x * hologram.horizontalRotation, 5, delta);
      group.current.rotation.x = MathUtils.damp(group.current.rotation.x, -pointer.current.y * hologram.verticalRotation, 5, delta);
      group.current.position.x = MathUtils.damp(group.current.position.x, pointer.current.x * .025, 4, delta);
      group.current.position.y = MathUtils.damp(group.current.position.y, pointer.current.y * .018, 4, delta);
    }
  });

  return <group ref={group}>
    <mesh ref={photo} geometry={detail} renderOrder={0} visible={false}>
      <shaderMaterial ref={photoMaterial} uniforms={detailUniforms} vertexShader={detailVertexShader} fragmentShader={detailFragmentShader} transparent depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
    <points ref={portrait} geometry={dark} frustumCulled={false} renderOrder={1} onAfterRender={() => {
      if (hasRendered.current) return;
      hasRendered.current = true;
      onReady();
    }}>
      <shaderMaterial ref={pointsMaterial} uniforms={uniforms} vertexShader={faceVertexShader} fragmentShader={faceFragmentShader} transparent depthWrite={false} depthTest={false} toneMapped={false} />
    </points>
  </group>;
}

export default function HologramScene(props: SceneProps) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const { onFailure } = props;
  useEffect(() => {
    const controller = new AbortController();
    const get = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) throw new Error("Portrait asset unavailable.");
      return response.arrayBuffer();
    };
    let texture: Texture | undefined;
    let bitmap: ImageBitmap | undefined;
    const load = async () => {
      const [response, particles, lightParticles, surface] = await Promise.all([
        fetch(hologram.textureUrl, { signal: controller.signal, credentials: "same-origin" }),
        get(hologram.particlesUrl),
        get(hologram.lightParticlesUrl),
        get(hologram.detailUrl),
      ]);
      if (!response.ok) throw new Error("Portrait detail unavailable.");
      const blob = await response.blob();
      bitmap = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none" });
      if (controller.signal.aborted) { bitmap.close(); return; }
      texture = new Texture(bitmap);
      texture.colorSpace = SRGBColorSpace;
      texture.flipY = false;
      texture.needsUpdate = true;
      if (!controller.signal.aborted) setAssets({ data: decodePortrait(particles, surface), lightPoints: decodePoints(lightParticles), texture });
    };
    load().catch(() => {
      texture?.dispose(); bitmap?.close();
      if (!controller.signal.aborted) onFailure();
    });
    return () => { controller.abort(); texture?.dispose(); bitmap?.close(); };
  }, [onFailure]);

  if (!assets) return null;
  return <Canvas
    orthographic camera={{ position: [0, 0, 5], near: .1, far: 20, zoom: 150 }}
    dpr={[1, qualityPresets[props.quality].dpr]}
    frameloop={props.active ? "always" : "never"}
    gl={{ alpha: true, antialias: false, powerPreference: "low-power", stencil: false }}
    fallback={null}
    onCreated={({ gl, camera, size }) => {
      // Same 4-world-unit framing as the locally generated static fallback.
      camera.zoom = Math.min(size.width, size.height) / hologram.framing;
      camera.updateProjectionMatrix();
      gl.setClearColor(0x05060b, 0);
    }}
    style={{ pointerEvents: "none" }}
  >
    <ResponsiveCamera />
    <RendererLifecycle onFailure={onFailure} />
    <Sculpture {...props} {...assets} />
  </Canvas>;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    // R3F cameras are mutable Three.js objects; synchronize on viewport changes.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = Math.min(size.width, size.height) / hologram.framing;
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);
  return null;
}
