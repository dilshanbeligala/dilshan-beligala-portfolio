"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import { ThemeSwitcher } from "./theme-switcher";
import { MagneticLink } from "./magnetic-link";
import { navigation } from "@/lib/portfolio";

export function SiteHeader({ page = "home" }: { page?: "home" | "about" }) {
  const [active, setActive] = useState<string>(page);
  const current = page === "about" ? undefined : active;
  const href = (id: string) => `${page === "about" ? "/" : ""}#${id}`;
  const ariaCurrent = (id: string) => current === id ? "location" : undefined;
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (page === "about") return;
    const update = () => {
      const activationLine = window.innerHeight * .35;
      let closestTop = -Infinity;
      let activeId = "home";
      for (const { id } of navigation) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= activationLine && top > closestTop) {
          closestTop = top;
          activeId = id;
        }
      }
      setActive(activeId);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [page]);
  useEffect(() => {
    if (!open) return;
    const menu = dialog.current;
    const trigger = toggle.current;
    menu?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const media = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => {
      menu?.close();
      document.body.style.overflow = previous;
      trigger?.focus({ preventScroll: true });
      media.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);
  return <>
    <header className="site-header">
      <a className="brand" href={href("home")} aria-label="Dilshan Beligala home"><span className="monogram">d<span>b</span><i /></span><span className="brand-name">Dilshan Beligala<span>SOFTWARE ENGINEER</span></span></a>
      <nav className="desktop-nav" aria-label="Main navigation">{navigation.filter(item => item.id !== "resume").map(item=><a key={item.id} href={href(item.id)} aria-current={ariaCurrent(item.id)} className={current === item.id ? "active" : undefined}>{item.label}</a>)}</nav>
      <div className="header-actions">
        <ThemeSwitcher placement="desktop" />
        <MagneticLink className="header-cta magnetic" href={href("contact")}>Let’s Connect <ArrowUpRight size={15} /></MagneticLink>
      </div>
      <button ref={toggle} className="menu-toggle" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>setOpen(true)}><span /><span /></button>
      <noscript><nav className="no-script-nav" aria-label="Navigation without JavaScript">{navigation.map(item=><a key={item.id} href={href(item.id)}>{item.label}</a>)}</nav></noscript>
    </header>
    <dialog ref={dialog} id="mobile-navigation" className="mobile-menu" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} aria-label="Mobile navigation">
      <div className="mobile-top"><span className="eyebrow">DILSHAN BELIGALA / MENU</span><button className="menu-toggle is-open" aria-label="Close navigation" onClick={()=>setOpen(false)}><span /><span /></button></div>
      <nav aria-label="Mobile navigation">{navigation.map((item,index)=><a style={{ animationDelay: `${index * 45}ms` }} key={item.id} href={href(item.id)} aria-current={ariaCurrent(item.id)} onClick={() => {
        // Restore page scrolling before the browser follows the fragment.
        flushSync(() => setOpen(false));
      }}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}<ArrowUpRight size={21} /></a>)}</nav>
      <ThemeSwitcher placement="mobile" />
      <p className="eyebrow mobile-menu-caption">ENGINEERING × IMAGINATION</p>
    </dialog>
  </>;
}
