"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { hologram, type PointerTarget, type Quality } from "@/lib/hologram/config";

const HologramScene = dynamic(() => import("./hologram-scene"), { ssr: false });

class RenderBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function HolographicPortrait({ pointer }: { pointer: RefObject<PointerTarget> }) {
  const host = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 700px)");
    const touch = window.matchMedia("(pointer: coarse)");
    const wide = window.matchMedia("(min-width: 1600px)");
    let supported: boolean | null = null;
    const evaluate = () => {
      if (reduced.matches || mobile.matches) {
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
      setQuality(supported ? touch.matches ? "low" : wide.matches ? "high" : "medium" : null);
      setReady(false);
    };
    const frame = requestAnimationFrame(evaluate);
    for (const media of [reduced, mobile, touch, wide]) media.addEventListener("change", evaluate);
    return () => {
      cancelAnimationFrame(frame);
      for (const media of [reduced, mobile, touch, wide]) media.removeEventListener("change", evaluate);
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

  return <div ref={host} className={`hologram-art ${ready && quality && !failed ? "hologram-ready" : ""}`} role="img" aria-label="Holographic particle portrait of Dilshan Beligala, reconstructed from his photograph" data-quality={quality ?? "static"}>
    <div className="hologram-halo" aria-hidden="true" />
    <div className="hologram-reticle" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="hologram-fallback"><Image src={hologram.fallbackUrl} alt="" width={768} height={768} sizes="(max-width: 700px) 100vw, 56vw" priority /></div>
    {shouldRender && <div className="hologram-canvas" aria-hidden="true"><RenderBoundary onFailure={fail}><HologramScene pointer={pointer} quality={quality} active={visible && tabVisible} onReady={markReady} onFailure={fail} onDegrade={degrade} /></RenderBoundary></div>}
    <div className="hologram-topline" aria-hidden="true"><span className="status-dot" /> DILSHAN // DIGITAL CONSCIOUSNESS</div>
    <div className="hologram-side-label" aria-hidden="true">HUMAN IMAGINATION.<br /><b>DIGITAL EXPRESSION.</b></div>
    <div className="hologram-caption" aria-hidden="true"><span>PORTRAIT STUDY / 01</span><span>IDENTITY, REIMAGINED <i>↗</i></span></div>
  </div>;
}
