"use client";

import type { Train, TrackEdge, TrackNode } from "@/lib/graph/types";

interface Props {
  train: Train;
  edges: TrackEdge[];
  nodes: TrackNode[];
}

export function TrainMarker({ train, edges, nodes }: Props) {
  if (!train.position) return null;
  const edge = edges.find((e) => e.id === train.position!.edgeId);
  if (!edge) return null;
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;

  const t = train.position.offset;
  const cx = from.x + (to.x - from.x) * t;
  const cy = from.y + (to.y - from.y) * t;
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
      <rect
        x={-22}
        y={-8}
        width={44}
        height={16}
        rx={3}
        fill={train.color}
        stroke="#18181b"
        strokeWidth={1.5}
      />
      <rect x={-20} y={-6} width={6} height={3} fill="#18181b" opacity={0.4} />
      <rect x={-10} y={-6} width={6} height={3} fill="#18181b" opacity={0.4} />
      <rect x={0} y={-6} width={6} height={3} fill="#18181b" opacity={0.4} />
      <text
        x={0}
        y={3}
        textAnchor="middle"
        fontSize={8}
        fontFamily="var(--font-geist-mono)"
        fontWeight={700}
        fill="#18181b"
        transform={Math.abs(angle) > 90 ? "rotate(180)" : undefined}
      >
        {train.road} {train.number}
      </text>
    </g>
  );
}
