"use client";

import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { animate, useMotionValue } from "motion/react";

type InputState = { held: boolean; latched: boolean };
type Action = "hold" | "release" | "toggle" | "reset";
function reducer(state: InputState, action: Action): InputState {
  switch (action) {
    case "hold": return { held: true, latched: false };
    case "release": return { ...state, held: false };
    case "toggle": return { held: false, latched: !state.latched };
    case "reset": return { held: false, latched: false };
  }
}

function subscribeReducedMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const reducedMotionSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One interruptible progress value for GPU uniforms and static-layer opacity. */
export function usePortraitReveal() {
  const [input, dispatch] = useReducer(reducer, { held: false, latched: false });
  const progress = useMotionValue(0);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const pointerId = useRef<number | null>(null);
  const key = useRef<string | null>(null);
  const requested = input.held || input.latched;

  useEffect(() => {
    const target = requested ? 1 : 0;
    const distance = Math.abs(target - progress.get());
    const animation = animate(progress, target, {
      duration: reduced ? 0 : distance * (requested ? .4 : .55),
      ease: [0.22, 0.61, 0.36, 1],
    });
    return () => animation.stop();
  }, [requested, progress, reduced]);

  const reset = useCallback(() => {
    pointerId.current = null;
    key.current = null;
    dispatch("reset");
  }, []);

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) { reset(); progress.stop(); progress.set(0); }
    };
    const release = () => {
      if (pointerId.current !== null) { pointerId.current = null; dispatch("release"); }
    };
    window.addEventListener("blur", reset);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", reset);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reset, progress]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || pointerId.current !== null) return;
    key.current = null;
    pointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch("hold");
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    dispatch("release");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (event.repeat || key.current !== null) return;
    pointerId.current = null;
    key.current = event.key;
    dispatch("hold");
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== key.current) return;
    event.preventDefault();
    key.current = null;
    dispatch("release");
  };
  return {
    progress, requested, latched: input.latched, reset,
    toggle: () => { pointerId.current = null; key.current = null; dispatch("toggle"); },
    holdHandlers: {
      onPointerDown, onPointerUp, onPointerCancel: reset,
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => {
        if (pointerId.current === event.pointerId) { pointerId.current = null; dispatch("release"); }
      },
      onKeyDown, onKeyUp, onBlur: reset,
      onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
      onDragStart: (event: React.DragEvent<HTMLButtonElement>) => event.preventDefault(),
    },
  };
}
