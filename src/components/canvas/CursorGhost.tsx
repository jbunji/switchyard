"use client";

import { useLayoutStore } from "@/lib/store/layout";
import { TurnoutStub, divergeAngle } from "./TurnoutStub";

export function CursorGhost() {
  const tool = useLayoutStore((s) => s.tool);
  const cursor = useLayoutStore((s) => s.cursor);
  const draw = useLayoutStore((s) => s.draw);
  const ghostRotation = useLayoutStore((s) => s.ghostRotation);

  if (tool === "select" || tool === "pan") return null;

  const x = cursor.snappedX;
  const y = cursor.snappedY;
  const onTarget = cursor.snapTargetId !== null;

  if (tool === "place_turnout_left" || tool === "place_turnout_right") {
    const type = tool === "place_turnout_left" ? "turnout_left" : "turnout_right";
    const mainAngle = ghostRotation;
    const divAngle = ghostRotation + divergeAngle(type);
    return (
      <g opacity={0.65} pointerEvents="none">
        <TurnoutStub x={x} y={y} angleDeg={mainAngle} color="#52525b" opacity={0.8} />
        <TurnoutStub x={x} y={y} angleDeg={divAngle} color="#52525b" opacity={0.8} />
        <circle cx={x} cy={y} r={14} fill="#10b981" fillOpacity={0.2} />
        <circle cx={x} cy={y} r={8} fill="#10b981" stroke="#34d399" strokeWidth={1.5} />
        <text
          x={x + 20}
          y={y - 18}
          fontSize={9}
          fontFamily="var(--font-geist-mono)"
          fill="#fbbf24"
          style={{ userSelect: "none" }}
        >
          {Math.round(ghostRotation)}°
        </text>
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
        {!draw.fromNodeId && <circle cx={x} cy={y} r={2} fill="#fbbf24" />}
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
