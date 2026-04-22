"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLayoutStore } from "@/lib/store/layout";
import { findNearestNode, snapPoint } from "@/lib/graph/ops";
import { TrackEdgeView } from "./TrackEdge";
import { TrackNodeView } from "./TrackNode";
import { TrainMarker } from "./TrainMarker";
import { CursorGhost } from "./CursorGhost";

export function TrackCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const layout = useLayoutStore((s) => s.layout);
  const viewport = useLayoutStore((s) => s.viewport);
  const setViewport = useLayoutStore((s) => s.setViewport);
  const tool = useLayoutStore((s) => s.tool);
  const cursor = useLayoutStore((s) => s.cursor);
  const setCursor = useLayoutStore((s) => s.setCursor);
  const selection = useLayoutStore((s) => s.selection);
  const select = useLayoutStore((s) => s.select);
  const draw = useLayoutStore((s) => s.draw);
  const setDrawFrom = useLayoutStore((s) => s.setDrawFrom);
  const placeNode = useLayoutStore((s) => s.placeNode);
  const connectNodes = useLayoutStore((s) => s.connectNodes);
  const placeEndpointAndConnect = useLayoutStore((s) => s.placeEndpointAndConnect);
  const deleteSelection = useLayoutStore((s) => s.deleteSelection);
  const gridSize = useLayoutStore((s) => s.gridSize);
  const gridEnabled = useLayoutStore((s) => s.gridEnabled);
  const snapEnabled = useLayoutStore((s) => s.snapEnabled);
  const snapRadius = useLayoutStore((s) => s.snapRadius);

  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const cx = sx - rect.left;
      const cy = sy - rect.top;
      return {
        x: (cx - viewport.x) / viewport.scale,
        y: (cy - viewport.y) / viewport.scale,
      };
    },
    [viewport],
  );

  const computeSnap = useCallback(
    (wx: number, wy: number) => {
      const gridSnapped = snapPoint(wx, wy, gridSize, gridEnabled);
      if (snapEnabled) {
        const near = findNearestNode(layout.nodes, wx, wy, snapRadius / viewport.scale);
        if (near) {
          return { x: near.x, y: near.y, targetId: near.id };
        }
      }
      return { x: gridSnapped.x, y: gridSnapped.y, targetId: null };
    },
    [layout.nodes, gridSize, gridEnabled, snapEnabled, snapRadius, viewport.scale],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const world = screenToWorld(e.clientX, e.clientY);
      const snap = computeSnap(world.x, world.y);
      setCursor({
        worldX: world.x,
        worldY: world.y,
        snappedX: snap.x,
        snappedY: snap.y,
        snapTargetId: snap.targetId,
      });
    },
    [screenToWorld, computeSnap, setCursor],
  );

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

  const handleCanvasClick = useCallback(() => {
    const world = { x: cursor.worldX, y: cursor.worldY };
    const snap = computeSnap(world.x, world.y);

    if (tool === "place_turnout_left") {
      placeNode("turnout_left", snap.x, snap.y);
      return;
    }
    if (tool === "place_turnout_right") {
      placeNode("turnout_right", snap.x, snap.y);
      return;
    }
    if (tool === "place_straight") {
      if (!draw.fromNodeId) {
        if (snap.targetId) {
          setDrawFrom(snap.targetId);
        } else {
          const node = placeNode("endpoint", snap.x, snap.y);
          setDrawFrom(node.id);
        }
      } else {
        if (snap.targetId) {
          connectNodes(draw.fromNodeId, snap.targetId);
        } else {
          placeEndpointAndConnect(draw.fromNodeId, snap.x, snap.y);
        }
        setDrawFrom(null);
      }
      return;
    }
    if (tool === "select") {
      select(null);
    }
  }, [
    tool,
    cursor.worldX,
    cursor.worldY,
    computeSnap,
    placeNode,
    connectNodes,
    placeEndpointAndConnect,
    draw.fromNodeId,
    setDrawFrom,
    select,
  ]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      const target = e.target as SVGElement;
      const isBackground =
        target === svgRef.current ||
        target.tagName === "rect" ||
        target.getAttribute("data-bg") === "true";
      if (!isBackground) return;

      if (tool === "pan" || e.button === 1 || e.shiftKey) {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
        return;
      }

      handleCanvasClick();
    },
    [tool, viewport, handleCanvasClick],
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

  const onNodeClick = useCallback(
    (nodeId: string) => {
      if (tool === "select") {
        const node = layout.nodes.find((n) => n.id === nodeId);
        if (node?.state) {
          useLayoutStore.getState().toggleTurnout(nodeId);
        }
        select({ kind: "node", id: nodeId });
        return;
      }
      if (tool === "delete") {
        select({ kind: "node", id: nodeId });
        deleteSelection();
        return;
      }
      if (tool === "place_straight") {
        if (!draw.fromNodeId) {
          setDrawFrom(nodeId);
        } else if (draw.fromNodeId !== nodeId) {
          connectNodes(draw.fromNodeId, nodeId);
          setDrawFrom(null);
        }
      }
    },
    [tool, layout.nodes, select, deleteSelection, draw.fromNodeId, setDrawFrom, connectNodes],
  );

  const onEdgeClick = useCallback(
    (edgeId: string) => {
      if (tool === "select") {
        select({ kind: "edge", id: edgeId });
      } else if (tool === "delete") {
        select({ kind: "edge", id: edgeId });
        deleteSelection();
      }
    },
    [tool, select, deleteSelection],
  );

  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
  const blockMap = new Map(layout.blocks.map((b) => [b.id, b]));
  const selectedNodeId = selection?.kind === "node" ? selection.id : null;
  const selectedEdgeId = selection?.kind === "edge" ? selection.id : null;

  const drawFrom = draw.fromNodeId ? nodeMap.get(draw.fromNodeId) : null;

  const cursorClass =
    isPanning
      ? "cursor-grabbing"
      : tool === "pan"
        ? "cursor-grab"
        : tool === "select"
          ? "cursor-default"
          : "cursor-crosshair";

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      className={cursorClass}
      style={{ background: "#09090b", touchAction: "none", display: "block" }}
    >
      <defs>
        <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke="#27272a"
            strokeWidth={0.5}
          />
        </pattern>
        <pattern
          id="grid-major"
          width={gridSize * 5}
          height={gridSize * 5}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`}
            fill="none"
            stroke="#3f3f46"
            strokeWidth={0.75}
          />
        </pattern>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
      </defs>

      {gridEnabled && <rect data-bg="true" width="100%" height="100%" fill="url(#grid)" />}
      {gridEnabled && <rect data-bg="true" width="100%" height="100%" fill="url(#grid-major)" />}
      {!gridEnabled && <rect data-bg="true" width="100%" height="100%" fill="#09090b" />}

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
              isSelected={selectedEdgeId === edge.id}
              onClick={() => onEdgeClick(edge.id)}
            />
          );
        })}

        {drawFrom && (
          <line
            x1={drawFrom.x}
            y1={drawFrom.y}
            x2={cursor.snappedX}
            y2={cursor.snappedY}
            stroke="#fbbf24"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
            opacity={0.8}
          />
        )}

        {layout.nodes.map((node) => (
          <TrackNodeView
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            isSnapTarget={cursor.snapTargetId === node.id}
            onClick={() => onNodeClick(node.id)}
          />
        ))}

        {layout.trains.map((train) => (
          <TrainMarker key={train.id} train={train} edges={layout.edges} nodes={layout.nodes} />
        ))}

        <CursorGhost />
      </g>

      <rect data-bg="true" width="100%" height="100%" fill="url(#vignette)" pointerEvents="none" />
    </svg>
  );
}
