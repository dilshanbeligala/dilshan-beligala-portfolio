"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, MathUtils, ShaderMaterial } from "three";
import { hologram, qualityPresets, type PointerTarget, type Quality } from "@/lib/hologram/config";
import { createAmbientGeometry, createFaceGeometry, decodePortrait, type PortraitData } from "@/lib/hologram/geometry";
import { faceFragmentShader, faceVertexShader } from "@/lib/hologram/shaders";

type SceneProps = {
  pointer: RefObject<PointerTarget>;
  quality: Quality;
  active: boolean;
  onReady: () => void;
  onFailure: () => void;
  onDegrade: () => void;
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

function Sculpture({ data, pointer, quality, onReady, onDegrade }: Omit<SceneProps, "active" | "onFailure"> & { data: PortraitData }) {
  const group = useRef<Group>(null);
  const ambient = useRef<Group>(null);
  const material = useRef<ShaderMaterial>(null);
  const elapsed = useRef(0);
  const announced = useRef(false);
  const performance = useRef({ seconds: 0, frames: 0, cooldown: 0 });
  const { size, gl } = useThree();
  const preset = qualityPresets[quality];
  const face = useMemo(() => createFaceGeometry(data), [data]);
  const contours = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(data.contours, 3));
    return geometry;
  }, [data]);
  const atmosphere = useMemo(() => createAmbientGeometry(130), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAssembly: { value: 0 }, uPointSize: { value: 1.7 }, uDpr: { value: 1 } }), []);

  useEffect(() => {
    face.setDrawRange(0, Math.min(preset.particles, data.seeds.length));
    atmosphere.setDrawRange(0, preset.ambient);
  }, [face, atmosphere, preset, data]);
  useEffect(() => () => { face.dispose(); contours.dispose(); atmosphere.dispose(); }, [face, contours, atmosphere]);

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
    // Only step down. Ignore assembly and long hidden-tab resume frames.
    const sample = performance.current;
    if (time > 3 && delta < .2 && time > sample.cooldown) {
      sample.seconds += delta; sample.frames++;
      if (sample.seconds > 2) {
        if (sample.seconds / sample.frames > .034) onDegrade();
        sample.seconds = 0; sample.frames = 0; sample.cooldown = time + 5;
      }
    }
  });

  return <>
    <group ref={group}>
      <points geometry={face} frustumCulled={false}>
        <shaderMaterial ref={material} uniforms={uniforms} vertexShader={faceVertexShader} fragmentShader={faceFragmentShader} transparent depthWrite={false} depthTest={false} blending={AdditiveBlending} toneMapped={false} />
      </points>
      <lineSegments geometry={contours}>
        <lineBasicMaterial color="#79aee9" transparent opacity={.035} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </lineSegments>
    </group>
    <group ref={ambient}>
      <points geometry={atmosphere}>
        <pointsMaterial color="#7cc4e6" size={.009} transparent opacity={.26} depthWrite={false} sizeAttenuation blending={AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  </>;
}

export default function HologramScene(props: SceneProps) {
  const [data, setData] = useState<PortraitData | null>(null);
  const { onFailure } = props;
  useEffect(() => {
    const controller = new AbortController();
    const get = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) throw new Error("Portrait asset unavailable.");
      return response.arrayBuffer();
    };
    Promise.all([get(hologram.surfaceUrl), get(hologram.contourUrl)])
      .then(([particles, contours]) => setData(decodePortrait(particles, contours)))
      .catch(() => { if (!controller.signal.aborted) onFailure(); });
    return () => controller.abort();
  }, [onFailure]);

  if (!data) return null;
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
    <Sculpture data={data} pointer={props.pointer} quality={props.quality} onReady={props.onReady} onDegrade={props.onDegrade} />
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
