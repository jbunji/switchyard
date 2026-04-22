"use client";

import { create } from "zustand";
import type { Layout, NodeType, TrackEdge, TrackNode, TurnoutState } from "@/lib/graph/types";
import { demoLayout } from "@/lib/graph/demo";
import { generateCity } from "@/lib/graph/generator";
import { tickSimulation } from "@/lib/graph/simulation";
import {
  addEdge as addEdgeOp,
  addNode as addNodeOp,
  createEdge,
  createNode,
  defaultBlockId,
  emptyLayout,
  removeEdge as removeEdgeOp,
  removeNodeWithEdges,
  updateBlock as updateBlockOp,
  updateEdge as updateEdgeOp,
  updateNode as updateNodeOp,
} from "@/lib/graph/ops";
import type { Block, Train } from "@/lib/graph/types";

export type Tool =
  | "select"
  | "pan"
  | "place_straight"
  | "place_turnout_left"
  | "place_turnout_right"
  | "delete";

export type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface Cursor {
  worldX: number;
  worldY: number;
  snappedX: number;
  snappedY: number;
  snapTargetId: string | null;
}

interface DrawState {
  fromNodeId: string | null;
}

interface LayoutState {
  layout: Layout;
  selection: Selection;
  tool: Tool;
  viewport: Viewport;
  cursor: Cursor;
  draw: DrawState;
  ghostRotation: number;
  gridSize: number;
  gridEnabled: boolean;
  snapEnabled: boolean;
  snapRadius: number;
  simulating: boolean;
  simSpeed: number;
  past: Layout[];
  future: Layout[];
  setLayout: (layout: Layout, pushHistory?: boolean) => void;
  setTool: (tool: Tool) => void;
  select: (s: Selection) => void;
  setViewport: (v: Viewport) => void;
  setCursor: (c: Cursor) => void;
  setDrawFrom: (id: string | null) => void;
  setGhostRotation: (deg: number) => void;
  rotateGhost: (delta: number) => void;
  setGridEnabled: (v: boolean) => void;
  setSnapEnabled: (v: boolean) => void;
  toggleTurnout: (nodeId: string) => void;
  setTurnoutState: (nodeId: string, state: TurnoutState) => void;
  toggleBlockOccupancy: (blockId: string) => void;
  placeNode: (type: NodeType, x: number, y: number) => TrackNode;
  connectNodes: (fromId: string, toId: string) => TrackEdge | null;
  placeEndpointAndConnect: (fromId: string, x: number, y: number) => TrackEdge | null;
  deleteSelection: () => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodeRotation: (nodeId: string, rotation: number) => void;
  rotateSelectedNode: (delta: number) => void;
  updateEdgeBlock: (edgeId: string, blockId: string) => void;
  updateEdgeCurve: (edgeId: string, curve: number) => void;
  updateBlock: (blockId: string, patch: Partial<Block>) => void;
  addBlock: () => void;
  undo: () => void;
  redo: () => void;
  resetLayout: () => void;
  loadDemo: () => void;
  loadCity: () => void;
  setSimulating: (v: boolean) => void;
  setSimSpeed: (v: number) => void;
  tickSim: (dt: number) => void;
  setTrainVelocity: (trainId: string, velocity: number) => void;
  setTrainPriority: (trainId: string, priority: number) => void;
  toggleTrainPaused: (trainId: string) => void;
}

const HISTORY_LIMIT = 100;

