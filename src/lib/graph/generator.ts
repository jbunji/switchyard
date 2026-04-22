import type {
  Block,
  Layout,
  NodeType,
  TrackEdge,
  TrackNode,
  Train,
} from "./types";

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
    doubleEnded?: boolean;
  },
): { leadIn: TrackNode; leadOut: TrackNode | null } {
  const {
    x,
    y,
    trackCount,
    trackLength,
    spacing,
    blockId,
    labelPrefix,
    facing = "east",
    doubleEnded = true,
  } = opts;
  const dir = facing === "east" ? 1 : -1;
  const turnoutType: NodeType = dir > 0 ? "turnout_right" : "turnout_left";
  const oppType: NodeType = dir > 0 ? "turnout_left" : "turnout_right";
  const rotation = dir > 0 ? 0 : 180;
  const oppRotation = dir > 0 ? 180 : 0;

  const leadSpan = 55;
  const transitionLen = 50;

  // ---- WEST LEAD ----
  const leadIn = g.node("endpoint", x - dir * 40, y, { label: `${labelPrefix} W` });
  let prev = leadIn;
  const westTurnouts: TrackNode[] = [];
  for (let i = 0; i < trackCount; i++) {
    const tx = x + dir * i * leadSpan;
    const to = g.node(turnoutType, tx, y, {
      rotation,
      label: `${labelPrefix}-${i + 1}`,
    });
    g.edge(prev.id, to.id, blockId);
    westTurnouts.push(to);
    prev = to;
  }

  // ---- BODY TRACKS (parallel, stepped) ----
  const bodyEnds: TrackNode[] = [];
  for (let i = 0; i < trackCount; i++) {
    const bodyY = y + (i + 1) * spacing;
    const tx = x + dir * i * leadSpan;
    const bodyStartX = tx + dir * transitionLen;
    const bodyEndX = bodyStartX + dir * trackLength;
    const bodyStart = g.node("joint", bodyStartX, bodyY);
    const bodyEnd = g.node("joint", bodyEndX, bodyY);
    // diverging transition from west turnout down to body start
    g.edge(westTurnouts[i].id, bodyStart.id, blockId, {
      branch: "diverging",
      curve: dir * 18,
    });
    // body running horizontal
    g.edge(bodyStart.id, bodyEnd.id, blockId);
    bodyEnds.push(bodyEnd);
  }

  if (doubleEnded) {
    // Easternmost body end is bodyEnds[trackCount - 1] since bodies step east
    const eastmostEndX = bodyEnds[trackCount - 1].x;
    const eastLeadStartX = eastmostEndX + dir * transitionLen;

    // Place east turnouts all on the east lead at y=y.
    // TE[0] (longest transition → westernmost body end) goes farthest east on the lead.
    // TE[n-1] (shortest transition → easternmost body end) sits closest to the bodies.
    const eastTurnouts: TrackNode[] = [];
    for (let i = 0; i < trackCount; i++) {
      const posIdx = trackCount - 1 - i;
      const teX = eastLeadStartX + dir * posIdx * leadSpan;
      const te = g.node(oppType, teX, y, {
        rotation: oppRotation,
        label: `${labelPrefix}-${i + 1}E`,
      });
      eastTurnouts.push(te);
    }

    const leadEnd = g.node(
      "endpoint",
      eastLeadStartX + dir * trackCount * leadSpan,
      y,
      { label: `${labelPrefix} E` },
    );

    // east lead connected: leadEnd -> TE[0] -> TE[1] -> ... -> TE[n-1]
    let oppPrev: TrackNode = leadEnd;
    for (let i = 0; i < trackCount; i++) {
      g.edge(oppPrev.id, eastTurnouts[i].id, blockId);
      oppPrev = eastTurnouts[i];
    }

    // each east turnout returns (diverging) down to its body east endpoint
    for (let i = 0; i < trackCount; i++) {
      g.edge(eastTurnouts[i].id, bodyEnds[i].id, blockId, {
        branch: "diverging",
        curve: -dir * 18,
      });
    }

    return { leadIn, leadOut: leadEnd };
  }

  // Single-ended: close each body with a bumper
  for (let i = 0; i < trackCount; i++) {
    // bodyEnds[i] already exists; just cap it visually with an endpoint marker
    const end = g.node(
      "endpoint",
      bodyEnds[i].x + dir * 16,
      bodyEnds[i].y,
    );
    g.edge(bodyEnds[i].id, end.id, blockId);
  }
  return { leadIn, leadOut: null };
}

