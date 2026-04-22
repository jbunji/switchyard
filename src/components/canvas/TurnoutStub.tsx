"use client";

interface Props {
  x: number;
  y: number;
  angleDeg: number;
  length?: number;
  color?: string;
  opacity?: number;
}

export function TurnoutStub({
  x,
  y,
  angleDeg,
  length = 28,
  color = "#3f3f46",
  opacity = 0.85,
}: Props) {
  const rad = (angleDeg * Math.PI) / 180;
  const ex = x + Math.cos(rad) * length;
  const ey = y + Math.sin(rad) * length;
  const perpX = -Math.sin(rad);
  const perpY = Math.cos(rad);
  const gauge = 3;

  return (
    <g opacity={opacity} pointerEvents="none">
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={color} strokeWidth={10} strokeLinecap="round" />
      <line
        x1={x + perpX * gauge}
        y1={y + perpY * gauge}
        x2={ex + perpX * gauge}
        y2={ey + perpY * gauge}
        stroke="#a1a1aa"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <line
        x1={x - perpX * gauge}
        y1={y - perpY * gauge}
        x2={ex - perpX * gauge}
        y2={ey - perpY * gauge}
        stroke="#a1a1aa"
        strokeWidth={1}
        strokeLinecap="round"
      />
    </g>
  );
}

export function divergeAngle(type: string): number {
  if (type === "turnout_left") return -25;
  if (type === "turnout_right") return 25;
  return 0;
}
