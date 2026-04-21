"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLayoutStore } from "@/lib/store/layout";
import { TrackEdgeView } from "./TrackEdge";
import { TrackNodeView } from "./TrackNode";
import { TrainMarker } from "./TrainMarker";

export function TrackCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const layout = useLayoutStore((s) => s.layout);
  const viewport = useLayoutStore((s) => s.viewport);
  const setViewport = useLayoutStore((s) => s.setViewport);
  const select = useLayoutStore((s) => s.select);

  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.max(0.1, Math.min(6, viewport.scale * factor));
      const nx = mx - (mx - viewport.x) * (newScale / viewport.scale);
      const ny = my - (my - viewport.y) * (newScale / viewport.scale);
      setViewport({ x: nx, y: ny, scale: newScale });
    },
    [viewport, setViewport],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      if (e.target === svgRef.current || (e.target as SVGElement).tagName === "rect") {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
        select(null);
      }
    },
    [viewport, select],
  );

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      if (!panStart.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setViewport({
        x: panStart.current.vx + dx,
        y: panStart.current.vy + dy,
        scale: viewport.scale,
      });
    };
    const onUp = () => {
      setIsPanning(false);
      panStart.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning, viewport.scale, setViewport]);

  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
  const blockMap = new Map(layout.blocks.map((b) => [b.id, b]));

  const gridSize = 40;
  const gridPattern = (
    <defs>
      <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
        <path
          d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
          fill="none"
          stroke="#27272a"
          strokeWidth={0.5}
        />
      </pattern>
      <pattern id="grid-major" width={gridSize * 5} height={gridSize * 5} patternUnits="userSpaceOnUse">
        <path
          d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`}
          fill="none"
          stroke="#3f3f46"
          strokeWidth={0.75}
        />
      </pattern>
    </defs>
  );

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      style={{
        background: "#09090b",
        cursor: isPanning ? "grabbing" : "default",
        touchAction: "none",
      }}
    >
      {gridPattern}
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#grid-major)" />
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`}>
        {layout.edges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          return (
            <TrackEdgeView
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              block={blockMap.get(edge.blockId)}
            />
          );
        })}
        {layout.nodes.map((node) => (
          <TrackNodeView key={node.id} node={node} />
        ))}
        {layout.trains.map((train) => (
          <TrainMarker key={train.id} train={train} edges={layout.edges} nodes={layout.nodes} />
        ))}
      </g>
    </svg>
  );
}
