"use client";
import { useRef, type ComponentProps } from "react";

export function MagneticLink({ children, ...props }: ComponentProps<"a">) {
  const link = useRef<HTMLAnchorElement>(null);
  return <a {...props} ref={link} onPointerMove={event => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.translate = `${(event.clientX - rect.left - rect.width / 2) * .1}px ${(event.clientY - rect.top - rect.height / 2) * .15}px`;
  }} onPointerLeave={() => { if (link.current) link.current.style.translate = "0px 0px"; }} onBlur={() => { if (link.current) link.current.style.translate = "0px 0px"; }}>{children}</a>;
}
