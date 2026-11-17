"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject, useSyncExternalStore, useId } from "react";
import { motion, useTransform } from "motion/react";
import { Eye, RotateCcw } from "lucide-react";
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
  const instructionId = useId();
  const keyboardHelpId = useId();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const digitalOpacity = useTransform(reveal.progress, value => 1 - value);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [visible, setVisible] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const fail = useCallback(() => { setFailed(true); setReady(false); }, []);
  const markReady = useCallback(() => setReady(true), []);
  const degrade = useCallback(() => {
    setQuality(current => current === "high" ? "medium" : current === "medium" ? "low" : null);
  }, []);

  const promote = useCallback(() => setQuality(current => current === "medium" ? "high" : current), []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const noHover = window.matchMedia("(hover: none)");
    const touch = window.matchMedia("(pointer: coarse)");

    let supported: boolean | null = null;
    const evaluate = () => {
      const connection = "connection" in navigator ? navigator.connection : null;
      const saveData = typeof connection === "object" && connection !== null && "saveData" in connection && connection.saveData === true;
      if (reduced.matches || (touch.matches && noHover.matches) || saveData) {
        setQuality(null);
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
      setQuality(supported ? touch.matches ? "low" : "medium" : null);
      setReady(false);
    };
    const frame = requestAnimationFrame(evaluate);
    for (const media of [reduced, noHover, touch]) media.addEventListener("change", evaluate);
    return () => {
      cancelAnimationFrame(frame);
      for (const media of [reduced, noHover, touch]) media.removeEventListener("change", evaluate);
    };
  }, []);

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

  // A failed or slow renderer always leaves a complete recognizable portrait.
  useEffect(() => {
    if (!quality || ready || failed || !visible || !tabVisible) return;
    const timeout = window.setTimeout(fail, 12000);
    return () => window.clearTimeout(timeout);
  }, [quality, ready, failed, visible, tabVisible, fail]);

  // Keep an initialized scene mounted offscreen, but stop its frame loop.
  const shouldRender = quality !== null && !failed && initialized;

  return <div ref={host} className={`hologram-art ${ready && quality && !failed ? "hologram-ready" : ""}`} role="group" aria-label="Interactive digital identity of Dilshan Beligala" data-revealed={reveal.requested} data-quality={quality ?? "static"}>
    <div className="hologram-halo" aria-hidden="true" />
    <div className="hologram-reticle" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="hologram-fallback" aria-hidden="true">
      <motion.div className="portrait-static-layer" style={{ opacity: digitalOpacity }}><Image src={hologram.fallbackUrl} alt="" width={768} height={768} sizes="(max-width: 700px) 100vw, 56vw" priority draggable={false} /></motion.div>
      <motion.div className="portrait-static-layer" style={{ opacity: reveal.progress }}><Image src={hologram.realFallbackUrl} alt="" width={768} height={768} sizes="(max-width: 700px) 100vw, 56vw" priority draggable={false} /></motion.div>
    </div>
    {shouldRender && <div className="hologram-canvas" aria-hidden="true"><RenderBoundary onFailure={fail}><HologramScene pointer={pointer} reveal={reveal.progress} quality={quality} active={visible && tabVisible} onReady={markReady} onFailure={fail} onDegrade={degrade} onPromote={promote} /></RenderBoundary></div>}
    <button type="button" className="portrait-hold" disabled={!hydrated} aria-label="Hold to reveal Dilshan Beligala’s real portrait" aria-describedby={`${instructionId} ${keyboardHelpId}`} {...reveal.holdHandlers} />
    <p id={keyboardHelpId} className="sr-only">Hold Enter or Space to reveal. Release to return to the hologram. Alternatively, use the reveal toggle.</p>
    <div className="portrait-instructions" id={instructionId}>
      <span className="portrait-instruction-title" aria-live="polite">{reveal.requested ? "REAL IDENTITY" : <><span className="instruction-pointer">HOLD TO REVEAL</span><span className="instruction-touch">TOUCH & HOLD TO REVEAL</span></>}</span>
      <span className="portrait-instruction-copy">{reveal.requested ? reveal.latched ? "Use the toggle to return to the digital world." : "Release to return to the digital world." : "Discover the human behind the code."}</span>
      <button type="button" className="portrait-toggle" disabled={!hydrated} aria-pressed={reveal.latched} aria-label="Keep real portrait revealed" onClick={reveal.toggle} onBlur={event => { if (!host.current?.contains(event.relatedTarget)) reveal.reset(); }}>{reveal.latched ? <RotateCcw size={12} /> : <Eye size={12} />}<span>{reveal.latched ? "Return to hologram" : "Reveal without holding"}</span></button>
    </div>
    <div className="hologram-topline" aria-hidden="true"><span className="status-dot" /> DILSHAN // DIGITAL CONSCIOUSNESS</div>
    <div className="hologram-side-label" aria-hidden="true">HUMAN IMAGINATION.<br /><b>DIGITAL EXPRESSION.</b></div>
  </div>;
}
