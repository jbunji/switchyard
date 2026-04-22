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

function industrySpur(
  g: Gen,
  trunkPrev: TrackNode,
  trunkNext: TrackNode,
  blockId: string,
  spurBlockId: string,
  label: string,
  side: 1 | -1,
): TrackNode {
  // Split: insert a turnout between trunkPrev and trunkNext
  // Actually caller controls trunk edges — we just add a turnout node and wire it.
  // Here we re-create the segment via new node.
  const mx = (trunkPrev.x + trunkNext.x) / 2;
  const my = (trunkPrev.y + trunkNext.y) / 2;
  const dx = trunkNext.x - trunkPrev.x;
  const dy = trunkNext.y - trunkPrev.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = mx;
  const ty = my;
  const turnoutType: NodeType = side > 0 ? "turnout_right" : "turnout_left";
  const rot = (Math.atan2(dy, dx) * 180) / Math.PI;
  const turnout = g.node(turnoutType, tx, ty, { rotation: rot, label });

  const px = (-dy / len) * side;
  const py = (dx / len) * side;
  const spur = g.node("endpoint", tx + px * 180, ty + py * 180);
  g.edge(turnout.id, spur.id, spurBlockId, { branch: "diverging", curve: side * 30 });
  return turnout;
}

function passingSiding(
  g: Gen,
  startNode: TrackNode,
  endNode: TrackNode,
  mainBlock: string,
  sideBlock: string,
  side: 1 | -1,
  label: string,
): { startSw: TrackNode; endSw: TrackNode } {
  const dx = endNode.x - startNode.x;
  const dy = endNode.y - startNode.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * side;
  const py = ux * side;
  const tStart = 0.22;
  const tEnd = 0.78;

  const sw1 = g.node(side > 0 ? "turnout_right" : "turnout_left",
    startNode.x + dx * tStart,
    startNode.y + dy * tStart,
    { rotation: (Math.atan2(dy, dx) * 180) / Math.PI, label: `${label}-W` },
  );
  const sw2 = g.node(side > 0 ? "turnout_left" : "turnout_right",
    startNode.x + dx * tEnd,
    startNode.y + dy * tEnd,
    { rotation: (Math.atan2(dy, dx) * 180) / Math.PI, label: `${label}-E` },
  );
  const sideA = g.node("joint",
    sw1.x + ux * (len * (tEnd - tStart) * 0.2) + px * 60,
    sw1.y + uy * (len * (tEnd - tStart) * 0.2) + py * 60,
  );
  const sideB = g.node("joint",
    sw2.x - ux * (len * (tEnd - tStart) * 0.2) + px * 60,
    sw2.y - uy * (len * (tEnd - tStart) * 0.2) + py * 60,
  );

  g.edge(sw1.id, sideA.id, sideBlock, { branch: "diverging", curve: side * 25 });
  g.edge(sideA.id, sideB.id, sideBlock);
  g.edge(sideB.id, sw2.id, sideBlock, { branch: "diverging", curve: -side * 25 });

  return { startSw: sw1, endSw: sw2 };
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

  // Connect the main loop (with gentle curves on corners)
  const mainSeq = [M.tl, M.tm, M.tmm, M.tr, M.rt, M.rm, M.rb, M.br, M.bm, M.bmm, M.bl, M.lb, M.lm, M.lt, M.tl];
  const mainBlocks = [mainN, mainN, mainN, mainE, mainE, mainE, mainE, mainS, mainS, mainS, mainW, mainW, mainW, mainW];
  const mainCurves = [0, 0, 60, 40, 0, 0, 40, 0, 0, 60, 40, 0, 0, 60];
  for (let i = 0; i < mainSeq.length - 1; i++) {
    g.edge(mainSeq[i].id, mainSeq[i + 1].id, mainBlocks[i].id, { curve: mainCurves[i] ?? 0 });
  }

  // ========== PASSING SIDINGS on main ==========
  passingSiding(g, M.tm, M.tmm, mainN.id, sidings.id, -1, "NPS");
  passingSiding(g, M.bmm, M.bm, mainS.id, sidings.id, 1, "SPS");
  passingSiding(g, M.rt, M.rm, mainE.id, sidings.id, -1, "EPS");
  passingSiding(g, M.lm, M.lt, mainW.id, sidings.id, 1, "WPS");

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

  // ========== INDUSTRIAL BRANCH (east) ==========
  const ibTrunk0 = g.node("turnout_right", 2550, 1100, { label: "IB-trunk" });
  g.edge(M.rm.id, ibTrunk0.id, mainE.id);

  const trunkPoints: TrackNode[] = [ibTrunk0];
  const positions = [
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
  for (const p of positions) {
    const n = g.node("joint", p.x, p.y);
    trunkPoints.push(n);
  }
  for (let i = 0; i < trunkPoints.length - 1; i++) {
    g.edge(trunkPoints[i].id, trunkPoints[i + 1].id, indust.id, { curve: i % 2 === 0 ? 30 : -30 });
  }

  // Industry spurs off the trunk
  for (let i = 1; i < trunkPoints.length - 1; i++) {
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
    industrySpur(g, trunkPoints[i - 1], trunkPoints[i], indust.id, indust.id, `IND-${i}`, side);
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

  // ========== MOUNTAIN LINE (north, serpentine) ==========
  const mtnW = g.node("turnout_left", 800, 160, { label: "MTN-W", rotation: 180 });
  const mtnE = g.node("turnout_right", 2100, 160, { label: "MTN-E" });
  g.edge(M.tm.id, mtnW.id, mainN.id);
  g.edge(mtnE.id, M.tmm.id, mainN.id);
  g.edge(mtnW.id, mtnE.id, mainN.id);
  const mtnPts: TrackNode[] = [mtnW];
  const mtnCoords = [
    { x: 950, y: 80 },
    { x: 1150, y: 40 },
    { x: 1350, y: 80 },
    { x: 1550, y: 40 },
    { x: 1750, y: 80 },
    { x: 1950, y: 60 },
  ];
  for (const c of mtnCoords) {
    mtnPts.push(g.node("joint", c.x, c.y));
  }
  mtnPts.push(mtnE);
  for (let i = 0; i < mtnPts.length - 1; i++) {
    const from = mtnPts[i];
    const to = mtnPts[i + 1];
    const curve = i % 2 === 0 ? -40 : 40;
    g.edge(from.id, to.id, mtn.id, { branch: i === 0 || i === mtnPts.length - 2 ? "diverging" : "main", curve });
  }
  // Mountain crossovers (a couple)
  industrySpur(g, mtnPts[1], mtnPts[2], mtn.id, mtn.id, "MTN-S1", 1);
  industrySpur(g, mtnPts[3], mtnPts[4], mtn.id, mtn.id, "MTN-S2", -1);
  industrySpur(g, mtnPts[4], mtnPts[5], mtn.id, mtn.id, "MTN-S3", 1);

  // ========== CROSSOVERS on east main ==========
  // small 2-turnout crossover pairs between mainline segments
  // Simplified: add a few extra sidings

  // ========== TRAINS ==========
  const trains = seedTrains(g, {
    mainSeq,
    mainBlocks: mainBlocks.map((b) => b.id),
  });

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
  g: Gen,
  refs: { mainSeq: TrackNode[]; mainBlocks: string[] },
): Train[] {
  // Build main-loop route: sequence of edges between consecutive mainSeq nodes
  const edgeByPair = new Map<string, TrackEdge>();
  for (const e of g.edges) {
    edgeByPair.set(`${e.from}|${e.to}`, e);
    edgeByPair.set(`${e.to}|${e.from}`, e);
  }

  const mainRoute: string[] = [];
  for (let i = 0; i < refs.mainSeq.length - 1; i++) {
    const key = `${refs.mainSeq[i].id}|${refs.mainSeq[i + 1].id}`;
    const e = edgeByPair.get(key);
    if (e) mainRoute.push(e.id);
  }

  const firstEdge = g.edges.find((e) => e.id === mainRoute[0]);
  const secondEdge = g.edges.find((e) => e.id === mainRoute[8]);

  const trains: Train[] = [];
  if (firstEdge) {
    trains.push({
      id: "t-union-pacific",
      road: "UP",
      number: "4014",
      color: "#f59e0b",
      length: 3,
      position: { edgeId: firstEdge.id, offset: 0.1, direction: "forward" },
      velocity: 50,
      maxVelocity: 100,
      route: mainRoute,
      routeIndex: 0,
      waiting: false,
      paused: false,
    });
  }
  if (secondEdge) {
    trains.push({
      id: "t-bnsf",
      road: "BNSF",
      number: "4429",
      color: "#fb923c",
      length: 3,
      position: { edgeId: secondEdge.id, offset: 0.5, direction: "forward" },
      velocity: 70,
      maxVelocity: 120,
      route: mainRoute,
      routeIndex: 8,
      waiting: false,
      paused: false,
    });
  }
  if (mainRoute.length > 4) {
    const third = g.edges.find((e) => e.id === mainRoute[4]);
    if (third) {
      trains.push({
        id: "t-amtrak",
        road: "AMTK",
        number: "156",
        color: "#60a5fa",
        length: 3,
        position: { edgeId: third.id, offset: 0.2, direction: "forward" },
        velocity: 90,
        maxVelocity: 140,
        route: mainRoute,
        routeIndex: 4,
        waiting: false,
        paused: false,
      });
    }
  }

  return trains;
}
