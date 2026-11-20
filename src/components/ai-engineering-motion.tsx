"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function AiEngineeringMotion({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = section.current;
    const list = root?.querySelector<HTMLOListElement>(".ai-workflow");
    if (!root || !list) return;
    const workflow = list;
    const stages = Array.from(workflow.querySelectorAll<HTMLLIElement>(":scope > li"));
    const items = root.querySelectorAll<HTMLElement>("[data-ai-reveal]");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");

    function enableMotion() {
      if (preference.matches) return;
      const controller = new AbortController();
      const { signal } = controller;
      const reveals = new IntersectionObserver(entries => {
        for (const entry of entries) {
          entry.target.toggleAttribute("data-ai-in-view", entry.isIntersecting);
        }
      }, { threshold: .12 });
      for (const item of items) reveals.observe(item);

      let frame = 0;
      let active = -1;
      let centers: number[] = [];
      function draw() {
        frame = 0;
        const box = workflow.getBoundingClientRect();
        const readingLine = window.innerHeight * .64 - box.top;
        const first = centers[0] ?? 0;
        const last = centers.at(-1) ?? 0;
        const progress = Math.max(0, Math.min(1, (readingLine - first) / Math.max(1, last - first)));
        workflow.style.setProperty("--ai-progress", String(progress));
        const next = centers.findLastIndex(center => center <= readingLine);
        if (active === next) return;
        stages[active]?.removeAttribute("data-ai-active");
        stages[next]?.setAttribute("data-ai-active", "");
        active = next;
      }
      function queue() {
        if (!frame) frame = requestAnimationFrame(draw);
      }
      function measure() {
        centers = stages.map(stage => stage.offsetTop + Math.min(stage.offsetHeight / 2, 34));
        queue();
      }
      const layout = new ResizeObserver(measure);
      layout.observe(workflow);
      // Subscribe to scrolling only while the workflow is close to the viewport.
      const visibility = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) window.addEventListener("scroll", queue, { passive: true, signal });
        else window.removeEventListener("scroll", queue);
        queue();
      }, { rootMargin: "120px" });
      visibility.observe(workflow);
      measure();

      return () => {
        controller.abort();
        layout.disconnect();
        visibility.disconnect();
        reveals.disconnect();
        cancelAnimationFrame(frame);
        workflow.style.removeProperty("--ai-progress");
        stages[active]?.removeAttribute("data-ai-active");
        for (const item of items) item.removeAttribute("data-ai-in-view");
      };
    }

    let cleanup = enableMotion();
    function update() {
      cleanup?.();
      cleanup = enableMotion();
    }
    preference.addEventListener("change", update);
    return () => {
      preference.removeEventListener("change", update);
      cleanup?.();
    };
  }, []);

  return <section ref={section} id="ai-engineering" className="ai-engineering" data-constellation="ai" aria-labelledby="ai-engineering-heading">{children}</section>;
}
