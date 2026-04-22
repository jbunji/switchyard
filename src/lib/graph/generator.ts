import type {
  Block,
  Layout,
  NodeType,
  TrackEdge,
  TrackNode,
  Train,
} from "./types";

// ============================================================================
// Generator primitives
// ============================================================================

class Gen {
  nodes: TrackNode[] = [];
  edges: TrackEdge[] = [];
  blocks: Block[] = [];
  private counter = 0;

  id(prefix: string): string {
    return `${prefix}${this.counter++}`;
  }

  node(
    type: NodeType,
    x: number,
    y: number,
    opts: { rotation?: number; label?: string; id?: string } = {},
  ): TrackNode {
    const n: TrackNode = {
      id: opts.id ?? this.id("n"),
      type,
      x,
      y,
      rotation: opts.rotation ?? 0,
      label: opts.label,
      state: type.startsWith("turnout") ? "normal" : undefined,
    };
    this.nodes.push(n);
    return n;
  }

  edge(
    from: string,
    to: string,
    blockId: string,
    opts: { curve?: number; branch?: "main" | "diverging" } = {},
  ): TrackEdge {
    const e: TrackEdge = {
      id: this.id("e"),
      from,
      to,
      blockId,
      length: 0,
      branch: opts.branch ?? "main",
      curve: opts.curve ?? 0,
    };
    this.edges.push(e);
    return e;
  }

