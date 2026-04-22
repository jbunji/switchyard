import type { Layout, TrackEdge, TrackNode, Train } from "./types";
import { edgeGeometry } from "./geometry";

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

function angularDistance(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Classify which port of a turnout an edge is attached to.
 * IN   = the common/points side (opposite of main/diverging)
 * MAIN = straight-through, in the turnout's rotation direction
 * DIVERGING = the branch (marked explicitly via edge.branch === "diverging")
 */
function classifyPort(
  turnout: TrackNode,
  edge: TrackEdge,
  nodeMap: Map<string, TrackNode>,
): "in" | "main" | "diverging" {
  if (edge.branch === "diverging") return "diverging";

  const otherId = edge.from === turnout.id ? edge.to : edge.from;
  const other = nodeMap.get(otherId);
  if (!other) return "main";

  const dx = other.x - turnout.x;
  const dy = other.y - turnout.y;
  if (dx === 0 && dy === 0) return "main";
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const diffMain = angularDistance(angleDeg, turnout.rotation);
  const diffIn = angularDistance(angleDeg, turnout.rotation + 180);

  return diffMain < diffIn ? "main" : "in";
}

/**
 * Given an edge a train is leaving and the node it's exiting through, decide
 * the next edge. Turnout state drives the choice when relevant. Joints with
 * 3+ edges pick the straightest continuation.
 */
function pickNextEdge(
  currentEdge: TrackEdge,
  exitNode: TrackNode,
  connected: TrackEdge[],
  nodeMap: Map<string, TrackNode>,
): TrackEdge | null {
  const candidates = connected.filter((e) => e.id !== currentEdge.id);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const isTurnout = exitNode.type.startsWith("turnout");

  if (isTurnout) {
    const incomingPort = classifyPort(exitNode, currentEdge, nodeMap);
    if (incomingPort === "main" || incomingPort === "diverging") {
      // From main or diverging side → must exit via IN (trailing-point move)
      const inEdge = candidates.find(
        (e) => classifyPort(exitNode, e, nodeMap) === "in",
      );
      if (inEdge) return inEdge;
    } else {
      // From IN side → turnout state decides
      const wantPort: "main" | "diverging" =
        exitNode.state === "diverging" ? "diverging" : "main";
      const match = candidates.find(
        (e) => classifyPort(exitNode, e, nodeMap) === wantPort,
      );
      if (match) return match;
      // Fallback: whichever candidate isn't diverging
      const mainEdge = candidates.find(
        (e) => classifyPort(exitNode, e, nodeMap) === "main",
      );
      if (mainEdge) return mainEdge;
    }
    return candidates[0];
  }

  // Joint (or non-turnout multi-way): pick straightest continuation by angle
  const incomingNodeId =
    currentEdge.from === exitNode.id ? currentEdge.to : currentEdge.from;
  const incomingNode = nodeMap.get(incomingNodeId);
  if (!incomingNode) return candidates[0];
  const inAngle =
    (Math.atan2(exitNode.y - incomingNode.y, exitNode.x - incomingNode.x) *
      180) /
    Math.PI;

  let best = candidates[0];
  let bestDiff = Infinity;
  for (const e of candidates) {
    const otherId = e.from === exitNode.id ? e.to : e.from;
    const other = nodeMap.get(otherId);
    if (!other) continue;
    const outAngle =
      (Math.atan2(other.y - exitNode.y, other.x - exitNode.x) * 180) / Math.PI;
    const diff = angularDistance(inAngle, outAngle);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = e;
    }
  }
  return best;
}

