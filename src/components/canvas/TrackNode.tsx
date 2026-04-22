"use client";

import type { TrackNode } from "@/lib/graph/types";

interface Props {
  node: TrackNode;
  isSelected?: boolean;
  isSnapTarget?: boolean;
  onClick?: () => void;
}

export function TrackNodeView({ node, isSelected, isSnapTarget, onClick }: Props) {
  const isTurnout = node.type.startsWith("turnout");

  if (isTurnout) {
    const normal = node.state !== "diverging";
    const fill = normal ? "#10b981" : "#ef4444";
    const ring = normal ? "#34d399" : "#fca5a5";
    return (
      <g
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        style={{ cursor: onClick ? "pointer" : "default" }}
      >
        {isSnapTarget && (
          <circle cx={node.x} cy={node.y} r={18} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" />
        )}
        <circle cx={node.x} cy={node.y} r={14} fill={fill} fillOpacity={0.2} />
        <circle
          cx={node.x}
          cy={node.y}
          r={8}
          fill={fill}
          stroke={isSelected ? "#ffffff" : ring}
          strokeWidth={isSelected ? 2.5 : 1.5}
        />
        {node.label && (
          <text
            x={node.x}
            y={node.y - 18}
            textAnchor="middle"
            fontSize={10}
            fontFamily="var(--font-geist-mono)"
            fill="#d4d4d8"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {node.label}
          </text>
        )}
      </g>
    );
  }

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      {isSnapTarget && (
        <circle cx={node.x} cy={node.y} r={12} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" />
      )}
      <circle
        cx={node.x}
        cy={node.y}
        r={4}
        fill="#71717a"
        stroke={isSelected ? "#ffffff" : "#52525b"}
        strokeWidth={isSelected ? 2 : 1}
      />
    </g>
  );
}
