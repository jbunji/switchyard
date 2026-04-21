"use client";

import { create } from "zustand";
import type { Layout, TurnoutState } from "@/lib/graph/types";
import { demoLayout } from "@/lib/graph/demo";

type Tool = "select" | "pan" | "place_track" | "place_turnout";

interface LayoutState {
  layout: Layout;
  selectedId: string | null;
  tool: Tool;
  viewport: { x: number; y: number; scale: number };
  setLayout: (layout: Layout) => void;
  setTool: (tool: Tool) => void;
  select: (id: string | null) => void;
  setViewport: (v: { x: number; y: number; scale: number }) => void;
  toggleTurnout: (nodeId: string) => void;
  setTurnoutState: (nodeId: string, state: TurnoutState) => void;
  toggleBlockOccupancy: (blockId: string) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  layout: demoLayout(),
  selectedId: null,
  tool: "select",
  viewport: { x: 0, y: 0, scale: 1 },
  setLayout: (layout) => set({ layout }),
  setTool: (tool) => set({ tool }),
  select: (id) => set({ selectedId: id }),
  setViewport: (viewport) => set({ viewport }),
  toggleTurnout: (nodeId) =>
    set((s) => ({
      layout: {
        ...s.layout,
        nodes: s.layout.nodes.map((n) =>
          n.id === nodeId && n.state
            ? { ...n, state: n.state === "normal" ? "diverging" : "normal" }
            : n,
        ),
        updatedAt: new Date().toISOString(),
      },
    })),
  setTurnoutState: (nodeId, state) =>
    set((s) => ({
      layout: {
        ...s.layout,
        nodes: s.layout.nodes.map((n) => (n.id === nodeId ? { ...n, state } : n)),
        updatedAt: new Date().toISOString(),
      },
    })),
  toggleBlockOccupancy: (blockId) =>
    set((s) => ({
      layout: {
        ...s.layout,
        blocks: s.layout.blocks.map((b) =>
          b.id === blockId ? { ...b, occupied: !b.occupied } : b,
        ),
        updatedAt: new Date().toISOString(),
      },
    })),
}));