/**
 * Splices a passing siding into the mainline between `from` and `to`.
 * Creates sw1/sw2 on the mainline, wires from→sw1→sw2→to as the straight-through
 * route, and sw1→sideA→sideB→sw2 as the siding loop. Caller must NOT add its
 * own from→to edge; this function owns the mainline edges in that span.
 */
function insertPassingSiding(
  g: Gen,
  from: TrackNode,
  to: TrackNode,
  mainBlock: string,
  sideBlock: string,
  side: 1 | -1,
  label: string,
  mainCurve: number = 0,
): { startSw: TrackNode; endSw: TrackNode; mainEdges: TrackEdge[] } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * side;
  const py = ux * side;
  const rot = (Math.atan2(dy, dx) * 180) / Math.PI;
  const tStart = 0.28;
  const tEnd = 0.72;

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
  const sideOffset = Math.min(70, len * 0.18);
  const sideA = g.node("joint",
    sw1.x + ux * (len * (tEnd - tStart) * 0.22) + px * sideOffset,
    sw1.y + uy * (len * (tEnd - tStart) * 0.22) + py * sideOffset,
  );
  const sideB = g.node("joint",
    sw2.x - ux * (len * (tEnd - tStart) * 0.22) + px * sideOffset,
    sw2.y - uy * (len * (tEnd - tStart) * 0.22) + py * sideOffset,
  );

  // Mainline through siding (owns the span from → to)
  const me1 = g.edge(from.id, sw1.id, mainBlock, { curve: mainCurve * 0.3 });
  const me2 = g.edge(sw1.id, sw2.id, mainBlock);
  const me3 = g.edge(sw2.id, to.id, mainBlock, { curve: mainCurve * 0.3 });

  // Siding loop
  g.edge(sw1.id, sideA.id, sideBlock, { branch: "diverging", curve: side * 20 });
  g.edge(sideA.id, sideB.id, sideBlock);
  g.edge(sideB.id, sw2.id, sideBlock, { branch: "diverging", curve: -side * 20 });

  return { startSw: sw1, endSw: sw2, mainEdges: [me1, me2, me3] };
}

/**
 * Places a turnout node on an in-progress trunk path with a diverging spur.
 * Caller is responsible for connecting this turnout into the trunk via plain
 * edges (prev → turnout → next); this function only creates the spur leg.
 */
function addInlineSpur(
  g: Gen,
  turnout: TrackNode,
  trunkAngleDeg: number,
  side: 1 | -1,
  spurBlockId: string,
  spurLength: number = 160,
): TrackNode {
  const rad = (trunkAngleDeg * Math.PI) / 180;
  const px = -Math.sin(rad) * side;
  const py = Math.cos(rad) * side;
  const spurEnd = g.node("endpoint", turnout.x + px * spurLength, turnout.y + py * spurLength);
  g.edge(turnout.id, spurEnd.id, spurBlockId, { branch: "diverging", curve: side * 25 });
  return spurEnd;
}

