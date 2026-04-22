"use client";

import { useEffect, useRef } from "react";
import { LayoutSchema, type Layout } from "@/lib/graph/types";
import { useLayoutStore } from "./layout";

const KEY = "switchyard.layout.v1";

export function useAutosave() {
  const layout = useLayoutStore((s) => s.layout);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const loadedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = LayoutSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        setLayout(parsed.data, false);
      }
    } catch {
      // noop — corrupt storage is harmless; demo layout stays
    }
  }, [setLayout]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(layout));
      } catch {
        // quota exceeded or unavailable — best-effort
      }
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [layout]);
}

export function downloadLayoutJson(layout: Layout) {
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (layout.name || "layout").replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  a.download = `switchyard-${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadLayoutJson(file: File): Promise<Layout | null> {
  try {
    const text = await file.text();
    const parsed = LayoutSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
