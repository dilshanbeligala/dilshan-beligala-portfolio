"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { HolographicPortrait } from "./hologram/holographic-portrait";
import type { PointerTarget } from "@/lib/hologram/config";

export function HeroStage({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const pointer = useRef<PointerTarget>({ x: 0, y: 0 });
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => element.classList.toggle("is-paused", !entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <section ref={section} id="home" className="hero" onPointerMove={event => {
    if (reduced || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    pointer.current.x = Math.max(-1, Math.min(1, (px / rect.width - .5) * 2));
    pointer.current.y = Math.max(-1, Math.min(1, (.5 - py / rect.height) * 2));
    event.currentTarget.style.setProperty("--pointer-x", `${px}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${py}px`);
  }} onPointerLeave={() => { pointer.current.x = 0; pointer.current.y = 0; }}>
    <div className="hero-grid" aria-hidden="true" />
    <div className="cursor-aura" aria-hidden="true" />
    <div className="particles" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 19 + 13) % 100}%`, animationDelay: `-${i * 1.7}s` }} />)}</div>
    <div className="hero-index" aria-hidden="true">INDEPENDENT MIND. CONNECTED WORLD.</div>
    <div className="hologram-container"><HolographicPortrait pointer={pointer} /></div>
    {children}
  </section>;
}
