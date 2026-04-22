"use client";

import { useMemo } from "react";
import type { Block, TrackEdge, TrackNode } from "@/lib/graph/types";

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
  const { dx, dy, angle, ties } = useMemo(() => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const count = Math.max(2, Math.floor(len / TIE_SPACING));
    const ties = Array.from({ length: count }, (_, i) => (i + 0.5) / count);
    return { dx, dy, angle, ties };
  }, [from.x, from.y, to.x, to.y]);

  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const px = -ny;
  const py = nx;

  const railOffset = RAIL_GAUGE / 2;
  const rail1 = {
    x1: from.x + px * railOffset,
    y1: from.y + py * railOffset,
    x2: to.x + px * railOffset,
    y2: to.y + py * railOffset,
  };
  const rail2 = {
    x1: from.x - px * railOffset,
    y1: from.y - py * railOffset,
    x2: to.x - px * railOffset,
    y2: to.y - py * railOffset,
  };

  const occupied = block?.occupied ?? false;
  const ballastColor = occupied ? "#4a2520" : "#2a2520";
  const tieColor = occupied ? "#6b3a2a" : "#5a3a28";
  const glowColor = block?.color ?? "#3b82f6";

  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : undefined }}>
      {isSelected && (
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="#fafafa"
          strokeWidth={BALLAST_WIDTH + 12}
          strokeOpacity={0.35}
          strokeLinecap="round"
        />
      )}
      {occupied && (
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={glowColor}
          strokeWidth={BALLAST_WIDTH + 8}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />
      )}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={ballastColor}
        strokeWidth={BALLAST_WIDTH}
        strokeLinecap="round"
      />
      {ties.map((t, i) => {
        const cx = from.x + dx * t;
        const cy = from.y + dy * t;
        return (
          <line
            key={`${edge.id}-t-${i}`}
            x1={cx + px * (TIE_LENGTH / 2)}
            y1={cy + py * (TIE_LENGTH / 2)}
            x2={cx - px * (TIE_LENGTH / 2)}
            y2={cy - py * (TIE_LENGTH / 2)}
            stroke={tieColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
        );
      })}
      <line {...rail1} stroke="#d4d4d8" strokeWidth={1.5} />
      <line {...rail2} stroke="#d4d4d8" strokeWidth={1.5} />
      <line {...rail1} stroke="#ffffff" strokeWidth={0.5} strokeOpacity={0.6} />
      <line {...rail2} stroke="#ffffff" strokeWidth={0.5} strokeOpacity={0.6} />
    </g>
  );
}