function pushPast(past: Layout[], layout: Layout): Layout[] {
  const next = [...past, layout];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  layout: demoLayout(),
  selection: null,
  tool: "select",
  viewport: { x: 0, y: 0, scale: 1 },
  cursor: { worldX: 0, worldY: 0, snappedX: 0, snappedY: 0, snapTargetId: null },
  draw: { fromNodeId: null },
  ghostRotation: 0,
  gridSize: 20,
  gridEnabled: true,
  snapEnabled: true,
  snapRadius: 18,
  simulating: false,
  simSpeed: 1,
  past: [],
  future: [],

  setLayout: (layout, pushHistory = true) =>
    set((s) => ({
      layout,
      past: pushHistory ? pushPast(s.past, s.layout) : s.past,
      future: pushHistory ? [] : s.future,
    })),

  setTool: (tool) =>
    set((s) => ({ tool, draw: { fromNodeId: null }, selection: tool === "select" ? s.selection : null })),
  select: (selection) => set({ selection }),
  setViewport: (viewport) => set({ viewport }),
  setCursor: (cursor) => set({ cursor }),
  setDrawFrom: (id) => set({ draw: { fromNodeId: id } }),
  setGhostRotation: (deg) => set({ ghostRotation: normalizeDeg(deg) }),
  rotateGhost: (delta) => set((s) => ({ ghostRotation: normalizeDeg(s.ghostRotation + delta) })),
  setGridEnabled: (v) => set({ gridEnabled: v }),
  setSnapEnabled: (v) => set({ snapEnabled: v }),

  toggleTurnout: (nodeId) =>
    set((s) => {
      const node = s.layout.nodes.find((n) => n.id === nodeId);
      if (!node || !node.state) return {};
      const next = node.state === "normal" ? "diverging" : "normal";
      return {
        layout: updateNodeOp(s.layout, nodeId, { state: next }),
        past: pushPast(s.past, s.layout),
        future: [],
      };
    }),

  setTurnoutState: (nodeId, state) =>
    set((s) => ({
      layout: updateNodeOp(s.layout, nodeId, { state }),
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  toggleBlockOccupancy: (blockId) =>
    set((s) => {
      const block = s.layout.blocks.find((b) => b.id === blockId);
      if (!block) return {};
      return {
        layout: updateBlockOp(s.layout, blockId, { occupied: !block.occupied }),
        past: pushPast(s.past, s.layout),
        future: [],
      };
    }),

  placeNode: (type, x, y) => {
    const s = get();
    const rotation = type.startsWith("turnout") ? s.ghostRotation : 0;
    const node = createNode(type, x, y, { rotation });
    set({
      layout: addNodeOp(s.layout, node),
      selection: { kind: "node", id: node.id },
      past: pushPast(s.past, s.layout),
      future: [],
    });
    return node;
  },

  connectNodes: (fromId, toId) => {
    const s = get();
    if (fromId === toId) return null;
    const blockId = defaultBlockId(s.layout);
    const edge = createEdge(fromId, toId, blockId);
    const next = addEdgeOp(s.layout, edge);
    if (next === s.layout) return null;
    set({
      layout: next,
      selection: { kind: "edge", id: edge.id },
      past: pushPast(s.past, s.layout),
      future: [],
    });
    return edge;
  },

  placeEndpointAndConnect: (fromId, x, y) => {
    const s = get();
    const endpoint = createNode("endpoint", x, y);
    const blockId = defaultBlockId(s.layout);
    const edge = createEdge(fromId, endpoint.id, blockId);
    const withNode = addNodeOp(s.layout, endpoint);
    const withEdge = addEdgeOp(withNode, edge);
    if (withEdge === withNode) return null;
    set({
      layout: withEdge,
      selection: { kind: "edge", id: edge.id },
      past: pushPast(s.past, s.layout),
      future: [],
    });
    return edge;
  },

  deleteSelection: () =>
    set((s) => {
      if (!s.selection) return {};
      const next =
        s.selection.kind === "node"
          ? removeNodeWithEdges(s.layout, s.selection.id)
          : removeEdgeOp(s.layout, s.selection.id);
      return {
        layout: next,
        selection: null,
        past: pushPast(s.past, s.layout),
        future: [],
      };
    }),

  updateNodeLabel: (nodeId, label) =>
    set((s) => ({
      layout: updateNodeOp(s.layout, nodeId, { label: label || undefined }),
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  updateNodeRotation: (nodeId, rotation) =>
    set((s) => ({
      layout: updateNodeOp(s.layout, nodeId, { rotation: normalizeDeg(rotation) }),
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  rotateSelectedNode: (delta) =>
    set((s) => {
      if (s.selection?.kind !== "node") return {};
      const node = s.layout.nodes.find((n) => n.id === s.selection!.id);
      if (!node) return {};
      return {
        layout: updateNodeOp(s.layout, node.id, {
          rotation: normalizeDeg(node.rotation + delta),
        }),
        past: pushPast(s.past, s.layout),
        future: [],
      };
    }),

  updateEdgeBlock: (edgeId, blockId) =>
    set((s) => ({
      layout: updateEdgeOp(s.layout, edgeId, { blockId }),
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  updateEdgeCurve: (edgeId, curve) =>
    set((s) => ({
      layout: updateEdgeOp(s.layout, edgeId, { curve }),
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  updateBlock: (blockId, patch) =>
    set((s) => ({
      layout: updateBlockOp(s.layout, blockId, patch),
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  addBlock: () =>
    set((s) => {
      const palette = [
        "#3b82f6",
        "#10b981",
        "#f59e0b",
        "#a855f7",
        "#ef4444",
        "#eab308",
        "#06b6d4",
        "#ec4899",
      ];
      const color = palette[s.layout.blocks.length % palette.length];
      const block: Block = {
        id: `b_${Date.now().toString(36)}`,
        name: `Block ${s.layout.blocks.length + 1}`,
        color,
        occupied: false,
        reservedBy: null,
      };
      return {
        layout: { ...s.layout, blocks: [...s.layout.blocks, block], updatedAt: new Date().toISOString() },
        past: pushPast(s.past, s.layout),
        future: [],
      };
    }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {};
      const prev = s.past[s.past.length - 1];
      return {
        layout: prev,
        past: s.past.slice(0, -1),
        future: [s.layout, ...s.future],
        selection: null,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      return {
        layout: next,
        past: [...s.past, s.layout],
        future: s.future.slice(1),
        selection: null,
      };
    }),

  resetLayout: () =>
    set((s) => ({
      layout: emptyLayout(),
      selection: null,
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  loadDemo: () =>
    set((s) => ({
      layout: demoLayout(),
      selection: null,
      simulating: false,
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  loadCity: () =>
    set((s) => ({
      layout: generateCity(),
      selection: null,
      simulating: true,
      viewport: { x: 80, y: 40, scale: 0.5 },
      past: pushPast(s.past, s.layout),
      future: [],
    })),

  setSimulating: (v) => set({ simulating: v }),
  setSimSpeed: (simSpeed) => set({ simSpeed }),

  tickSim: (dt) =>
    set((s) => {
      const step = tickSimulation(s.layout, dt);
      const blocks = s.layout.blocks.map((b) => ({
        ...b,
        occupied: step.blocksOccupied.has(b.id),
      }));
      return {
        layout: {
          ...s.layout,
          trains: step.trains,
          blocks,
        },
      };
    }),

  setTrainVelocity: (trainId, velocity) =>
    set((s) => ({
      layout: {
        ...s.layout,
        trains: s.layout.trains.map((t) =>
          t.id === trainId ? { ...t, velocity } : t,
        ),
      },
    })),

  setTrainPriority: (trainId, priority) =>
    set((s) => ({
      layout: {
        ...s.layout,
        trains: s.layout.trains.map((t) =>
          t.id === trainId ? { ...t, priority: Math.max(0, Math.min(10, priority)) } : t,
        ),
      },
    })),

  toggleTrainPaused: (trainId) =>
    set((s) => ({
      layout: {
        ...s.layout,
        trains: s.layout.trains.map((t) =>
          t.id === trainId ? { ...t, paused: !t.paused } : t,
        ),
      },
    })),
}));

export type { Train };
