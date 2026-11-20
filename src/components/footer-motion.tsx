"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { footerTypographyProfile, packTypography, wordMotionLimits, type WordPlacement } from "@/lib/typography-layout";

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const ease = (value: number) => {
  const v = clamp(value);
  return v * v * (3 - 2 * v);
};

export function FooterMotion({ children }: { children: ReactNode }) {
  const footer = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = footer.current;
    const field = root?.querySelector<HTMLElement>(".footer-word-field");
    if (!root || !field) return;
    const nodes = [...field.querySelectorAll<HTMLElement>(".footer-word")];
    const identity = root.querySelector<HTMLElement>(".footer-identity-heading");
    const ring = root.querySelector<SVGCircleElement>(".footer-progress-value");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const controller = new AbortController();
    const { signal } = controller;
    let placements: WordPlacement[] = [];
    let measuredWidth = 0;
    let measuredHeight = 0;
    let frame = 0;
    let visible = false;
    let scrolling = false;
    let fieldVisible = false;
    let dirty = true;
    let clock = 0;
    let last = 0;
    let reveal = 1;
    let recede = 0;
    let fieldBox: DOMRect;
    let pointer: { x: number; y: number } | null = null;
    const offsets = nodes.map(() => ({ x: 0, y: 0, focus: 0 }));

    function queue() {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function layout(force = false) {
      if (signal.aborted || !field) return;
      const width = field.clientWidth;
      const height = field.clientHeight;
      if (!force && width === measuredWidth && height === measuredHeight) return;
      measuredWidth = width;
      measuredHeight = height;
      const { count, gap, displacement } = footerTypographyProfile(width);
      const candidates = nodes.slice(0, count);
      let sizes: { width: number; height: number }[] = [];
      // Fit the full desktop collection within the shorter field. Smaller
      // viewports keep their readable type scale and responsive word count.
      for (const scale of count === 50 ? [1, .88, .76] : [1]) {
        field.style.setProperty("--footer-word-scale", String(scale));
        sizes = candidates.map(node => ({ width: node.offsetWidth, height: node.offsetHeight }));
        placements = packTypography(sizes, { width, height }, gap, displacement);
        if (placements.length === candidates.length) break;
      }
      resetTransforms();
      for (const node of nodes) node.removeAttribute("data-placed");
      for (const word of placements) {
        const node = nodes[word.index];
        node.style.left = `${word.x - sizes[word.index].width / 2}px`;
        node.style.top = `${word.y - sizes[word.index].height / 2}px`;
        node.setAttribute("data-placed", "");
      }
      field.dataset.packed = "";
      field.dataset.gap = String(gap);
      dirty = true;
      queue();
    }

    function resetTransforms() {
      for (const node of nodes) {
        node.style.removeProperty("transform");
        node.style.removeProperty("opacity");
        node.style.removeProperty("--word-glow");
      }
    }

    function draw(now: number) {
      frame = 0;
      if (!field || !visible || document.hidden) return;
      const dt = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now;
      if (dirty) {
        fieldBox = field.getBoundingClientRect();
        const height = window.innerHeight;
        fieldVisible = fieldBox.bottom > 0 && fieldBox.top < height;
        reveal = ease((height - fieldBox.top) / Math.max(1, Math.min(height * .66, fieldBox.height)));
        recede = ease((height * .35 - fieldBox.bottom) / (height * .52));
        const maxScroll = document.documentElement.scrollHeight - height;
        ring?.style.setProperty("stroke-dashoffset", String(100 * (1 - clamp(window.scrollY / Math.max(1, maxScroll)))));
        if (identity && !motion.matches) {
          const intro = ease((height - (identity.parentElement?.getBoundingClientRect().top ?? height)) / (height * .35));
          identity.style.setProperty("--identity-shift", `${(1 - intro) * 18}px`);
        }
        dirty = false;
      }
      if (motion.matches || !fieldVisible) {
        last = 0;
        return;
      }

      clock += dt;
      const damping = 1 - Math.exp(-dt * 9);
      for (const word of placements) {
        const node = nodes[word.index];
        const offset = offsets[word.index];
        const phase = word.index * 2.39996;
        const tier = node.dataset.tier;
        const layer = tier === "front" ? 1 : tier === "middle" ? .75 : .5;
        const dx = pointer ? word.x - (pointer.x - fieldBox.left) : 0;
        const dy = pointer ? word.y - (pointer.y - fieldBox.top) : 0;
        const distance = Math.hypot(dx, dy);
        const radius = clamp(fieldBox.width * .22, 165, 260);
        const targetFocus = pointer && finePointer.matches ? 1 - ease((distance - 28) / radius) : 0;
        offset.focus += (targetFocus - offset.focus) * damping;
        const influence = offset.focus;
        offset.x += (dx / Math.max(32, distance) * influence - offset.x) * damping;
        offset.y += (dy / Math.max(32, distance) * influence - offset.y) * damping;
        const entry = ease((reveal - (word.index % 8) * .048) / .66);
        const wave = clock * (.48 + layer * .22) + phase;
        const travel = word.displacement;
        const x = clamp(travel * (Math.cos(wave) * .42 * layer + offset.x * .6), -travel, travel);
        const y = clamp(travel * (Math.sin(wave * .76 + phase) * .40 + offset.y * .55 + (1 - entry) * .52 - recede * .32), -travel, travel);
        const depth = clamp((entry - 1) * 9 + Math.sin(wave) * 3 + influence * 8 - recede * 6, -12, 12);
        const tilt = Math.sin(wave * .6) * wordMotionLimits.rotation * layer;
        const yaw = Math.cos(wave * .7) * wordMotionLimits.yaw * layer;
        const scale = 1 + Math.cos(wave * .8) * .012 + influence * .023;
        node.style.transform = `translate3d(${x}px,${y}px,0) perspective(${wordMotionLimits.perspective}px) translateZ(${depth}px) rotateZ(${tilt}deg) rotateY(${yaw}deg) scale(${scale})`;
        node.style.opacity = String((.24 + entry * .76) * (1 - recede * .28));
        node.style.setProperty("--word-glow", `${Math.round(influence * 100)}%`);
      }
      queue();
    }

    function scroll() {
      dirty = true;
      queue();
    }

    function visibility() {
      last = 0;
      cancelAnimationFrame(frame);
      frame = 0;
      scroll();
    }

    function motionChange() {
      pointer = null;
      identity?.style.removeProperty("--identity-shift");
      resetTransforms();
      visibility();
    }

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !scrolling) {
        window.addEventListener("scroll", scroll, { passive: true, signal });
        scrolling = true;
      } else if (!visible && scrolling) {
        window.removeEventListener("scroll", scroll);
        scrolling = false;
      }
      visibility();
    });
    intersection.observe(root);
    const resize = new ResizeObserver(() => layout());
    resize.observe(field);
    field.addEventListener("pointermove", event => {
      if (event.pointerType === "mouse" && finePointer.matches && !motion.matches) {
        pointer = { x: event.clientX, y: event.clientY };
      }
    }, { passive: true, signal });
    field.addEventListener("pointerleave", () => { pointer = null; }, { signal });
    window.addEventListener("resize", scroll, { passive: true, signal });
    document.addEventListener("visibilitychange", visibility, { signal });
    const measureFonts = () => layout(true);
    document.fonts.addEventListener("loadingdone", measureFonts, { signal });
    document.fonts.ready.then(measureFonts);
    motion.addEventListener("change", motionChange, { signal });
    layout();

    return () => {
      controller.abort();
      intersection.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return <footer ref={footer} className="engineering-footer" aria-labelledby="footer-identity-name">{children}</footer>;
}
