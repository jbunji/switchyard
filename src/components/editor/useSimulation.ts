"use client";

import { useEffect, useRef } from "react";
import { useLayoutStore } from "@/lib/store/layout";

export function useSimulation() {
  const simulating = useLayoutStore((s) => s.simulating);
  const simSpeed = useLayoutStore((s) => s.simSpeed);
  const tick = useLayoutStore((s) => s.tickSim);

  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!simulating) {
      lastRef.current = null;
      return;
    }
    let raf = 0;
    const step = (now: number) => {
      const last = lastRef.current ?? now;
      const dt = Math.min(0.05, ((now - last) / 1000) * simSpeed);
      lastRef.current = now;
      tick(dt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [simulating, simSpeed, tick]);
}
