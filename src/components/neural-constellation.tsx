"use client";

import { useEffect, useRef } from "react";
import { watchResolvedTheme } from "./theme-provider";
import { effectPalettes } from "@/lib/theme-effects";
import {
  constellationProfiles, createConstellation,
  type ConstellationRegion, type Point, type RegionBand, type SafeBox,
} from "@/lib/constellation";

const selectableText = "h1, h2, h3, h4, h5, h6, p, li, pre, code, blockquote";
const cursorAction = "a, button, summary, [role='button'], [role='link'], .name";
const nativeCursor = "input, textarea, select, label, [contenteditable]:not([contenteditable='false']), dialog:modal";
const protectedBlocks = [
  "a", "button", "input", "textarea", "select", "label", "img", "video",
  ".portrait-instructions", ".engineering-stat", ".home-project-card",
  ".about-project", ".about-hero-stats", ".tags", ".hero-index", ".hero-bottom", ".site-header",
].join(", ");

export function NeuralConstellation() {
  const surface = useRef<HTMLCanvasElement>(null);
  const pointerRing = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = surface.current;
    const ring = pointerRing.current;
    if (!canvas || !ring) return;
    const root = document.documentElement;
    const context = canvas.getContext("2d");
    const model = context ? createConstellation(context) : null;
    const precise = matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const forcedColors = matchMedia("(forced-colors: active)");
    let pointer: Point | null = null;
    let target: Element | null = null;
    let frame = 0;
    let previous = 0;
    let dirty = true;
    let hitTest = false;
    let lastMove = -Infinity;
    let main: HTMLElement | null = null;
    let portrait: HTMLElement | null = null;
    let safe: SafeBox[] = [];
    let face: SafeBox | null = null;
    let bands: RegionBand[] = [];
    const listeners = new AbortController();
    const { signal } = listeners;

    function interactive() {
      return precise.matches && !reduced.matches && !forcedColors.matches;
    }

    function queue() {
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function invalidate() {
      dirty = true;
      hitTest = true;
      queue();
    }

    function hideCursor() {
      root.removeAttribute("data-white-pointer");
      ring?.removeAttribute("data-expanded");
    }

    function leave() {
      pointer = null;
      target = null;
      lastMove = -Infinity;
      hideCursor();
      queue();
    }

    function paintCursor() {
      const action = target?.closest(cursorAction);
      if (!ring || !pointer || !target || !interactive() || target.closest(nativeCursor)
        || (!action && target.closest(selectableText))) {
        hideCursor();
        return;
      }
      ring.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      ring.toggleAttribute("data-expanded", Boolean(action));
      root.setAttribute("data-white-pointer", "");
    }

    function measure(x: number, y: number) {
      bands = Array.from(document.querySelectorAll<HTMLElement>("[data-constellation]"), section => {
        const rect = section.getBoundingClientRect();
        const region = section.dataset.constellation as ConstellationRegion;
        return { top: rect.top + y, bottom: rect.bottom + y, region };
      }).filter(band => Object.hasOwn(constellationProfiles, band.region));
      const visual = portrait?.querySelector(".hologram-visual")?.getBoundingClientRect();
      face = visual && visual.width && visual.height ? {
        left: x + visual.left + visual.width * .19,
        right: x + visual.right - visual.width * .13,
        top: y + visual.top + visual.height * .03,
        bottom: y + visual.bottom - visual.height * .03,
      } : null;
      safe = [];
      const range = document.createRange();
      function protect(rect: DOMRect, pad: number) {
        if (!rect.width || !rect.height) return;
        safe.push({ left: x + rect.left - pad, right: x + rect.right + pad,
          top: y + rect.top - pad, bottom: y + rect.bottom + pad });
      }
      for (const block of document.querySelectorAll(protectedBlocks)) {
        if (!block.closest(".hologram-fallback, .portrait-hold")) protect(block.getBoundingClientRect(), 6);
      }
      for (const element of document.querySelectorAll(selectableText)) {
        if (element.closest(protectedBlocks) || element.closest(".sr-only")) continue;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.textContent?.trim() || node.parentElement?.closest(selectableText) !== element
            || node.parentElement.closest(protectedBlocks)) continue;
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) protect(rect, 5);
        }
      }
    }

    function draw(now: number) {
      frame = 0;
      const width = root.clientWidth;
      const height = window.innerHeight;
      const x = window.scrollX;
      const y = window.scrollY;
      if (dirty) {
        measure(x, y);
        dirty = false;
      }
      if (hitTest) {
        target = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null;
        paintCursor();
        hitTest = false;
      }
      if (!model || !canvas || !context) return;
      const enabled = interactive();
      const dpr = Math.min(devicePixelRatio || 1, enabled ? 1.5 : 1);
      const bitmapWidth = Math.round(width * dpr);
      const bitmapHeight = Math.round(height * dpr);
      if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
        canvas.width = bitmapWidth;
        canvas.height = bitmapHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dt = previous ? Math.max(.001, Math.min((now - previous) / 1000, .04)) : 1 / 60;
      const reveal = portrait?.dataset.revealed === "true" && target?.closest(".hero");
      const activePointer = enabled && !reveal ? pointer : null;
      const canSignal = now - lastMove < 550;
      const settling = model.draw({ x, y, width, height }, activePointer, bands, safe, face, dt, now, canSignal, enabled);
      if (settling) {
        previous = now;
        queue();
      } else {
        previous = 0;
      }
    }

    function track(event: PointerEvent) {
      if (event.pointerType !== "mouse") {
        if (pointer) leave();
        return;
      }
      if (!interactive()) return;
      pointer = { x: event.clientX, y: event.clientY };
      hitTest = true;
      lastMove = performance.now();
      queue();
    }

    const resizeObserver = new ResizeObserver(invalidate);
    const revealObserver = new MutationObserver(queue);
    function connectPage() {
      const next = document.querySelector("main");
      if (main === next && main) return;
      if (main) resizeObserver.unobserve(main);
      main = next;
      if (main) resizeObserver.observe(main);
      revealObserver.disconnect();
      portrait = document.querySelector<HTMLElement>(".hologram-art");
      if (portrait) revealObserver.observe(portrait, { attributes: true, attributeFilter: ["data-revealed"] });
      invalidate();
    }
    const routeObserver = new MutationObserver(connectPage);
    routeObserver.observe(document.body, { childList: true, subtree: true });
    connectPage();
    resizeObserver.observe(document.body);

    window.addEventListener("pointermove", track, { passive: true, signal });
    window.addEventListener("pointerdown", event => {
      if (event.pointerType !== "mouse" && pointer) leave();
    }, { passive: true, signal });
    window.addEventListener("pointerout", event => {
      if (!event.relatedTarget) leave();
    }, { passive: true, signal });
    window.addEventListener("pointercancel", leave, { signal });
    window.addEventListener("blur", leave, { signal });
    window.addEventListener("scroll", () => {
      hitTest = true;
      lastMove = -Infinity;
      queue();
    }, { passive: true, signal });
    window.addEventListener("resize", invalidate, { signal });
    document.addEventListener("animationend", event => {
      if (event.target instanceof Element && event.target.matches(".entrance")) invalidate();
    }, { signal });
    document.fonts.addEventListener("loadingdone", invalidate, { signal });
    document.fonts.ready.then(() => { if (!signal.aborted) invalidate(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        leave();
        cancelAnimationFrame(frame);
        frame = previous = 0;
      } else invalidate();
    }, { signal });
    for (const query of [precise, reduced, forcedColors]) query.addEventListener("change", leave, { signal });
    const unwatch = watchResolvedTheme(theme => {
      model?.setPalette(effectPalettes[theme].field);
      queue();
    });
    return () => {
      unwatch();
      listeners.abort();
      resizeObserver.disconnect();
      routeObserver.disconnect();
      revealObserver.disconnect();
      cancelAnimationFrame(frame);
      hideCursor();
    };
  }, []);

  return <>
    <canvas ref={surface} className="constellation-surface" width={1} height={1} aria-hidden="true" />
    <span ref={pointerRing} className="white-pointer" aria-hidden="true" />
  </>;
}
