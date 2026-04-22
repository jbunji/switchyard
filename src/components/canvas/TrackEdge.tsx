"use client";

import { useMemo } from "react";
import type { Block, TrackEdge, TrackNode } from "@/lib/graph/types";
import { edgeGeometry } from "@/lib/graph/geometry";

interface Props {
  edge: TrackEdge;
  from: TrackNode;
  to: TrackNode;
  block: Block | undefined;
  isSelected?: boolean;
  onClick?: () => void;
}

const RAIL_GAUGE = 8;
const BALLAST_WIDTH = 22;
const TIE_SPACING = 14;
const TIE_LENGTH = 16;

export function TrackEdgeView({ edge, from, to, block, isSelected, onClick }: Props) {
  const { path, ties, rail1, rail2 } = useMemo(() => {
    const geo = edgeGeometry(from, to, edge.curve);
    const tieCount = Math.max(2, Math.floor(geo.length / TIE_SPACING));
    const sampleCount = Math.max(tieCount * 2, 24);
    const samples = geo.samples(sampleCount);

    const tieStep = Math.max(1, Math.floor(sampleCount / tieCount));
    const ties: { x: number; y: number; tx: number; ty: number }[] = [];
    for (let i = Math.floor(tieStep / 2); i < sampleCount; i += tieStep) {
      ties.push(samples[i]);
    }

    const rail1Points: string[] = [];
    const rail2Points: string[] = [];
    for (const s of samples) {
      const px = -s.ty;
      const py = s.tx;
      rail1Points.push(`${s.x + px * (RAIL_GAUGE / 2)},${s.y + py * (RAIL_GAUGE / 2)}`);
      rail2Points.push(`${s.x - px * (RAIL_GAUGE / 2)},${s.y - py * (RAIL_GAUGE / 2)}`);
    }

    return {
      path: geo.d,
      ties,
      rail1: rail1Points.join(" "),
      rail2: rail2Points.join(" "),
    };
  }, [from, to, edge.curve]);

  const occupied = block?.occupied ?? false;
  const ballastColor = occupied ? "#4a2520" : "#2a2520";
  const tieColor = occupied ? "#6b3a2a" : "#5a3a28";
  const glowColor = block?.color ?? "#3b82f6";

  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : undefined }}>
      {isSelected && (
        <path
          d={path}
          fill="none"
          stroke="#fafafa"
          strokeWidth={BALLAST_WIDTH + 12}
          strokeOpacity={0.35}
          strokeLinecap="round"
        />
      )}
      {occupied && (
        <path
          d={path}
          fill="none"
          stroke={glowColor}
          strokeWidth={BALLAST_WIDTH + 8}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={ballastColor}
        strokeWidth={BALLAST_WIDTH}
        strokeLinecap="round"
      />
      {ties.map((t, i) => {
        const px = -t.ty;
        const py = t.tx;
        return (
          <line
            key={`${edge.id}-t-${i}`}
            x1={t.x + px * (TIE_LENGTH / 2)}
            y1={t.y + py * (TIE_LENGTH / 2)}
            x2={t.x - px * (TIE_LENGTH / 2)}
            y2={t.y - py * (TIE_LENGTH / 2)}
            stroke={tieColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
        );
      })}
      <polyline points={rail1} fill="none" stroke="#d4d4d8" strokeWidth={1.5} strokeLinejoin="round" />
      <polyline points={rail2} fill="none" stroke="#d4d4d8" strokeWidth={1.5} strokeLinejoin="round" />
      <polyline
        points={rail1}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.5}
        strokeOpacity={0.6}
        strokeLinejoin="round"
      />
      <polyline
        points={rail2}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.5}
        strokeOpacity={0.6}
        strokeLinejoin="round"
      />
    </g>
  );
}
