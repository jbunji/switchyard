"use client";

import type { Train, TrackEdge, TrackNode } from "@/lib/graph/types";
import { edgeGeometry } from "@/lib/graph/geometry";

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

  const geo = edgeGeometry(from, to, edge.curve);
  const sample = geo.sampleAt(train.position.offset);
  const baseAngle = (Math.atan2(sample.ty, sample.tx) * 180) / Math.PI;
  const angle = train.position.direction === "reverse" ? baseAngle + 180 : baseAngle;

  return (
    <g transform={`translate(${sample.x}, ${sample.y}) rotate(${angle})`}>
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