export function generateCity(): Layout {
  const g = new Gen();

  const mainW = g.block("Main West", "#3b82f6");
  const mainN = g.block("Main North", "#06b6d4");
  const mainE = g.block("Main East", "#0ea5e9");
  const mainS = g.block("Main South", "#14b8a6");
  const yardA = g.block("Yard Alpha", "#10b981");
  const yardB = g.block("Yard Baker", "#22c55e");
  const engine = g.block("Engine Terminal", "#f59e0b");
  const indust = g.block("Industrial", "#a855f7");
  const stage = g.block("Staging", "#ef4444");
  const pax = g.block("Passenger", "#eab308");
  const mtn = g.block("Mountain Line", "#ec4899");
  const sidings = g.block("Sidings", "#f472b6");

  // ========== MAIN LOOP ==========
  const M = {
    tl: g.node("joint", 300, 260, { label: "NW" }),
    tm: g.node("joint", 1100, 160),
    tmm: g.node("joint", 1900, 160),
    tr: g.node("joint", 2700, 260, { label: "NE" }),
    rt: g.node("joint", 3040, 700),
    rm: g.node("joint", 3040, 1100),
    rb: g.node("joint", 3040, 1400),
    br: g.node("joint", 2700, 1660, { label: "SE" }),
    bm: g.node("joint", 1900, 1720),
    bmm: g.node("joint", 1100, 1720),
    bl: g.node("joint", 300, 1660, { label: "SW" }),
    lb: g.node("joint", 160, 1400),
    lm: g.node("joint", 160, 1100),
    lt: g.node("joint", 160, 700),
  };

  // Connect the main loop (with gentle curves on corners + spliced passing sidings)
  const mainSeq = [M.tl, M.tm, M.tmm, M.tr, M.rt, M.rm, M.rb, M.br, M.bm, M.bmm, M.bl, M.lb, M.lm, M.lt, M.tl];
  const mainBlocks = [mainN, mainN, mainN, mainE, mainE, mainE, mainE, mainS, mainS, mainS, mainW, mainW, mainW, mainW];
  const mainCurves = [0, 0, 60, 40, 0, 0, 40, 0, 0, 60, 40, 0, 0, 60];

  const sidingAt: Record<number, { side: 1 | -1; label: string }> = {
    1: { side: 1, label: "NPS" },   // tm → tmm (north, interior siding)
    5: { side: 1, label: "EPS" },   // rm → rb (east main)
    12: { side: 1, label: "WPS" },  // lm → lt (west main, interior)
  };
  const mainRouteEdges: string[] = [];
  for (let i = 0; i < mainSeq.length - 1; i++) {
    const cfg = sidingAt[i];
    if (cfg) {
      const { mainEdges } = insertPassingSiding(
        g,
        mainSeq[i],
        mainSeq[i + 1],
        mainBlocks[i].id,
        sidings.id,
        cfg.side,
        cfg.label,
        mainCurves[i] ?? 0,
      );
      for (const e of mainEdges) mainRouteEdges.push(e.id);
    } else {
      const edge = g.edge(mainSeq[i].id, mainSeq[i + 1].id, mainBlocks[i].id, {
        curve: mainCurves[i] ?? 0,
      });
      mainRouteEdges.push(edge.id);
    }
  }

  // ========== YARD ALPHA (west-center) ==========
  const yaLead = g.node("turnout_right", 500, 1100, { label: "YA-trunk", rotation: 0 });
  g.edge(M.lm.id, yaLead.id, mainW.id);
  // re-splice: since we already created edge lm->lb, we need a new connector via yaLead
  // Simpler: treat yaLead as a parallel industry siding on the west mainline.
  const { leadIn: yaWest } = ladderYard(g, {
    x: 620,
    y: 1080,
    trackCount: 10,
    trackLength: 90,
    spacing: 30,
    blockId: yardA.id,
    labelPrefix: "YA",
    facing: "east",
    doubleEnded: true,
  });
  g.edge(yaLead.id, yaWest.id, yardA.id, { branch: "diverging", curve: 30 });

  // ========== ENGINE TERMINAL (south of Yard Alpha) ==========
  const etTrunk = g.node("turnout_right", 650, 1330, { label: "ET-trunk" });
  g.edge(yaWest.id, etTrunk.id, yardA.id, { branch: "diverging", curve: 20 });
  const { leadIn: etLead } = ladderYard(g, {
    x: 850,
    y: 1330,
    trackCount: 6,
    trackLength: 110,
    spacing: 30,
    blockId: engine.id,
    labelPrefix: "ET",
    facing: "east",
    doubleEnded: false,
  });
  g.edge(etTrunk.id, etLead.id, engine.id, { branch: "diverging", curve: 10 });

  // ========== YARD BAKER (northeast) ==========
  const ybTrunk = g.node("turnout_left", 2200, 700, { label: "YB-trunk", rotation: 180 });
  g.edge(M.rt.id, ybTrunk.id, mainE.id);
  const { leadIn: ybLead } = ladderYard(g, {
    x: 2080,
    y: 680,
    trackCount: 8,
    trackLength: 90,
    spacing: 30,
    blockId: yardB.id,
    labelPrefix: "YB",
    facing: "west",
    doubleEnded: true,
  });
  g.edge(ybTrunk.id, ybLead.id, yardB.id, { branch: "diverging", curve: -30 });

  // ========== INDUSTRIAL BRANCH (east) — inline spurs ==========
  const ibTrunk0 = g.node("turnout_right", 2550, 1100, { label: "IB-0" });
  g.edge(M.rm.id, ibTrunk0.id, mainE.id);

  const ibPositions = [
    { x: 2400, y: 1180 },
    { x: 2250, y: 1220 },
    { x: 2100, y: 1230 },
    { x: 1950, y: 1210 },
    { x: 1800, y: 1180 },
    { x: 1650, y: 1170 },
    { x: 1500, y: 1200 },
    { x: 1350, y: 1240 },
    { x: 1200, y: 1260 },
  ];
  const ibTrunk: TrackNode[] = [ibTrunk0];
  for (let i = 0; i < ibPositions.length; i++) {
    const p = ibPositions[i];
    const prev = i === 0 ? ibTrunk0 : ibPositions[i - 1];
    const next = i < ibPositions.length - 1 ? ibPositions[i + 1] : p;
    const angleDeg = (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI;
    const isLast = i === ibPositions.length - 1;
    if (isLast) {
      ibTrunk.push(g.node("endpoint", p.x, p.y, { label: "IB end" }));
    } else {
      const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const turnoutType: NodeType = side > 0 ? "turnout_right" : "turnout_left";
      const turnout = g.node(turnoutType, p.x, p.y, {
        rotation: angleDeg,
        label: `IND-${i + 1}`,
      });
      addInlineSpur(g, turnout, angleDeg, side, indust.id, 150);
      ibTrunk.push(turnout);
    }
  }
  for (let i = 0; i < ibTrunk.length - 1; i++) {
    g.edge(ibTrunk[i].id, ibTrunk[i + 1].id, indust.id, { curve: i % 2 === 0 ? 22 : -22 });
  }

  // ========== STAGING YARD (southeast) ==========
  const stgTrunk = g.node("turnout_right", 2500, 1400, { label: "STG-trunk" });
  g.edge(M.rb.id, stgTrunk.id, mainE.id);
  const { leadIn: stgLead } = ladderYard(g, {
    x: 2450,
    y: 1480,
    trackCount: 8,
    trackLength: 90,
    spacing: 28,
    blockId: stage.id,
    labelPrefix: "STG",
    facing: "west",
    doubleEnded: true,
  });
  g.edge(stgTrunk.id, stgLead.id, stage.id, { branch: "diverging", curve: -30 });

  // ========== PASSENGER STATION (south-center) ==========
  const pxW = g.node("turnout_right", 1400, 1720, { label: "PX-W" });
  const pxE = g.node("turnout_left", 1700, 1720, { label: "PX-E", rotation: 180 });
  g.edge(M.bmm.id, pxW.id, mainS.id);
  g.edge(pxE.id, M.bm.id, mainS.id);
  g.edge(pxW.id, pxE.id, mainS.id);
  const pxPlat1a = g.node("joint", 1420, 1650);
  const pxPlat1b = g.node("joint", 1680, 1650);
  g.edge(pxW.id, pxPlat1a.id, pax.id, { branch: "diverging", curve: -20 });
  g.edge(pxPlat1a.id, pxPlat1b.id, pax.id);
  g.edge(pxPlat1b.id, pxE.id, pax.id, { branch: "diverging", curve: -20 });

  // platform stubs
  const pxStubSw1 = g.node("turnout_right", 1480, 1650, { label: "PX-S1" });
  g.edge(pxPlat1a.id, pxStubSw1.id, pax.id);
  const pxStubSw2 = g.node("turnout_left", 1620, 1650, { label: "PX-S2", rotation: 180 });
  g.edge(pxStubSw2.id, pxPlat1b.id, pax.id);
  g.edge(pxStubSw1.id, pxStubSw2.id, pax.id);
  const pxStubA = g.node("endpoint", 1480, 1580);
  const pxStubB = g.node("endpoint", 1620, 1580);
  g.edge(pxStubSw1.id, pxStubA.id, pax.id, { branch: "diverging", curve: -15 });
  g.edge(pxStubSw2.id, pxStubB.id, pax.id, { branch: "diverging", curve: 15 });

  // ========== MOUNTAIN LINE (north, serpentine with inline spurs) ==========
  const mtnW = g.node("turnout_left", 800, 160, { label: "MTN-W", rotation: 180 });
  const mtnE = g.node("turnout_right", 2100, 160, { label: "MTN-E" });
  g.edge(M.tm.id, mtnW.id, mainN.id);
  g.edge(mtnE.id, M.tmm.id, mainN.id);
  const mtnCoords = [
    { x: 950, y: 80 },
    { x: 1150, y: 40 },
    { x: 1350, y: 80 },
    { x: 1550, y: 40 },
    { x: 1750, y: 80 },
    { x: 1950, y: 60 },
  ];
  const mtnSpurAt = new Set([1, 3, 4]);
  const mtnPts: TrackNode[] = [mtnW];
  for (let i = 0; i < mtnCoords.length; i++) {
    const p = mtnCoords[i];
    if (mtnSpurAt.has(i)) {
      const prev = i === 0 ? mtnW : mtnCoords[i - 1];
      const next = mtnCoords[i + 1] ?? mtnE;
      const angleDeg = (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI;
      const side: 1 | -1 = i % 2 === 0 ? -1 : 1;
      const turnoutType: NodeType = side > 0 ? "turnout_right" : "turnout_left";
      const turnout = g.node(turnoutType, p.x, p.y, {
        rotation: angleDeg,
        label: `MTN-S${i}`,
      });
      addInlineSpur(g, turnout, angleDeg, side, mtn.id, 120);
      mtnPts.push(turnout);
    } else {
      mtnPts.push(g.node("joint", p.x, p.y));
    }
  }
  mtnPts.push(mtnE);
  for (let i = 0; i < mtnPts.length - 1; i++) {
    const curve = i % 2 === 0 ? -40 : 40;
    const branch = i === 0 || i === mtnPts.length - 2 ? "diverging" : "main";
    g.edge(mtnPts[i].id, mtnPts[i + 1].id, mtn.id, { branch, curve });
  }

  // ========== CROSSOVERS on east main ==========
  // small 2-turnout crossover pairs between mainline segments
  // Simplified: add a few extra sidings

  // ========== TRAINS ==========
  const trains = seedTrains(g, { mainRouteEdges });

  return {
    id: "city",
    name: "Granite Falls & Western",
    nodes: g.nodes,
    edges: g.edges,
    blocks: g.blocks,
    trains,
    updatedAt: new Date().toISOString(),
  };
}

function seedTrains(
  _g: Gen,
  refs: { mainRouteEdges: string[] },
): Train[] {
  const mainRoute = refs.mainRouteEdges;
  if (mainRoute.length === 0) return [];

  const trains: Train[] = [];
  const seeds: Array<{
    id: string;
    road: string;
    number: string;
    color: string;
    velocity: number;
    maxVelocity: number;
    routeIndex: number;
    offset: number;
  }> = [
    { id: "t-up", road: "UP", number: "4014", color: "#f59e0b", velocity: 55, maxVelocity: 100, routeIndex: 0, offset: 0.2 },
    { id: "t-bnsf", road: "BNSF", number: "4429", color: "#fb923c", velocity: 75, maxVelocity: 120, routeIndex: Math.floor(mainRoute.length * 0.4), offset: 0.4 },
    { id: "t-amtk", road: "AMTK", number: "156", color: "#60a5fa", velocity: 95, maxVelocity: 140, routeIndex: Math.floor(mainRoute.length * 0.7), offset: 0.1 },
  ];

  for (const s of seeds) {
    const edgeId = mainRoute[s.routeIndex];
    if (!edgeId) continue;
    trains.push({
      id: s.id,
      road: s.road,
      number: s.number,
      color: s.color,
      length: 3,
      position: { edgeId, offset: s.offset, direction: "forward" },
      velocity: s.velocity,
      maxVelocity: s.maxVelocity,
      route: mainRoute,
      routeIndex: s.routeIndex,
      waiting: false,
      paused: false,
    });
  }
  return trains;
}
