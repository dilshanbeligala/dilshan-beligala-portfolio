"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, MathUtils, ShaderMaterial, SRGBColorSpace, Texture } from "three";
import { hologram, qualityPresets, type PointerTarget, type Quality } from "@/lib/hologram/config";
import { createAmbientGeometry, createDetailGeometry, createFaceGeometry, decodePortrait, type PortraitData } from "@/lib/hologram/geometry";
import { detailFragmentShader, detailVertexShader, faceFragmentShader, faceVertexShader } from "@/lib/hologram/shaders";

type SceneProps = {
  pointer: RefObject<PointerTarget>;
  quality: Quality;
  active: boolean;
  onReady: () => void;
  onFailure: () => void;
  onDegrade: () => void;
  onPromote: () => void;
};

function RendererLifecycle({ onFailure }: Pick<SceneProps, "onFailure">) {
  const { gl } = useThree();
  useEffect(() => {
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

function Sculpture({ data, texture, pointer, quality, onReady, onDegrade, onPromote }: Omit<SceneProps, "active" | "onFailure"> & { data: PortraitData; texture: Texture }) {
  const group = useRef<Group>(null);
  const ambient = useRef<Group>(null);
  const material = useRef<ShaderMaterial>(null);
  const detailMaterial = useRef<ShaderMaterial>(null);
  const elapsed = useRef(0);
  const announced = useRef(false);
  const performance = useRef({ seconds: 0, frames: 0, cooldown: 0, promoted: false });
  const { size, gl } = useThree();
  const preset = qualityPresets[quality];
  const detail = useMemo(() => createDetailGeometry(data), [data]);
  const face = useMemo(() => createFaceGeometry(data), [data]);
  const contours = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(data.contours, 3));
    return geometry;
  }, [data]);
  const atmosphere = useMemo(() => createAmbientGeometry(80), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAssembly: { value: 0 }, uPointSize: { value: 1.7 }, uDpr: { value: 1 } }), []);

  const detailUniforms = useMemo(() => ({ uPortrait: { value: texture }, uTime: { value: 0 }, uAssembly: { value: 0 } }), [texture]);

  useEffect(() => {
    face.setDrawRange(0, Math.min(preset.particles, data.seeds.length));
    atmosphere.setDrawRange(0, preset.ambient);
  }, [face, atmosphere, preset, data]);
  useEffect(() => () => { face.dispose(); detail.dispose(); contours.dispose(); atmosphere.dispose(); }, [face, detail, contours, atmosphere]);

  useFrame((_, delta) => {
    // Clamp resume delta so tab/visibility changes never advance the intro abruptly.
    elapsed.current += Math.min(delta, .05);
    const time = elapsed.current;
    if (material.current) {
      const uniforms = material.current.uniforms;
      uniforms.uTime.value = time;
      uniforms.uAssembly.value = MathUtils.smoothstep(time / hologram.assemblySeconds, 0, 1);
      uniforms.uPointSize.value = preset.pointSize * Math.min(size.height / 600, 1.3);
      uniforms.uDpr.value = gl.getPixelRatio();
    }
    if (detailMaterial.current) {
      detailMaterial.current.uniforms.uTime.value = time;
      detailMaterial.current.uniforms.uAssembly.value = MathUtils.smoothstep(time / hologram.assemblySeconds, 0, 1);
    }
    if (group.current) {
      group.current.rotation.y = MathUtils.damp(group.current.rotation.y, pointer.current.x * hologram.horizontalRotation, 5, delta);
      group.current.rotation.x = MathUtils.damp(group.current.rotation.x, -pointer.current.y * hologram.verticalRotation, 5, delta);
      group.current.position.x = MathUtils.damp(group.current.position.x, pointer.current.x * .025, 4, delta);
      group.current.position.y = MathUtils.damp(group.current.position.y, pointer.current.y * .018, 4, delta);
    }
    if (ambient.current) {
      ambient.current.rotation.z = Math.sin(time * .08) * .025;
      ambient.current.position.x = -pointer.current.x * .035;
      ambient.current.position.y = -pointer.current.y * .025;
    }
    if (!announced.current && time > .08) { announced.current = true; onReady(); }
    // One measured promotion at most; sustained slow frames step down with a cooldown.
    const sample = performance.current;
    if (time > 3 && delta < .2 && time > sample.cooldown) {
      sample.seconds += delta; sample.frames++;
      if (sample.seconds > 2) {
        const average = sample.seconds / sample.frames;
        if (average > .034) { sample.promoted = true; onDegrade(); }
        else if (average < .019 && !sample.promoted && quality === "medium") { sample.promoted = true; onPromote(); }
        sample.seconds = 0; sample.frames = 0; sample.cooldown = time + 5;
      }
    }
  });

  return <>
    <group ref={group}>
      <mesh geometry={detail} renderOrder={0}>
        <shaderMaterial ref={detailMaterial} uniforms={detailUniforms} vertexShader={detailVertexShader} fragmentShader={detailFragmentShader} transparent depthWrite depthTest toneMapped={false} />
      </mesh>
      <points geometry={face} frustumCulled={false} renderOrder={1}>
        <shaderMaterial ref={material} uniforms={uniforms} vertexShader={faceVertexShader} fragmentShader={faceFragmentShader} transparent depthWrite={false} depthTest toneMapped={false} />
      </points>
      <lineSegments geometry={contours} renderOrder={2}>
        <lineBasicMaterial color="#79aee9" transparent opacity={.012} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </lineSegments>
    </group>
    <group ref={ambient}>
      <points geometry={atmosphere} renderOrder={-1}>
        <pointsMaterial color="#7cc4e6" size={.009} transparent opacity={.16} depthWrite={false} sizeAttenuation blending={AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  </>;
}

export default function HologramScene(props: SceneProps) {
  const [assets, setAssets] = useState<{ data: PortraitData; texture: Texture } | null>(null);
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
      const response = await fetch(hologram.textureUrl, { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) throw new Error("Portrait detail unavailable.");
      const blob = await response.blob();
      bitmap = await createImageBitmap(blob, { imageOrientation: "flipY" });
      if (controller.signal.aborted) { bitmap.close(); return; }
      texture = new Texture(bitmap);
      texture.colorSpace = SRGBColorSpace;
      texture.flipY = false;
      texture.needsUpdate = true;
      const [particles, contours, surface] = await Promise.all([get(hologram.surfaceUrl), get(hologram.contourUrl), get(hologram.detailUrl)]);
      if (!controller.signal.aborted) setAssets({ data: decodePortrait(particles, contours, surface), texture });
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
      camera.zoom = size.height / 4;
      camera.updateProjectionMatrix();
      gl.setClearColor(0x05060b, 0);
    }}
    style={{ pointerEvents: "none" }}
  >
    <ResponsiveCamera />
    <RendererLifecycle onFailure={onFailure} />
    <Sculpture data={assets.data} texture={assets.texture} pointer={props.pointer} quality={props.quality} onReady={props.onReady} onDegrade={props.onDegrade} onPromote={props.onPromote} />
  </Canvas>;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    // R3F cameras are mutable Three.js objects; synchronize on viewport changes.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = size.height / 4;
    camera.updateProjectionMatrix();
  }, [camera, size.height]);
  return null;
}
