"use client";

import { Fragment, useEffect, useRef } from "react";

type GlitchLine = { text: string; accents?: readonly number[] };
type Letter = {
  key: number;
  line: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  clipLeft: number;
  clipRight: number;
};
type Slot = { element: HTMLElement; planes: HTMLElement[]; animations: Animation[]; started: number };

const duration = 365;
const cooldown = 610;
const travelInterval = 64;
const approach = 6;

const channels: Keyframe[][] = [
  [
    { opacity: 0, transform: "translateX(0)", offset: 0 },
    { opacity: .78, transform: "translateX(3px)", offset: .16 },
    { opacity: .93, transform: "translateX(5px)", offset: .34 },
    { opacity: .58, transform: "translateX(2px)", offset: .57 },
    { opacity: .30, transform: "translateX(1px)", offset: .79 },
    { opacity: 0, transform: "translateX(0)", offset: 1 },
  ],
  [
    { opacity: 0, transform: "translateX(0)", offset: 0 },
    { opacity: .68, transform: "translateX(-3px)", offset: .19 },
    { opacity: .76, transform: "translateX(-4px)", offset: .38 },
    { opacity: .27, transform: "translateX(-1px)", offset: .61 },
    { opacity: 0, transform: "translateX(0)", offset: .81 },
    { opacity: 0, transform: "translateX(0)", offset: 1 },
  ],
  [
    { opacity: 0, transform: "translate(0, 0)", offset: 0 },
    { opacity: .84, transform: "translate(4px, -1px)", offset: .26 },
    { opacity: .66, transform: "translate(-3px, 1px)", offset: .43 },
    { opacity: .22, transform: "translate(1px, 0)", offset: .64 },
    { opacity: 0, transform: "translate(0, 0)", offset: 1 },
  ],
];

function measureLetters(lines: HTMLElement[]) {
  const letters: Letter[] = [];
  const range = document.createRange();
  for (const [line, element] of lines.entries()) {
    const bounds = element.getBoundingClientRect();
    const width = Number.parseFloat(getComputedStyle(element).width);
    const scale = width > 0 ? bounds.width / width : 1;
    const source = element.querySelector("[data-glitch-source]");
    if (!source || !scale) continue;
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      let offset = 0;
      for (const character of text.textContent ?? "") {
        const start = offset;
        offset += character.length;
        if (!character.trim()) continue;
        range.setStart(text, start);
        range.setEnd(text, offset);
        const box = range.getBoundingClientRect();
        letters.push({
          key: letters.length,
          line,
          left: box.left,
          right: box.right,
          top: bounds.top,
          bottom: bounds.bottom,
          clipLeft: (box.left - bounds.left) / scale,
          clipRight: (box.right - bounds.left) / scale,
        });
      }
    }
  }
  return letters;
}

function nearestLetter(letters: Letter[], event: PointerEvent) {
  let nearest: Letter | null = null;
  let distance = approach;
  for (const letter of letters) {
    if (event.clientY < letter.top || event.clientY >= letter.bottom) continue;
    const gap = Math.max(0, letter.left - event.clientX, event.clientX - letter.right);
    if (gap >= distance) continue;
    nearest = letter;
    distance = gap;
  }
  return nearest;
}

function LineText({ text, accents }: GlitchLine) {
  if (!accents?.length) return text;
  const ordered = [...new Set(accents)].filter(index => index >= 0 && index < text.length).sort((a, b) => a - b);
  return <>{ordered.map((index, position) => (
    <Fragment key={index}>
      {text.slice((ordered[position - 1] ?? -1) + 1, index)}
      <span className="name-accent">{text[index]}</span>
    </Fragment>
  ))}{text.slice((ordered.at(-1) ?? -1) + 1)}</>;
}

export function GlitchTypography({ lines, label }: { lines: readonly GlitchLine[]; label: string }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = heading.current;
    if (!element || typeof element.animate !== "function") return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const lineElements = [...element.querySelectorAll<HTMLElement>(":scope > .glitch-line")];
    const slots: Slot[][] = lineElements.map(line => [...line.querySelectorAll<HTMLElement>(".glitch-slot")].map(slot => ({
      element: slot, planes: [...slot.querySelectorAll<HTMLElement>(".glitch-plane")],
      animations: [], started: -Infinity,
    })));
    const lastPlayed = new Map<number, number>();
    let geometry: Letter[] = [];
    let dirty = true;
    let previous = -1;
    let last = -Infinity;
    let entered = !element.getAnimations().some(animation => animation.playState === "running" || animation.pending);

    function invalidate() { dirty = true; }
    function entranceEnd() { entered = true; invalidate(); }
    function leave() { previous = -1; }
    function reset() {
      leave();
      for (const line of slots) {
        for (const slot of line) {
          for (const animation of slot.animations) animation.cancel();
          slot.animations = [];
          slot.started = -Infinity;
        }
      }
      lastPlayed.clear();
      last = -Infinity;
      invalidate();
    }

    function move(event: PointerEvent) {
      if (!media.matches || event.pointerType !== "mouse" || event.buttons || !entered) return;
      if (dirty) {
        geometry = measureLetters(lineElements);
        dirty = false;
      }
      const letter = nearestLetter(geometry, event);
      if (!letter) return leave();
      if (previous === letter.key) return;
      previous = letter.key;
      const now = performance.now();
      if (now - last < travelInterval || now - (lastPlayed.get(letter.key) ?? -Infinity) < cooldown) return;

      const line = slots[letter.line];
      const slot = line.find(item => now - item.started >= duration)
        ?? (line[0].started < line[1].started ? line[0] : line[1]);
      for (const animation of slot.animations) animation.cancel();
      slot.started = now;
      slot.element.style.setProperty("--slice-left", `${letter.clipLeft}px`);
      slot.element.style.setProperty("--slice-right", `${letter.clipRight}px`);
      slot.animations = slot.planes.map((plane, index) =>
        plane.animate(channels[index], { duration, easing: "ease-out" }));
      lastPlayed.set(letter.key, now);
      last = now;
    }

    const resize = new ResizeObserver(invalidate);
    resize.observe(element);
    document.fonts?.addEventListener("loadingdone", invalidate);
    element.addEventListener("animationend", entranceEnd);
    element.addEventListener("animationcancel", entranceEnd);
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", invalidate, { passive: true, capture: true });
    window.addEventListener("resize", invalidate);
    window.addEventListener("blur", reset);
    media.addEventListener("change", reset);
    return () => {
      reset();
      resize.disconnect();
      document.fonts?.removeEventListener("loadingdone", invalidate);
      element.removeEventListener("animationend", entranceEnd);
      element.removeEventListener("animationcancel", entranceEnd);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", invalidate, true);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("blur", reset);
      media.removeEventListener("change", reset);
    };
  }, [lines]);

  return <h1 className="entrance name" aria-label={label} ref={heading}>
    {lines.map((line, index) => (
      <span className="glitch-line" key={index}>
        <span data-glitch-source><LineText {...line} /></span>
        {[0, 1].map(slot => <span className="glitch-slot" aria-hidden="true" key={slot}>
          <span className="glitch-plane glitch-plane-cyan" data-ink={line.text} />
          <span className="glitch-plane glitch-plane-violet" data-ink={line.text} />
          <span className="glitch-plane glitch-plane-pixel" data-ink={line.text} />
        </span>)}
      </span>
    ))}
  </h1>;
}