  block(name: string, color: string): Block {
    const b: Block = {
      id: this.id("b"),
      name,
      color,
      occupied: false,
      reservedBy: null,
    };
    this.blocks.push(b);
    return b;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Staggered single-ended ladder yard. Each body stubs out east/west of the
 * yard, diverging off the lead at a consistent angle so bodies look parallel.
 */
function ladderYard(
  g: Gen,
  opts: {
    x: number;
    y: number;
    trackCount: number;
    trackLength: number;
    spacing: number;
    blockId: string;
    labelPrefix: string;
    facing?: "east" | "west";
  },
): { leadIn: TrackNode; leadOut: TrackNode; leadEdges: TrackEdge[] } {
  const {
    x,
    y,
    trackCount,
    trackLength,
    spacing,
    blockId,
    labelPrefix,
    facing = "east",
  } = opts;
  const dir = facing === "east" ? 1 : -1;
  const turnoutType: NodeType = dir > 0 ? "turnout_right" : "turnout_left";
  const rotation = dir > 0 ? 0 : 180;
  const leadSpan = 55;

  const leadIn = g.node("endpoint", x - dir * 40, y, { label: `${labelPrefix} lead` });
  let prev = leadIn;
  const turnouts: TrackNode[] = [];
  const leadEdges: TrackEdge[] = [];
  for (let i = 0; i < trackCount; i++) {
    const tx = x + dir * i * leadSpan;
    const to = g.node(turnoutType, tx, y, {
      rotation,
      label: `${labelPrefix}-${i + 1}`,
    });
    leadEdges.push(g.edge(prev.id, to.id, blockId));
    turnouts.push(to);
    prev = to;
  }
  const leadEnd = g.node("endpoint", x + dir * trackCount * leadSpan, y, {
    label: `${labelPrefix} end`,
  });
  leadEdges.push(g.edge(prev.id, leadEnd.id, blockId));

  for (let i = 0; i < trackCount; i++) {
    const bodyY = y + (i + 1) * spacing;
    const bodyStartX = x + dir * (2 * i + 1) * leadSpan;
    const bodyEndX = bodyStartX + dir * trackLength;
    const bodyStart = g.node("joint", bodyStartX, bodyY);
    const bodyEnd = g.node("endpoint", bodyEndX, bodyY);
    g.edge(turnouts[i].id, bodyStart.id, blockId, {
      branch: "diverging",
      curve: dir * 22,
    });
    g.edge(bodyStart.id, bodyEnd.id, blockId);
  }

  return { leadIn, leadOut: leadEnd, leadEdges };
}

/**
 * Splice a detour loop into a mainline segment. The main continues
 * from→sw1→sw2→to as a straight-through route; the detour goes
 * sw1→[waypoints]→sw2 as an alternative path through scenic/industrial
 * territory. Optionally add inline spur turnouts at specified waypoint
 * indices so industries/sidings peel off the detour.
 */
function buildDetour(
  g: Gen,
  opts: {
    from: TrackNode;
    to: TrackNode;
    waypoints: Array<{ x: number; y: number }>;
    mainBlock: string;
    detourBlock: string;
    side: 1 | -1;
    label: string;
    mainCurve?: number;
    detourCurves?: number[];
    spurAt?: Array<{ index: number; side: 1 | -1; length?: number; label?: string }>;
    tStart?: number;
    tEnd?: number;
  },
): {
  mainEdges: TrackEdge[];
  detourEdges: TrackEdge[];
  startSw: TrackNode;
  endSw: TrackNode;
} {
  const {
    from,
    to,
    waypoints,
    mainBlock,
    detourBlock,
    side,
    label,
    mainCurve = 0,
    detourCurves = [],
    spurAt = [],
    tStart = 0.12,
    tEnd = 0.88,
  } = opts;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const rot = (Math.atan2(dy, dx) * 180) / Math.PI;

  const sw1 = g.node(side > 0 ? "turnout_right" : "turnout_left",
    from.x + dx * tStart,
    from.y + dy * tStart,
    { rotation: rot, label: `${label}-W` },
  );
  const sw2 = g.node(side > 0 ? "turnout_left" : "turnout_right",
    from.x + dx * tEnd,
    from.y + dy * tEnd,
    { rotation: rot + 180, label: `${label}-E` },
  );

  // Mainline through the detour (straight-through)
  const me1 = g.edge(from.id, sw1.id, mainBlock, { curve: mainCurve * 0.3 });
  const me2 = g.edge(sw1.id, sw2.id, mainBlock, { curve: mainCurve * 0.4 });
  const me3 = g.edge(sw2.id, to.id, mainBlock, { curve: mainCurve * 0.3 });

  // Detour waypoints
  const spurIndexMap = new Map(spurAt.map((s) => [s.index, s]));
  const detourNodes: TrackNode[] = [sw1];
  for (let i = 0; i < waypoints.length; i++) {
    const w = waypoints[i];
    const spur = spurIndexMap.get(i);
    if (spur) {
      // Compute incoming angle so turnout rotation matches the flow
      const prev = i === 0 ? sw1 : waypoints[i - 1];
      const next = i < waypoints.length - 1 ? waypoints[i + 1] : ({ x: sw2.x, y: sw2.y });
      const angleDeg = (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI;
      const spurSide = spur.side;
      const turnoutType: NodeType = spurSide > 0 ? "turnout_right" : "turnout_left";
      const turnout = g.node(turnoutType, w.x, w.y, {
        rotation: angleDeg,
        label: spur.label ?? `${label}-s${i + 1}`,
      });
      // Add spur (diverging stub)
      const rad = (angleDeg * Math.PI) / 180;
      const px = -Math.sin(rad) * spurSide;
      const py = Math.cos(rad) * spurSide;
      const spurEnd = g.node("endpoint",
        w.x + px * (spur.length ?? 150),
        w.y + py * (spur.length ?? 150),
      );
      g.edge(turnout.id, spurEnd.id, detourBlock, {
        branch: "diverging",
        curve: spurSide * 22,
      });
      detourNodes.push(turnout);
    } else {
      detourNodes.push(g.node("joint", w.x, w.y));
    }
  }
  detourNodes.push(sw2);

  // Detour edges connecting sw1 → waypoints → sw2
  const detourEdges: TrackEdge[] = [];
  for (let i = 0; i < detourNodes.length - 1; i++) {
    const isFirst = i === 0;
    const isLast = i === detourNodes.length - 2;
    const curve = detourCurves[i] ?? 0;
    detourEdges.push(
      g.edge(detourNodes[i].id, detourNodes[i + 1].id, detourBlock, {
        branch: isFirst || isLast ? "diverging" : "main",
        curve,
      }),
    );
  }

  return { mainEdges: [me1, me2, me3], detourEdges, startSw: sw1, endSw: sw2 };
}

/**
 * Splice a crossover between two parallel mainline segments (outer + inner).
 * Places a turnout on each segment at a common x-position, connects them
 * with a diagonal connector. Each mainline segment becomes from→sw→to.
 */
function insertCrossover(
  g: Gen,
  opts: {
    outerFrom: TrackNode;
    outerTo: TrackNode;
    innerFrom: TrackNode;
    innerTo: TrackNode;
    outerT: number; // 0..1 along outer segment
    innerT: number;
    outerSide: 1 | -1; // which way the outer turnout diverges toward the inner
    innerSide: 1 | -1;
    outerBlock: string;
    innerBlock: string;
    xoverBlock: string;
    label: string;
  },
): {
  outerMainEdges: TrackEdge[];
  innerMainEdges: TrackEdge[];
  outerSw: TrackNode;
  innerSw: TrackNode;
  connector: TrackEdge;
} {
  const {
    outerFrom,
    outerTo,
    innerFrom,
    innerTo,
    outerT,
    innerT,
    outerSide,
    innerSide,
    outerBlock,
    innerBlock,
    xoverBlock,
    label,
  } = opts;

  const outerDx = outerTo.x - outerFrom.x;
  const outerDy = outerTo.y - outerFrom.y;
  const outerRot = (Math.atan2(outerDy, outerDx) * 180) / Math.PI;
  const innerDx = innerTo.x - innerFrom.x;
  const innerDy = innerTo.y - innerFrom.y;
  const innerRot = (Math.atan2(innerDy, innerDx) * 180) / Math.PI;

  const outerSw = g.node(
    outerSide > 0 ? "turnout_right" : "turnout_left",
    outerFrom.x + outerDx * outerT,
    outerFrom.y + outerDy * outerT,
    { rotation: outerRot, label: `${label}-O` },
  );
  const innerSw = g.node(
    innerSide > 0 ? "turnout_right" : "turnout_left",
    innerFrom.x + innerDx * innerT,
    innerFrom.y + innerDy * innerT,
    { rotation: innerRot, label: `${label}-I` },
  );

  const om1 = g.edge(outerFrom.id, outerSw.id, outerBlock);
  const om2 = g.edge(outerSw.id, outerTo.id, outerBlock);
  const im1 = g.edge(innerFrom.id, innerSw.id, innerBlock);
  const im2 = g.edge(innerSw.id, innerTo.id, innerBlock);

  const connector = g.edge(outerSw.id, innerSw.id, xoverBlock, {
    branch: "diverging",
    curve: 30,
  });

  return {
    outerMainEdges: [om1, om2],
    innerMainEdges: [im1, im2],
    outerSw,
    innerSw,
    connector,
  };
}

/**
 * Splice a 2-track through passenger station into a mainline segment.
 * The main continues from→sw1→sw2→to. The platform is a parallel track
 * sw1→platA→platB→sw2 that trains can take as a through path.
 */
function buildPassengerStation(
  g: Gen,
  opts: {
    from: TrackNode;
    to: TrackNode;
    mainBlock: string;
    paxBlock: string;
    side: 1 | -1;
    label: string;
    platformOffset?: number;
  },
): {
  mainEdges: TrackEdge[];
  platformEdges: TrackEdge[];
  startSw: TrackNode;
  endSw: TrackNode;
} {
  const { from, to, mainBlock, paxBlock, side, label, platformOffset = 60 } = opts;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * side;
  const py = ux * side;
  const rot = (Math.atan2(dy, dx) * 180) / Math.PI;

  const tStart = 0.2;
  const tEnd = 0.8;

  const sw1 = g.node(side > 0 ? "turnout_right" : "turnout_left",
    from.x + dx * tStart,
    from.y + dy * tStart,
    { rotation: rot, label: `${label}-W` },
  );
  const sw2 = g.node(side > 0 ? "turnout_left" : "turnout_right",
    from.x + dx * tEnd,
    from.y + dy * tEnd,
    { rotation: rot + 180, label: `${label}-E` },
  );
  const platA = g.node("joint",
    sw1.x + ux * (len * (tEnd - tStart) * 0.2) + px * platformOffset,
    sw1.y + uy * (len * (tEnd - tStart) * 0.2) + py * platformOffset,
  );
  const platB = g.node("joint",
    sw2.x - ux * (len * (tEnd - tStart) * 0.2) + px * platformOffset,
    sw2.y - uy * (len * (tEnd - tStart) * 0.2) + py * platformOffset,
  );

  const me1 = g.edge(from.id, sw1.id, mainBlock);
  const me2 = g.edge(sw1.id, sw2.id, mainBlock);
  const me3 = g.edge(sw2.id, to.id, mainBlock);

  const pe1 = g.edge(sw1.id, platA.id, paxBlock, { branch: "diverging", curve: side * 20 });
  const pe2 = g.edge(platA.id, platB.id, paxBlock);
  const pe3 = g.edge(platB.id, sw2.id, paxBlock, { branch: "diverging", curve: -side * 20 });

  return {
    mainEdges: [me1, me2, me3],
    platformEdges: [pe1, pe2, pe3],
    startSw: sw1,
    endSw: sw2,
  };
}

// ============================================================================
// City generator — Granite Falls & Western
// ============================================================================

export function generateCity(): Layout {
  const g = new Gen();

  // ---- Blocks ----
  const bOuterN = g.block("Outer N", "#3b82f6");
  const bOuterE = g.block("Outer E", "#06b6d4");
  const bOuterS = g.block("Outer S", "#0ea5e9");
  const bOuterW = g.block("Outer W", "#14b8a6");
  const bInnerN = g.block("Inner N", "#a78bfa");
  const bInnerE = g.block("Inner E", "#c084fc");
  const bInnerS = g.block("Inner S", "#d8b4fe");
  const bInnerW = g.block("Inner W", "#e9d5ff");
  const bMtn = g.block("Mountain Division", "#ec4899");
  const bInd = g.block("Industrial District", "#f97316");
  const bYardA = g.block("Yard Alpha", "#10b981");
  const bEngine = g.block("Engine Terminal", "#f59e0b");
  const bStaging = g.block("Staging", "#ef4444");
  const bPax = g.block("Downtown Station", "#eab308");
  const bXover = g.block("Crossover", "#64748b");

  // ---- OUTER MAIN LOOP ----
  const O = {
    tl: g.node("joint", 300, 260),
    tm: g.node("joint", 1100, 160),
    tmm: g.node("joint", 1900, 160),
    tr: g.node("joint", 2700, 260),
    rt: g.node("joint", 3040, 700),
    rm: g.node("joint", 3040, 1100),
    rb: g.node("joint", 3040, 1400),
    br: g.node("joint", 2700, 1660),
    bm: g.node("joint", 1900, 1720),
    bmm: g.node("joint", 1100, 1720),
    bl: g.node("joint", 300, 1660),
    lb: g.node("joint", 160, 1400),
    lm: g.node("joint", 160, 1100),
    lt: g.node("joint", 160, 700),
  };
  const outerSeq = [
    O.tl, O.tm, O.tmm, O.tr, O.rt, O.rm, O.rb, O.br,
    O.bm, O.bmm, O.bl, O.lb, O.lm, O.lt, O.tl,
  ];
  const outerBlockIds = [
    bOuterN.id, bOuterN.id, bOuterN.id, bOuterE.id, bOuterE.id, bOuterE.id, bOuterE.id,
    bOuterS.id, bOuterS.id, bOuterS.id, bOuterW.id, bOuterW.id, bOuterW.id, bOuterW.id,
  ];
  const outerCurves = [0, 0, 60, 40, 0, 0, 40, 0, 0, 60, 40, 0, 0, 60];

  // ---- INNER MAIN LOOP (concentric oval) ----
  const I = {
    tl: g.node("joint", 750, 500),
    tr: g.node("joint", 2450, 500),
    rt: g.node("joint", 2720, 820),
    rb: g.node("joint", 2720, 1260),
    br: g.node("joint", 2450, 1520),
    bl: g.node("joint", 750, 1520),
    lb: g.node("joint", 470, 1260),
    lt: g.node("joint", 470, 820),
  };
  const innerSeq = [I.tl, I.tr, I.rt, I.rb, I.br, I.bl, I.lb, I.lt, I.tl];
  const innerBlockIds = [
    bInnerN.id, bInnerE.id, bInnerE.id, bInnerE.id,
    bInnerS.id, bInnerW.id, bInnerW.id, bInnerN.id,
  ];
  const innerCurves = [0, 40, 0, 40, 0, 40, 0, 40];

  // ---- Build outer mainline edges, splicing in features along the way ----
  const outerRouteEdges: string[] = [];

  // Segment 0: tl → tm (plain)
  outerRouteEdges.push(
    g.edge(outerSeq[0].id, outerSeq[1].id, outerBlockIds[0], { curve: outerCurves[0] }).id,
  );

  // Segment 1: tm → tmm  *** MOUNTAIN DETOUR ***
  const mountain = buildDetour(g, {
    from: outerSeq[1],
    to: outerSeq[2],
    waypoints: [
      { x: 1250, y: 60 },
      { x: 1400, y: 30 },
      { x: 1550, y: 30 },
      { x: 1700, y: 30 },
      { x: 1800, y: 60 },
    ],
    mainBlock: outerBlockIds[1],
    detourBlock: bMtn.id,
    side: -1, // bulge north (interior is south, so side=-1 goes away from loop interior = north)
    label: "MTN",
    detourCurves: [40, -30, 0, -30, 40, -30],
    spurAt: [
      { index: 1, side: -1, length: 120, label: "MTN-mine" },
      { index: 3, side: -1, length: 130, label: "MTN-logging" },
    ],
    tStart: 0.08,
    tEnd: 0.92,
  });
  for (const e of mountain.mainEdges) outerRouteEdges.push(e.id);

  // Segment 2: tmm → tr (plain NE corner curve)
  outerRouteEdges.push(
    g.edge(outerSeq[2].id, outerSeq[3].id, outerBlockIds[2], { curve: outerCurves[2] }).id,
  );

  // Segment 3: tr → rt (plain east curve)
  outerRouteEdges.push(
    g.edge(outerSeq[3].id, outerSeq[4].id, outerBlockIds[3], { curve: outerCurves[3] }).id,
  );

  // Segment 4: rt → rm (plain east)
  outerRouteEdges.push(
    g.edge(outerSeq[4].id, outerSeq[5].id, outerBlockIds[4], { curve: outerCurves[4] }).id,
  );

  // Segment 5: rm → rb  *** EAST CROSSOVER will splice into this later ***
  // Placeholder: we'll build this after we know the inner edges. Skip for now.
  // Actually: build crossovers AFTER both mains exist. We need the inner segment to splice too.
  // For now, insert a plain edge; we'll splice later via a different approach.
  // BUT we can't splice after the fact because splicing means replacing the edge with from→sw→to.
  // SO: build crossovers inline here — need the inner segment's from/to now.

  // Segment 5 CROSSOVER (east): ties rm→rb on outer with i-rt→i-rb on inner
  const eastXover = insertCrossover(g, {
    outerFrom: outerSeq[5],
    outerTo: outerSeq[6],
    innerFrom: innerSeq[2], // i-rt
    innerTo: innerSeq[3],   // i-rb
    outerT: 0.5,
    innerT: 0.5,
    outerSide: 1,  // outer rm→rb going south, right is west (interior) — goes to inner
    innerSide: -1, // inner going south, left is east (exterior) — goes to outer
    outerBlock: outerBlockIds[5],
    innerBlock: innerBlockIds[2],
    xoverBlock: bXover.id,
    label: "XE",
  });
  for (const e of eastXover.outerMainEdges) outerRouteEdges.push(e.id);

  // Segment 6: rb → br (plain SE corner)
  outerRouteEdges.push(
    g.edge(outerSeq[6].id, outerSeq[7].id, outerBlockIds[6], { curve: outerCurves[6] }).id,
  );

  // Segment 7: br → bm (plain)
  outerRouteEdges.push(
    g.edge(outerSeq[7].id, outerSeq[8].id, outerBlockIds[7], { curve: outerCurves[7] }).id,
  );

  // Segment 8: bm → bmm  *** INDUSTRIAL DETOUR ***
  // Spurs go SOUTH (toward outer main) so they don't cross the passenger zone.
  const industrial = buildDetour(g, {
    from: outerSeq[8],
    to: outerSeq[9],
    waypoints: [
      { x: 1750, y: 1620 },
      { x: 1550, y: 1600 },
      { x: 1350, y: 1600 },
      { x: 1200, y: 1620 },
    ],
    mainBlock: outerBlockIds[8],
    detourBlock: bInd.id,
    side: -1,
    label: "IND",
    detourCurves: [30, -20, 0, -20, 30],
    spurAt: [
      { index: 0, side: -1, length: 70, label: "IND-lumber" },
      { index: 1, side: -1, length: 80, label: "IND-oil" },
      { index: 2, side: -1, length: 80, label: "IND-grain" },
      { index: 3, side: -1, length: 70, label: "IND-team" },
    ],
    tStart: 0.08,
    tEnd: 0.92,
  });
  for (const e of industrial.mainEdges) outerRouteEdges.push(e.id);

  // Segment 9: bmm → bl (plain SW corner)
  outerRouteEdges.push(
    g.edge(outerSeq[9].id, outerSeq[10].id, outerBlockIds[9], { curve: outerCurves[9] }).id,
  );

  // Segment 10: bl → lb (plain)
  outerRouteEdges.push(
    g.edge(outerSeq[10].id, outerSeq[11].id, outerBlockIds[10], { curve: outerCurves[10] }).id,
  );

  // Segment 11: lb → lm  *** WEST CROSSOVER ***
  const westXover = insertCrossover(g, {
    outerFrom: outerSeq[11],
    outerTo: outerSeq[12],
    innerFrom: innerSeq[6], // i-lb
    innerTo: innerSeq[7],   // i-lt
    outerT: 0.5,
    innerT: 0.5,
    outerSide: -1,  // outer going north, diverging left (east, interior)
    innerSide: 1,   // inner going north, diverging right (west, exterior)
    outerBlock: outerBlockIds[11],
    innerBlock: innerBlockIds[6],
    xoverBlock: bXover.id,
    label: "XW",
  });
  for (const e of westXover.outerMainEdges) outerRouteEdges.push(e.id);

  // Segment 12: lm → lt  *** YARD ALPHA TRUNK ***
  // Splice a trunk turnout, then continue north to lt
  const yaTrunk = g.node("turnout_right", 160, 900, {
    rotation: -90, // pointing north, diverging right (east, interior)
    label: "YA-trunk",
  });
  outerRouteEdges.push(g.edge(outerSeq[12].id, yaTrunk.id, outerBlockIds[12]).id);
  outerRouteEdges.push(g.edge(yaTrunk.id, outerSeq[13].id, outerBlockIds[12]).id);

  // Segment 13: lt → tl (plain NW corner)
  outerRouteEdges.push(
    g.edge(outerSeq[13].id, outerSeq[14].id, outerBlockIds[13], { curve: outerCurves[13] }).id,
  );

  // ---- Build inner mainline edges (around the crossover splices) ----
  const innerRouteEdges: string[] = [];

  // Seg 0: tl → tr  *** maybe downtown passenger later, for now plain ***
  innerRouteEdges.push(
    g.edge(innerSeq[0].id, innerSeq[1].id, innerBlockIds[0], { curve: innerCurves[0] }).id,
  );

  // Seg 1: tr → rt (NE curve)
  innerRouteEdges.push(
    g.edge(innerSeq[1].id, innerSeq[2].id, innerBlockIds[1], { curve: innerCurves[1] }).id,
  );

  // Seg 2: rt → rb — already sliced by East Crossover
  for (const e of eastXover.innerMainEdges) innerRouteEdges.push(e.id);

  // Seg 3: rb → br (SE curve)
  innerRouteEdges.push(
    g.edge(innerSeq[3].id, innerSeq[4].id, innerBlockIds[3], { curve: innerCurves[3] }).id,
  );

  // Seg 4: br → bl  *** DOWNTOWN PASSENGER STATION ***
  const passenger = buildPassengerStation(g, {
    from: innerSeq[4],
    to: innerSeq[5],
    mainBlock: innerBlockIds[4],
    paxBlock: bPax.id,
    side: 1, // platform to the south
    label: "PAX",
    platformOffset: 70,
  });
  for (const e of passenger.mainEdges) innerRouteEdges.push(e.id);

  // Seg 5: bl → lb (SW curve)
  innerRouteEdges.push(
    g.edge(innerSeq[5].id, innerSeq[6].id, innerBlockIds[5], { curve: innerCurves[5] }).id,
  );

  // Seg 6: lb → lt — already sliced by West Crossover
  for (const e of westXover.innerMainEdges) innerRouteEdges.push(e.id);

  // Seg 7: lt → tl (NW curve)
  innerRouteEdges.push(
    g.edge(innerSeq[7].id, innerSeq[0].id, innerBlockIds[7], { curve: innerCurves[7] }).id,
  );

  // ---- YARD ALPHA (6 tracks, off yaTrunk, east-facing) ----
  const ya = ladderYard(g, {
    x: 340,
    y: 900,
    trackCount: 6,
    trackLength: 180,
    spacing: 28,
    blockId: bYardA.id,
    labelPrefix: "YA",
    facing: "east",
  });
  g.edge(yaTrunk.id, ya.leadIn.id, bYardA.id, { branch: "diverging", curve: 22 });

  // ---- ENGINE TERMINAL (3 tracks, off YA lead) ----
  const etTrunk = g.node("turnout_right", 400, 900, {
    rotation: 0,
    label: "ET-trunk",
  });
  // Insert etTrunk on YA lead — replacing the first lead edge leadIn→YA-1 with leadIn→etTrunk→YA-1
  // Simpler: etTrunk is a separate turnout off the YA leadIn endpoint.
  // But leadIn is an "endpoint" type. Let's splice between leadIn and ladderYard. Since we already built YA, we can add a parallel branch:
  // Actually, easier: put etTrunk on a separate branch off ya.leadIn — but leadIn is already at (300, 900).
  // Simplify: ET takes off from yaTrunk's "main" continuation (since yaTrunk is right-hand, main goes straight north and diverging goes east). ET is the second branch from yaTrunk.
  // ...this gets complex. Skip ET for now; add it as a spur off YA body-1.
  const etYardLead = g.node("turnout_left", 540, 928, {
    rotation: 0,
    label: "ET-sw",
  });
  // Insert on YA-1's diverging edge — but that edge is already made. Skip for clarity.
  // ALTERNATIVE: give ET its own attachment point off inner main or off the connector between yaTrunk and YA lead.
  // For v1: ET is a separate 3-track stub somewhere near YA. Put it at (340, 1080) — south of YA.
  const et = ladderYard(g, {
    x: 340,
    y: 1080,
    trackCount: 3,
    trackLength: 140,
    spacing: 26,
    blockId: bEngine.id,
    labelPrefix: "ET",
    facing: "east",
  });
  // Connect ET to YA via a short connector (ET lead to a point between YA bodies)
  // For simplicity, connect ET leadIn (at 300, 1080) to a new trunk off yaTrunk (y=900 going south)
  const etLink = g.node("joint", 280, 1000);
  g.edge(yaTrunk.id, etLink.id, bYardA.id, { branch: "diverging", curve: -20 });
  g.edge(etLink.id, et.leadIn.id, bEngine.id);
  // Suppress unused placeholder nodes (they were sketch leftovers)
  void etTrunk;
  void etYardLead;

  // ---- STAGING (4 tracks, off inner main bottom — near downtown) ----
  // Splice a trunk off inner[4]→[5] segment... but we already built that via buildPassengerStation.
  // Instead, put staging off inner[3]→[4] (SE inner curve) or create it as a separate stub.
  // Put staging as a stub off inner-br (i-br), going east-south.
  const stgTrunk = g.node("turnout_right", 2560, 1460, {
    rotation: 135, // southeast
    label: "STG-trunk",
  });
  g.edge(innerSeq[4].id, stgTrunk.id, bInnerS.id, { branch: "diverging", curve: 20 });
  // Wait — innerSeq[4] is i-br at (2450, 1520). We want to branch OFF of it toward staging.
  // But we already wired innerSeq[3]→[4] as a plain edge, and innerSeq[4]→[5] via passenger.
  // A new edge from innerSeq[4] → stgTrunk is a THIRD edge at that node (3-way join).
  // Visually OK, topologically OK. The inner main still continues through innerSeq[4] normally.
  const stg = ladderYard(g, {
    x: 2700,
    y: 1520,
    trackCount: 4,
    trackLength: 160,
    spacing: 26,
    blockId: bStaging.id,
    labelPrefix: "STG",
    facing: "east",
  });
  g.edge(stgTrunk.id, stg.leadIn.id, bStaging.id, { branch: "diverging", curve: 20 });

  // ---- TRAINS ----
  const trains = seedTrains(g, {
    outerRouteEdges,
    innerRouteEdges,
    yaLeadEdges: ya.leadEdges.map((e) => e.id),
    etLeadEdges: et.leadEdges.map((e) => e.id),
    industrialDetourEdges: industrial.detourEdges.map((e) => e.id),
    mountainDetourEdges: mountain.detourEdges.map((e) => e.id),
    // The middle mainline edge (sw1→sw2) is the one we swap for the full detour path
    mountainSidingEdges: [mountain.mainEdges[1].id],
    industrialSidingEdges: [industrial.mainEdges[1].id],
  });

  // ---- Initial turnout states: pre-flip a few so the city has visible
  // variety out of the box. Bryan sees trains actually use the zones.
  const divergedByDefault = new Set(["MTN-W", "IND-W", "PAX-W"]);
  for (const n of g.nodes) {
    if (n.label && divergedByDefault.has(n.label)) {
      n.state = "diverging";
    }
  }

  // ---- Zone labels ----
  const labels = [
    { id: "lbl-mtn", text: "MOUNTAIN DIVISION", x: 1500, y: -20, size: 52, opacity: 0.22 },
    { id: "lbl-downtown", text: "DOWNTOWN", x: 1600, y: 1000, size: 78, opacity: 0.16 },
    { id: "lbl-ind", text: "INDUSTRIAL DISTRICT", x: 1475, y: 1660, size: 44, opacity: 0.22 },
    { id: "lbl-ya", text: "YARD ALPHA", x: 540, y: 790, size: 34, opacity: 0.25 },
    { id: "lbl-et", text: "ENGINE", x: 540, y: 1060, size: 24, opacity: 0.25 },
    { id: "lbl-stg", text: "STAGING", x: 2820, y: 1480, size: 30, opacity: 0.25 },
    { id: "lbl-pax", text: "CENTRAL STATION", x: 1600, y: 1600, size: 28, opacity: 0.28 },
  ];

  return {
    id: "city",
    name: "Granite Falls & Western",
    nodes: g.nodes,
    edges: g.edges,
    blocks: g.blocks,
    trains,
    labels,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Train seeding
// ============================================================================

function seedTrains(
  _g: Gen,
  refs: {
    outerRouteEdges: string[];
    innerRouteEdges: string[];
    yaLeadEdges: string[];
    etLeadEdges: string[];
    industrialDetourEdges: string[];
    mountainDetourEdges: string[];
    mountainSidingEdges: string[];
    industrialSidingEdges: string[];
  },
): Train[] {
  const outer = refs.outerRouteEdges;
  const inner = refs.innerRouteEdges;
  if (outer.length === 0) return [];

  const trains: Train[] = [];

  // Build a mountain-detour variant of outer: swap mountainSidingEdges for mountainDetourEdges
  const mountainVariant = substitute(outer, refs.mountainSidingEdges, refs.mountainDetourEdges);
  const industrialVariant = substitute(outer, refs.industrialSidingEdges, refs.industrialDetourEdges);

  // Main-loop freight — plain outer
  trains.push(makeTrain({
    id: "t-up", road: "UP", number: "4014", color: "#f59e0b",
    velocity: 55, maxVelocity: 100,
    route: outer, routeIndex: 0, offset: 0.15,
  }));

  // Fast passenger — outer with mountain detour
  trains.push(makeTrain({
    id: "t-bnsf", road: "BNSF", number: "4429", color: "#fb923c",
    velocity: 75, maxVelocity: 120,
    route: mountainVariant, routeIndex: Math.floor(mountainVariant.length * 0.35), offset: 0.3,
  }));

  // Limited — outer with industrial detour
  trains.push(makeTrain({
    id: "t-ns", road: "NS", number: "8102", color: "#22c55e",
    velocity: 60, maxVelocity: 100,
    route: industrialVariant, routeIndex: Math.floor(industrialVariant.length * 0.6), offset: 0.1,
  }));

  // Commuter — inner main only
  if (inner.length > 1) {
    trains.push(makeTrain({
      id: "t-amtk", road: "AMTK", number: "156", color: "#60a5fa",
      velocity: 65, maxVelocity: 110,
      route: inner, routeIndex: 0, offset: 0.2,
    }));
  }

  // Industrial local — continuous loop around the city via the industrial detour.
  // (Was a back-and-forth switcher, but a through-branch shouldn't reverse —
  //  a local freight circles the full main taking the industrial path each lap.)
  if (industrialVariant.length > 1) {
    trains.push(makeTrain({
      id: "t-ind-local", road: "LOC", number: "IND-01", color: "#a855f7",
      velocity: 40, maxVelocity: 80,
      route: industrialVariant,
      routeIndex: Math.floor(industrialVariant.length * 0.15),
      offset: 0.2,
    }));
  }

  // Yard switcher — back-and-forth on YA lead
  if (refs.yaLeadEdges.length > 1) {
    const fwd = refs.yaLeadEdges;
    trains.push(makeTrain({
      id: "t-ya-switcher", road: "SW", number: "YA-02", color: "#10b981",
      velocity: 30, maxVelocity: 70,
      route: [...fwd, ...[...fwd].reverse()], routeIndex: 0, offset: 0.2,
    }));
  }

  // Engine hostler — back-and-forth on ET lead
  if (refs.etLeadEdges.length > 1) {
    const fwd = refs.etLeadEdges;
    trains.push(makeTrain({
      id: "t-et-switcher", road: "SW", number: "ET-03", color: "#eab308",
      velocity: 25, maxVelocity: 60,
      route: [...fwd, ...[...fwd].reverse()], routeIndex: 0, offset: 0.2,
    }));
  }

  return trains;
}

function substitute(route: string[], pattern: string[], replacement: string[]): string[] {
  // Find pattern in route and replace with replacement. Returns new route.
  if (pattern.length === 0) return route;
  for (let i = 0; i <= route.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (route[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return [...route.slice(0, i), ...replacement, ...route.slice(i + pattern.length)];
    }
  }
  return route;
}

interface TrainSeed {
  id: string;
  road: string;
  number: string;
  color: string;
  velocity: number;
  maxVelocity: number;
  route: string[];
  routeIndex: number;
  offset: number;
}

function makeTrain(s: TrainSeed): Train {
  const edgeId = s.route[s.routeIndex] ?? s.route[0];
  return {
    id: s.id,
    road: s.road,
    number: s.number,
    color: s.color,
    length: 3,
    position: { edgeId, offset: s.offset, direction: "forward" },
    velocity: s.velocity,
    maxVelocity: s.maxVelocity,
    route: s.route,
    routeIndex: s.routeIndex,
    waiting: false,
    paused: false,
  };
}
