"use client";

import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { useLayoutStore } from "@/lib/store/layout";
import { cn } from "@/lib/utils";

export function Inspector() {
  const layout = useLayoutStore((s) => s.layout);
  const selection = useLayoutStore((s) => s.selection);
  const updateNodeLabel = useLayoutStore((s) => s.updateNodeLabel);
  const updateNodeRotation = useLayoutStore((s) => s.updateNodeRotation);
  const updateEdgeBlock = useLayoutStore((s) => s.updateEdgeBlock);
  const updateEdgeCurve = useLayoutStore((s) => s.updateEdgeCurve);
  const updateBlock = useLayoutStore((s) => s.updateBlock);
  const addBlock = useLayoutStore((s) => s.addBlock);
  const toggleBlockOccupancy = useLayoutStore((s) => s.toggleBlockOccupancy);
  const toggleTurnout = useLayoutStore((s) => s.toggleTurnout);
  const deleteSelection = useLayoutStore((s) => s.deleteSelection);
  const setTrainVelocity = useLayoutStore((s) => s.setTrainVelocity);
  const setTrainPriority = useLayoutStore((s) => s.setTrainPriority);
  const toggleTrainPaused = useLayoutStore((s) => s.toggleTrainPaused);

  const selectedNode =
    selection?.kind === "node" ? layout.nodes.find((n) => n.id === selection.id) : null;
  const selectedEdge =
    selection?.kind === "edge" ? layout.edges.find((e) => e.id === selection.id) : null;

  return (
    <div className="w-72 shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
          Inspector
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selection && (
          <div className="p-4 text-xs text-zinc-500 font-mono leading-relaxed">
            <div className="mb-2 text-zinc-300 font-semibold tracking-wider uppercase text-[10px]">
              Nothing selected
            </div>
            <ul className="space-y-1">
              <li>· click a turnout to throw it</li>
              <li>· select a tool from the left rail</li>
              <li>· <span className="text-zinc-300">[</span> / <span className="text-zinc-300">]</span> rotates turnouts (Shift = 45°)</li>
              <li>· drag the yellow dot on a selected edge to bend it</li>
              <li>· drag empty space to pan · wheel to zoom</li>
              <li>· Cmd/Ctrl+Z to undo</li>
            </ul>
          </div>
        )}

        {selectedNode && (
          <div className="p-3 space-y-3 border-b border-zinc-800">
            <Row label="id" value={<span className="font-mono text-[10px]">{selectedNode.id}</span>} />
            <Row label="type" value={<span className="font-mono text-xs">{selectedNode.type}</span>} />
            <Row label="position" value={<span className="font-mono text-xs">{Math.round(selectedNode.x)}, {Math.round(selectedNode.y)}</span>} />
            <div>
              <Label>label</Label>
              <input
                value={selectedNode.label ?? ""}
                onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
                placeholder="SW42"
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-600"
              />
            </div>
            {selectedNode.state !== undefined && (
              <div>
                <Label>state</Label>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <button
                    onClick={() => selectedNode.state === "diverging" && toggleTurnout(selectedNode.id)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-mono uppercase",
                      selectedNode.state === "normal"
                        ? "bg-emerald-500 text-zinc-950"
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800",
                    )}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => selectedNode.state === "normal" && toggleTurnout(selectedNode.id)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-mono uppercase",
                      selectedNode.state === "diverging"
                        ? "bg-red-500 text-zinc-950"
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800",
                    )}
                  >
                    Diverging
                  </button>
                </div>
              </div>
            )}
            <div>
              <Label>rotation ({selectedNode.rotation}°)</Label>
              <input
                type="range"
                min={-180}
                max={180}
                step={15}
                value={selectedNode.rotation}
                onChange={(e) => updateNodeRotation(selectedNode.id, Number(e.target.value))}
                className="w-full mt-1 accent-zinc-300"
              />
            </div>
            <button
              onClick={deleteSelection}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-mono"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        )}

        {selectedEdge && (
          <div className="p-3 space-y-3 border-b border-zinc-800">
            <Row label="id" value={<span className="font-mono text-[10px]">{selectedEdge.id}</span>} />
            <Row label="from → to" value={<span className="font-mono text-[10px]">{selectedEdge.from} → {selectedEdge.to}</span>} />
            <Row label="branch" value={<span className="font-mono text-xs uppercase">{selectedEdge.branch}</span>} />
            <div>
              <Label>block</Label>
              <select
                value={selectedEdge.blockId}
                onChange={(e) => updateEdgeBlock(selectedEdge.id, e.target.value)}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-600"
              >
                {layout.blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>curve ({selectedEdge.curve})</Label>
                <button
                  onClick={() => updateEdgeCurve(selectedEdge.id, 0)}
                  className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 uppercase"
                >
                  reset
                </button>
              </div>
              <input
                type="range"
                min={-200}
                max={200}
                step={5}
                value={selectedEdge.curve}
                onChange={(e) => updateEdgeCurve(selectedEdge.id, Number(e.target.value))}
                className="w-full mt-1 accent-amber-400"
              />
              <div className="text-[10px] font-mono text-zinc-600 mt-1">
                drag the yellow handle on the canvas too
              </div>
            </div>
            <button
              onClick={deleteSelection}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-mono"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        )}

        {layout.trains.length > 0 && (
          <div className="p-3 border-b border-zinc-800">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
              Trains
            </div>
            <div className="space-y-2.5">
              {layout.trains.map((t) => (
                <div key={t.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-2.5 rounded-sm border border-zinc-700"
                      style={{ background: t.color }}
                    />
                    <div className="flex-1 text-[11px] font-mono text-zinc-300 truncate">
                      {t.road} {t.number}
                    </div>
                    {t.waiting && (
                      <span className="text-[9px] font-mono text-amber-400 uppercase">wait</span>
                    )}
                    <button
                      onClick={() => toggleTrainPaused(t.id)}
                      className={cn(
                        "h-5 w-5 rounded flex items-center justify-center",
                        t.paused
                          ? "bg-red-500/20 text-red-400"
                          : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800",
                      )}
                      title={t.paused ? "Resume" : "Pause"}
                    >
                      {t.paused ? <Play size={10} /> : <Pause size={10} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <input
                      type="range"
                      min={0}
                      max={t.maxVelocity}
                      step={5}
                      value={t.velocity}
                      onChange={(e) => setTrainVelocity(t.id, Number(e.target.value))}
                      className="flex-1 accent-amber-400"
                    />
                    <span className="text-[9px] font-mono text-zinc-500 w-8 text-right">
                      {Math.round(t.velocity)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-5">
                    <span className="text-[9px] font-mono text-zinc-500 w-8">pri</span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={t.priority ?? 5}
                      onChange={(e) => setTrainPriority(t.id, Number(e.target.value))}
                      className="flex-1 accent-sky-400"
                    />
                    <span className="text-[9px] font-mono text-zinc-500 w-8 text-right">
                      {t.priority ?? 5}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              Blocks
            </div>
            <button
              onClick={addBlock}
              className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              title="Add block"
            >
              <Plus size={13} />
            </button>
          </div>
          <div className="space-y-1.5">
            {layout.blocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 group hover:bg-zinc-900 rounded px-1.5 py-1"
              >
                <input
                  type="color"
                  value={b.color}
                  onChange={(e) => updateBlock(b.id, { color: e.target.value })}
                  className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                  style={{ colorScheme: "dark" }}
                />
                <input
                  value={b.name}
                  onChange={(e) => updateBlock(b.id, { name: e.target.value })}
                  className="flex-1 bg-transparent text-[11px] font-mono text-zinc-300 focus:outline-none"
                />
                <button
                  onClick={() => toggleBlockOccupancy(b.id)}
                  className={cn(
                    "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded",
                    b.occupied
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700",
                  )}
                >
                  {b.occupied ? "Occ" : "Clr"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{label}</div>
      <div className="text-zinc-300 truncate">{value}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{children}</div>
  );
}
