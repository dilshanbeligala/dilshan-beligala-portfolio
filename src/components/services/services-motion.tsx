"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ServicesMotion({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const items = root.querySelectorAll<HTMLElement>("[data-service-reveal]");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-service-revealed", "");
        observer.unobserve(entry.target);
      }
    }, { threshold: .12 });

    const update = () => {
      observer.disconnect();
      if (preference.matches) return;
      for (const item of items) {
        if (!item.hasAttribute("data-service-revealed")) observer.observe(item);
      }
    };
    update();
    preference.addEventListener("change", update);
    return () => {
      preference.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return <section id="services" ref={section} className="services-section" aria-labelledby="services-heading">
    {children}
  </section>;
}
