import type { Block, Layout, TrackEdge, TrackNode, Train } from "./types";

export function demoLayout(): Layout {
  const nodes: TrackNode[] = [
    { id: "n1", type: "endpoint", x: 120, y: 300, rotation: 0 },
    { id: "n2", type: "turnout_right", x: 320, y: 300, rotation: 0, state: "normal", label: "SW1" },
    { id: "n3", type: "turnout_left", x: 720, y: 300, rotation: 0, state: "normal", label: "SW2" },
    { id: "n4", type: "endpoint", x: 920, y: 300, rotation: 0 },
    { id: "n5", type: "endpoint", x: 720, y: 160, rotation: 0 },
    { id: "n6", type: "endpoint", x: 320, y: 440, rotation: 0 },
    { id: "n7", type: "turnout_right", x: 520, y: 300, rotation: 0, state: "normal", label: "SW3" },
    { id: "n8", type: "endpoint", x: 520, y: 440, rotation: 0 },
  ];

  const edges: TrackEdge[] = [
    { id: "e1", from: "n1", to: "n2", blockId: "b-main-w", length: 200, branch: "main" },
    { id: "e2", from: "n2", to: "n7", blockId: "b-main-c", length: 200, branch: "main" },
    { id: "e3", from: "n7", to: "n3", blockId: "b-main-c", length: 200, branch: "main" },
    { id: "e4", from: "n3", to: "n4", blockId: "b-main-e", length: 200, branch: "main" },
    { id: "e5", from: "n3", to: "n5", blockId: "b-siding-n", length: 140, branch: "diverging" },
    { id: "e6", from: "n2", to: "n6", blockId: "b-siding-s", length: 140, branch: "diverging" },
    { id: "e7", from: "n7", to: "n8", blockId: "b-indust", length: 140, branch: "diverging" },
  ];

  const blocks: Block[] = [
    { id: "b-main-w", name: "Main West", color: "#3b82f6", occupied: false, reservedBy: null },
    { id: "b-main-c", name: "Main Center", color: "#10b981", occupied: true, reservedBy: null },
    { id: "b-main-e", name: "Main East", color: "#f59e0b", occupied: false, reservedBy: null },
    { id: "b-siding-n", name: "North Siding", color: "#a855f7", occupied: false, reservedBy: null },
    { id: "b-siding-s", name: "South Siding", color: "#ef4444", occupied: false, reservedBy: null },
    { id: "b-indust", name: "Industrial", color: "#eab308", occupied: false, reservedBy: null },
  ];

  const trains: Train[] = [
    {
      id: "t1",
      road: "BNSF",
      number: "4429",
      color: "#f97316",
      length: 3,
      position: { edgeId: "e2", offset: 0.5, direction: "forward" },
    },
  ];

  return {
    id: "demo",
    name: "Demo Layout",
    nodes,
    edges,
    blocks,
    trains,
    updatedAt: new Date().toISOString(),
  };
}
