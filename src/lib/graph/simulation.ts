import type { Layout, TrackEdge, TrackNode, Train } from "./types";
import { edgeGeometry } from "./geometry";

interface EdgeMeta {
  edge: TrackEdge;
  length: number;
}

export interface SimStep {
  trains: Train[];
  blocksOccupied: Set<string>;
}

function edgeLen(edge: TrackEdge, nodes: Map<string, TrackNode>): number {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (!from || !to) return 0;
  return edgeGeometry(from, to, edge.curve).length;
}

export function tickSimulation(layout: Layout, dt: number): SimStep {
  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(layout.edges.map((e) => [e.id, e]));

  // Current per-edge cache
  const edgeLenCache = new Map<string, EdgeMeta>();
  const edgeLenFor = (e: TrackEdge): number => {
    let cached = edgeLenCache.get(e.id);
    if (!cached) {
      cached = { edge: e, length: edgeLen(e, nodeMap) };
      edgeLenCache.set(e.id, cached);
    }
    return cached.length;
  };

  // First pass: figure out who currently holds which block
  const blockHolder = new Map<string, string>(); // blockId -> trainId
  for (const t of layout.trains) {
    if (!t.position) continue;
    const edge = edgeMap.get(t.position.edgeId);
    if (!edge) continue;
    if (!blockHolder.has(edge.blockId)) {
      blockHolder.set(edge.blockId, t.id);
    }
  }

  const newTrains: Train[] = layout.trains.map((train) => {
    if (!train.position) return train;
    if (train.paused) return { ...train, waiting: false };
    if (train.route.length < 2) return train;

    const edge = edgeMap.get(train.position.edgeId);
    if (!edge) return train;

    const len = edgeLenFor(edge);
    if (len === 0) return train;

    const dirSign = train.position.direction === "forward" ? 1 : -1;
    const distanceMoved = train.velocity * dt;
    const offsetDelta = (distanceMoved / len) * dirSign;
    const newOffset = train.position.offset + offsetDelta;

    // If train is about to cross the end of its current edge, check next block
    if (newOffset >= 1 || newOffset <= 0) {
      const atEnd = newOffset >= 1;
      const exitNodeId = dirSign > 0 ? edge.to : edge.from;

      // Find next edge in route
      const nextIdx = (train.routeIndex + 1) % train.route.length;
      const nextEdgeId = train.route[nextIdx];
      const nextEdge = edgeMap.get(nextEdgeId);
      if (!nextEdge) {
        return {
          ...train,
          position: { ...train.position, offset: atEnd ? 0.999 : 0.001 },
          waiting: true,
        };
      }

      // Collision check: is next block occupied by another train?
      const holder = blockHolder.get(nextEdge.blockId);
      if (holder && holder !== train.id) {
        // Park at the exit end of current edge, wait
        return {
          ...train,
          position: {
            edgeId: edge.id,
            offset: atEnd ? 0.999 : 0.001,
            direction: train.position.direction,
          },
          waiting: true,
        };
      }

      // Determine direction on next edge based on which endpoint matches exit node
      const nextDir = nextEdge.from === exitNodeId ? "forward" : "reverse";
      const startOffset = nextDir === "forward" ? 0 : 1;

      // Claim the next block immediately so other trains see it
      blockHolder.set(nextEdge.blockId, train.id);

      return {
        ...train,
        waiting: false,
        routeIndex: nextIdx,
        position: {
          edgeId: nextEdge.id,
          offset: startOffset,
          direction: nextDir,
        },
      };
    }

    return {
      ...train,
      waiting: false,
      position: { ...train.position, offset: newOffset },
    };
  });

  // Recompute occupancy from final positions
  const blocksOccupied = new Set<string>();
  for (const t of newTrains) {
    if (!t.position) continue;
    const edge = edgeMap.get(t.position.edgeId);
    if (edge) blocksOccupied.add(edge.blockId);
  }

  return { trains: newTrains, blocksOccupied };
}
