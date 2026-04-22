"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLayoutStore } from "@/lib/store/layout";
import { edgeGeometry, projectOntoPerpendicular } from "@/lib/graph/geometry";

export function EdgeBendHandle() {
  const selection = useLayoutStore((s) => s.selection);
  const layout = useLayoutStore((s) => s.layout);
  const viewport = useLayoutStore((s) => s.viewport);
  const updateEdgeCurve = useLayoutStore((s) => s.updateEdgeCurve);

  const edge = selection?.kind === "edge" ? layout.edges.find((e) => e.id === selection.id) : null;
  const from = edge ? layout.nodes.find((n) => n.id === edge.from) : null;
  const to = edge ? layout.nodes.find((n) => n.id === edge.to) : null;

  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ startCurve: number; startX: number; startY: number } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!edge) return;
      e.stopPropagation();
      e.preventDefault();
      dragStart.current = {
        startCurve: edge.curve,
        startX: e.clientX,
        startY: e.clientY,
      };
      setDragging(true);
    },
    [edge],
  );

  useEffect(() => {
    if (!dragging || !edge || !from || !to) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const worldDX = (e.clientX - dragStart.current.startX) / viewport.scale;
      const worldDY = (e.clientY - dragStart.current.startY) / viewport.scale;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;
      const perpX = -dy / len;
      const perpY = dx / len;
      const delta = worldDX * perpX + worldDY * perpY;
      let next = dragStart.current.startCurve + delta;
      if (Math.abs(next) < 6) next = 0;
      updateEdgeCurve(edge.id, Math.round(next));
    };
    const onUp = () => {
      setDragging(false);
      dragStart.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, edge, from, to, viewport.scale, updateEdgeCurve]);

  if (!edge || !from || !to) return null;

  const geo = edgeGeometry(from, to, edge.curve);
  const handleX = geo.control.x;
  const handleY = geo.control.y;

  return (
    <g>
      <line
        x1={geo.midpoint.x}
        y1={geo.midpoint.y}
        x2={handleX}
        y2={handleY}
        stroke="#fbbf24"
        strokeWidth={1}
        strokeOpacity={0.5}
        strokeDasharray="2 2"
        pointerEvents="none"
      />
      <circle
        cx={handleX}
        cy={handleY}
        r={10}
        fill="transparent"
        stroke="transparent"
        onMouseDown={onMouseDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          updateEdgeCurve(edge.id, 0);
        }}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      />
      <circle
        cx={handleX}
        cy={handleY}
        r={5}
        fill={dragging ? "#f59e0b" : "#fbbf24"}
        stroke="#18181b"
        strokeWidth={1.5}
        pointerEvents="none"
      />
    </g>
  );
}

export { projectOntoPerpendicular };
