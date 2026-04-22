"use client";

import { useLayoutStore } from "@/lib/store/layout";

export function CursorGhost() {
  const tool = useLayoutStore((s) => s.tool);
  const cursor = useLayoutStore((s) => s.cursor);
  const draw = useLayoutStore((s) => s.draw);

  if (tool === "select" || tool === "pan") return null;

  const x = cursor.snappedX;
  const y = cursor.snappedY;
  const onTarget = cursor.snapTargetId !== null;

  if (tool === "place_turnout_left" || tool === "place_turnout_right") {
    const flip = tool === "place_turnout_left" ? -1 : 1;
    return (
      <g opacity={0.6} pointerEvents="none">
        <circle cx={x} cy={y} r={14} fill="#10b981" fillOpacity={0.15} />
        <circle cx={x} cy={y} r={8} fill="#10b981" stroke="#34d399" strokeWidth={1.5} />
        <line
          x1={x}
          y1={y}
          x2={x + 30}
          y2={y}
          stroke="#52525b"
          strokeWidth={2}
          strokeDasharray="3 2"
        />
        <line
          x1={x}
          y1={y}
          x2={x + 25}
          y2={y + 18 * flip}
          stroke="#52525b"
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      </g>
    );
  }

  if (tool === "place_straight") {
    return (
      <g pointerEvents="none">
        <circle
          cx={x}
          cy={y}
          r={onTarget ? 10 : 5}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={1.5}
          opacity={0.8}
        />
        {!draw.fromNodeId && (
          <circle cx={x} cy={y} r={2} fill="#fbbf24" />
        )}
      </g>
    );
  }

  if (tool === "delete") {
    return (
      <g pointerEvents="none" opacity={0.5}>
        <circle cx={x} cy={y} r={6} fill="none" stroke="#ef4444" strokeWidth={1.5} />
      </g>
    );
  }

  return null;
}
