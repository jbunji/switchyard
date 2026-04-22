import type { Block, Layout, NodeType, TrackEdge, TrackNode } from "./types";

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function snapToGrid(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}

export function snapPoint(
  x: number,
  y: number,
  grid: number,
  gridEnabled: boolean,
): { x: number; y: number } {
  if (!gridEnabled) return { x, y };
  return { x: snapToGrid(x, grid), y: snapToGrid(y, grid) };
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function findNearestNode(
  nodes: TrackNode[],
  x: number,
  y: number,
  radius: number,
): TrackNode | null {
  let best: TrackNode | null = null;
  let bestDist = radius;
  for (const n of nodes) {
    const d = distance(n.x, n.y, x, y);
    if (d <= bestDist) {
      best = n;
      bestDist = d;
    }
  }
  return best;
}

export function findNearestEdge(
  layout: Layout,
  x: number,
  y: number,
  radius: number,
): TrackEdge | null {
  let best: TrackEdge | null = null;
  let bestDist = radius;
  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
  for (const e of layout.edges) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (!from || !to) continue;
    const d = pointToSegmentDistance(x, y, from.x, from.y, to.x, to.y);
    if (d <= bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(px, py, ax + t * dx, ay + t * dy);
}

export function createNode(
  type: NodeType,
  x: number,
  y: number,
  opts?: Partial<TrackNode>,
): TrackNode {
  const isTurnout = type.startsWith("turnout");
  return {
    id: opts?.id ?? newId("n"),
    type,
    x,
    y,
    rotation: opts?.rotation ?? 0,
    label: opts?.label,
    state: isTurnout ? (opts?.state ?? "normal") : undefined,
  };
}

export function createEdge(
  fromId: string,
  toId: string,
  blockId: string,
  opts?: Partial<TrackEdge>,
): TrackEdge {
  return {
    id: opts?.id ?? newId("e"),
    from: fromId,
    to: toId,
    blockId,
    length: opts?.length ?? 0,
    branch: opts?.branch ?? "main",
    curve: opts?.curve ?? 0,
  };
}

export function createBlock(name: string, color: string): Block {
  return {
    id: newId("b"),
    name,
    color,
    occupied: false,
    reservedBy: null,
  };
}

export function defaultBlockId(layout: Layout): string {
  if (layout.blocks.length > 0) return layout.blocks[0].id;
  return "b-default";
}

export function emptyLayout(): Layout {
  const block: Block = {
    id: "b-default",
    name: "Main",
    color: "#3b82f6",
    occupied: false,
    reservedBy: null,
  };
  return {
    id: "blank",
    name: "Untitled Layout",
    nodes: [],
    edges: [],
    blocks: [block],
    trains: [],
    labels: [],
    updatedAt: new Date().toISOString(),
  };
}

export function edgeLength(layout: Layout, edge: TrackEdge): number {
  const from = layout.nodes.find((n) => n.id === edge.from);
  const to = layout.nodes.find((n) => n.id === edge.to);
  if (!from || !to) return 0;
  return distance(from.x, from.y, to.x, to.y);
}

export function removeNodeWithEdges(layout: Layout, nodeId: string): Layout {
  const edges = layout.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  const nodes = layout.nodes.filter((n) => n.id !== nodeId);
  return { ...layout, nodes, edges, updatedAt: new Date().toISOString() };
}

export function removeEdge(layout: Layout, edgeId: string): Layout {
  return {
    ...layout,
    edges: layout.edges.filter((e) => e.id !== edgeId),
    updatedAt: new Date().toISOString(),
  };
}

export function addNode(layout: Layout, node: TrackNode): Layout {
  return {
    ...layout,
    nodes: [...layout.nodes, node],
    updatedAt: new Date().toISOString(),
  };
}

export function addEdge(layout: Layout, edge: TrackEdge): Layout {
  if (edge.from === edge.to) return layout;
  const exists = layout.edges.some(
    (e) =>
      (e.from === edge.from && e.to === edge.to) || (e.from === edge.to && e.to === edge.from),
  );
  if (exists) return layout;
  return {
    ...layout,
    edges: [...layout.edges, edge],
    updatedAt: new Date().toISOString(),
  };
}

export function updateNode(layout: Layout, nodeId: string, patch: Partial<TrackNode>): Layout {
  return {
    ...layout,
    nodes: layout.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    updatedAt: new Date().toISOString(),
  };
}

export function updateEdge(layout: Layout, edgeId: string, patch: Partial<TrackEdge>): Layout {
  return {
    ...layout,
    edges: layout.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
    updatedAt: new Date().toISOString(),
  };
}

export function updateBlock(layout: Layout, blockId: string, patch: Partial<Block>): Layout {
  return {
    ...layout,
    blocks: layout.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    updatedAt: new Date().toISOString(),
  };
}
