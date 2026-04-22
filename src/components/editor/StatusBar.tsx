"use client";

import { useLayoutStore } from "@/lib/store/layout";

export function StatusBar() {
  const cursor = useLayoutStore((s) => s.cursor);
  const viewport = useLayoutStore((s) => s.viewport);
  const layout = useLayoutStore((s) => s.layout);
  const selection = useLayoutStore((s) => s.selection);
  const gridEnabled = useLayoutStore((s) => s.gridEnabled);
  const gridSize = useLayoutStore((s) => s.gridSize);
  const snapEnabled = useLayoutStore((s) => s.snapEnabled);
  const draw = useLayoutStore((s) => s.draw);
  const tool = useLayoutStore((s) => s.tool);

  return (
    <div className="h-7 px-3 border-t border-zinc-800 bg-zinc-950 flex items-center gap-4 text-[10px] font-mono text-zinc-500">
      <span>
        <span className="text-zinc-600">x</span>
        {String(Math.round(cursor.worldX)).padStart(4, " ")}
        <span className="text-zinc-600 ml-2">y</span>
        {String(Math.round(cursor.worldY)).padStart(4, " ")}
      </span>
      <span className="text-zinc-700">·</span>
      <span>zoom {Math.round(viewport.scale * 100)}%</span>
      <span className="text-zinc-700">·</span>
      <span className={gridEnabled ? "text-zinc-400" : "text-zinc-700"}>grid {gridSize}u</span>
      <span className="text-zinc-700">·</span>
      <span className={snapEnabled ? "text-zinc-400" : "text-zinc-700"}>snap</span>
      <span className="text-zinc-700">·</span>
      <span>
        {layout.nodes.length}n / {layout.edges.length}e / {layout.blocks.length}b
      </span>
      <span className="flex-1" />
      {draw.fromNodeId && (
        <span className="text-amber-400">
          drawing from {draw.fromNodeId} — click second point
        </span>
      )}
      {!draw.fromNodeId && selection && (
        <span className="text-zinc-300">
          selected · {selection.kind} · {selection.id}
        </span>
      )}
      {!draw.fromNodeId && !selection && (
        <span className="text-zinc-600">tool: {tool.replace("_", " ")}</span>
      )}
    </div>
  );
}