export function tickSimulation(layout: Layout, dt: number): SimStep {
  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(layout.edges.map((e) => [e.id, e]));

  const edgesByNode = new Map<string, TrackEdge[]>();
  for (const e of layout.edges) {
    if (!edgesByNode.has(e.from)) edgesByNode.set(e.from, []);
    edgesByNode.get(e.from)!.push(e);
    if (!edgesByNode.has(e.to)) edgesByNode.set(e.to, []);
    edgesByNode.get(e.to)!.push(e);
  }

  const edgeLenCache = new Map<string, number>();
  const edgeLenFor = (e: TrackEdge): number => {
    const cached = edgeLenCache.get(e.id);
    if (cached !== undefined) return cached;
    const len = edgeLen(e, nodeMap);
    edgeLenCache.set(e.id, len);
    return len;
  };

  // First pass: figure out who currently holds which block.
  // Higher priority wins when multiple trains share a block.
  const blockHolder = new Map<string, { trainId: string; priority: number }>();
  for (const t of layout.trains) {
    if (!t.position) continue;
    const edge = edgeMap.get(t.position.edgeId);
    if (!edge) continue;
    const priority = t.priority ?? 5;
    const existing = blockHolder.get(edge.blockId);
    if (!existing || priority > existing.priority) {
      blockHolder.set(edge.blockId, { trainId: t.id, priority });
    }
  }

  // Process higher-priority trains first so they claim contested blocks.
  const orderedTrains = [...layout.trains].sort(
    (a, b) => (b.priority ?? 5) - (a.priority ?? 5),
  );

  const trainUpdates = new Map<string, Train>();
  for (const train of orderedTrains) {
    if (!train.position) {
      trainUpdates.set(train.id, train);
      continue;
    }
    if (train.paused) {
      trainUpdates.set(train.id, { ...train, waiting: false });
      continue;
    }

    const edge = edgeMap.get(train.position.edgeId);
    if (!edge) {
      trainUpdates.set(train.id, train);
      continue;
    }

    const len = edgeLenFor(edge);
    if (len === 0) {
      trainUpdates.set(train.id, train);
      continue;
    }

    const dirSign = train.position.direction === "forward" ? 1 : -1;
    const newOffset = train.position.offset + (train.velocity * dt / len) * dirSign;

    if (newOffset < 1 && newOffset > 0) {
      trainUpdates.set(train.id, {
        ...train,
        waiting: false,
        position: { ...train.position, offset: newOffset },
      });
      continue;
    }

    const atEnd = newOffset >= 1;
    const exitNodeId = dirSign > 0 ? edge.to : edge.from;
    const exitNode = nodeMap.get(exitNodeId);
    if (!exitNode) {
      trainUpdates.set(train.id, train);
      continue;
    }

    const connected = edgesByNode.get(exitNodeId) ?? [];
    const nextEdge = pickNextEdge(edge, exitNode, connected, nodeMap);

    if (!nextEdge) {
      // Stub end — reverse
      trainUpdates.set(train.id, {
        ...train,
        waiting: false,
        position: {
          edgeId: edge.id,
          offset: atEnd ? 0.999 : 0.001,
          direction: train.position.direction === "forward" ? "reverse" : "forward",
        },
      });
      continue;
    }

    // Collision check: is next block held by a different train?
    // Priority rule: if the holder has lower priority than us AND we haven't
    // already got dibs on the block, we can preempt (we process in priority
    // order, so higher priority claims first).
    const holder = blockHolder.get(nextEdge.blockId);
    const myPriority = train.priority ?? 5;
    if (holder && holder.trainId !== train.id && holder.priority >= myPriority) {
      trainUpdates.set(train.id, {
        ...train,
        waiting: true,
        position: {
          edgeId: edge.id,
          offset: atEnd ? 0.999 : 0.001,
          direction: train.position.direction,
        },
      });
      continue;
    }

    // Determine direction on next edge
    const nextDir = nextEdge.from === exitNodeId ? "forward" : "reverse";
    const startOffset = nextDir === "forward" ? 0 : 1;

    blockHolder.set(nextEdge.blockId, { trainId: train.id, priority: myPriority });

    trainUpdates.set(train.id, {
      ...train,
      waiting: false,
      position: {
        edgeId: nextEdge.id,
        offset: startOffset,
        direction: nextDir,
      },
    });
  }

  // Re-assemble in original order so stable iteration for external consumers
  const newTrains: Train[] = layout.trains.map((t) => trainUpdates.get(t.id) ?? t);

  const blocksOccupied = new Set<string>();
  for (const t of newTrains) {
    if (!t.position) continue;
    const edge = edgeMap.get(t.position.edgeId);
    if (edge) blocksOccupied.add(edge.blockId);
  }

  return { trains: newTrains, blocksOccupied };
}
