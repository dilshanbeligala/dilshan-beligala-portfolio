"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject, useSyncExternalStore, useId } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { Eye, RotateCcw } from "lucide-react";
import { CodeRain } from "./code-rain";
import { usePortraitReveal } from "./use-portrait-reveal";
import { hologram, type PointerTarget, type Quality } from "@/lib/hologram/config";

const HologramScene = dynamic(() => import("./hologram-scene"), { ssr: false });

class RenderBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const subscribeHydration = () => () => {};

export function HolographicPortrait({ pointer }: { pointer: RefObject<PointerTarget> }) {
  const host = useRef<HTMLDivElement>(null);
  const reveal = usePortraitReveal();
  const wordMix = useMotionValue(0);
  const cursor = useRef({ x: 0, y: 0, active: false });
  const instructionId = useId();
  const keyboardHelpId = useId();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const digitalOpacity = useTransform(reveal.progress, value => 1 - value);
  const [animateCode, setAnimateCode] = useState(false);
  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [visible, setVisible] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const fail = useCallback(() => { setFailed(true); setReady(false); wordMix.set(0); }, [wordMix]);
  const markReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 700px), (pointer: coarse)");
    const wide = window.matchMedia("(min-width: 1200px)");

    let supported: boolean | null = null;
    const evaluate = () => {
      setCapabilityChecked(true);
      const connection = "connection" in navigator ? navigator.connection : null;
      const saveData = typeof connection === "object" && connection !== null && "saveData" in connection && connection.saveData === true;
      if (reduced.matches || saveData) {
        cursor.current.active = false;
        wordMix.set(0);
        setAnimateCode(false);
        setQuality(null);
        setReady(false);
        return;
      }
      if (supported === null) {
        try {
          const probe = document.createElement("canvas");
          const context = probe.getContext("webgl2", { failIfMajorPerformanceCaveat: true, powerPreference: "low-power" });
          supported = context !== null;
          // Release the capability probe immediately; only the R3F context persists.
          context?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch { supported = false; }
      }
      setAnimateCode(supported);
      setQuality(supported ? compact.matches ? "low" : wide.matches ? "high" : "medium" : null);
    };
    evaluate();
    for (const media of [reduced, compact, wide]) media.addEventListener("change", evaluate);
    return () => {
      for (const media of [reduced, compact, wide]) media.removeEventListener("change", evaluate);
    };
  }, [wordMix]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setInitialized(true);
    }, { rootMargin: "80px" });
    observer.observe(element);
    const visibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  // Keep an initialized scene mounted offscreen, but stop its frame loop.
  const shouldRender = quality !== null && !failed && initialized;

  useEffect(() => {
    if (!shouldRender || ready || !visible || !tabVisible) return;
    const watchdog = window.setTimeout(fail, 12000);
    return () => window.clearTimeout(watchdog);
  }, [shouldRender, ready, visible, tabVisible, fail]);

  return <div ref={host} className={`hologram-art ${ready && quality && !failed ? "hologram-ready" : ""}`} role="group" aria-label="Interactive digital identity of Dilshan Beligala" data-static={failed || (capabilityChecked && quality === null) || undefined} data-revealed={reveal.requested} data-quality={quality ?? "static"}>
    <div className="hologram-visual" onPointerMove={event => {
      if (event.pointerType !== "mouse" || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      const rect = event.currentTarget.getBoundingClientRect();
      cursor.current.x = ((event.clientX - rect.left) / rect.width - .5) * hologram.framing;
      cursor.current.y = (.5 - (event.clientY - rect.top) / rect.height) * hologram.framing;
      cursor.current.active = true;
    }} onPointerLeave={() => { cursor.current.active = false; }}>
      <CodeRain wordMix={wordMix} pointer={pointer} reveal={reveal.progress} enabled={animateCode && initialized && !failed} active={visible && tabVisible} />
      <div className="hologram-reticle" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="hologram-fallback" aria-hidden="true">
        <motion.div className="portrait-static-layer" style={{ opacity: digitalOpacity }}><Image className="portrait-preview-dark" src={hologram.fallbackUrl.dark} alt="" width={768} height={768} preload unoptimized draggable={false} />
          <Image className="portrait-preview-light" src={hologram.fallbackUrl.light} alt="" width={768} height={768} loading="eager" unoptimized draggable={false} /></motion.div>
        <motion.div className="portrait-static-layer" style={{ opacity: reveal.progress }}><Image src={hologram.realFallbackUrl} alt="" width={768} height={768} sizes="(max-width: 700px) 100vw, 56vw" draggable={false} /></motion.div>
      </div>
      {shouldRender && <div className="hologram-canvas" aria-hidden="true"><RenderBoundary onFailure={fail}><HologramScene wordMix={wordMix} cursor={cursor} pointer={pointer} reveal={reveal.progress} quality={quality} active={visible && tabVisible} onReady={markReady} onFailure={fail} /></RenderBoundary></div>}
      <button type="button" className="portrait-hold" disabled={!hydrated} aria-label="Hold to reveal Dilshan Beligala’s real portrait" aria-describedby={`${instructionId} ${keyboardHelpId}`} {...reveal.holdHandlers} />
      <p id={keyboardHelpId} className="sr-only">Hold Enter or Space to reveal. Release to return to the hologram. Alternatively, use the reveal toggle.</p>
      <p className="hologram-topline"><span className="status-dot" aria-hidden="true" /> DILSHAN // DIGITAL CONSCIOUSNESS</p>
    </div>
    <div className="portrait-instructions" id={instructionId}>
      <span className="portrait-instruction-title" aria-live="polite">{reveal.requested ? "REAL IDENTITY" : <><span className="instruction-pointer">HOLD TO REVEAL</span><span className="instruction-touch">TOUCH & HOLD TO REVEAL</span></>}</span>
      <span className="portrait-instruction-copy">{reveal.requested ? reveal.latched ? "Use the toggle to return to the digital world." : "Release to return to the digital world." : "Discover the human behind the code."}</span>
      <button type="button" className="portrait-toggle" disabled={!hydrated} aria-pressed={reveal.latched} onClick={reveal.toggle} onBlur={event => { if (!host.current?.contains(event.relatedTarget)) reveal.reset(); }}>{reveal.latched ? <RotateCcw size={12} /> : <Eye size={12} />}<span>{reveal.latched ? "Return to hologram" : "Reveal without holding"}</span></button>
      <p className="hologram-side-label" aria-hidden="true">HUMAN IMAGINATION. DIGITAL EXPRESSION.</p>
    </div>
  </div>;
}
