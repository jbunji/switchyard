"use client";

import { useLayoutStore } from "@/lib/store/layout";
import { cn } from "@/lib/utils";

export function HUD() {
  const layout = useLayoutStore((s) => s.layout);
  const toggleOccupancy = useLayoutStore((s) => s.toggleBlockOccupancy);
  const toggleTurnout = useLayoutStore((s) => s.toggleTurnout);

  const turnouts = layout.nodes.filter((n) => n.type.startsWith("turnout"));

  return (
    <div className="pointer-events-none absolute inset-0 p-4 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto bg-zinc-950/80 border border-zinc-800 rounded-lg px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Switchyard
            </div>
          </div>
          <div className="mt-0.5 text-sm font-semibold text-zinc-100">{layout.name}</div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500">
            {layout.nodes.length} nodes · {layout.edges.length} edges · {layout.blocks.length} blocks
          </div>
        </div>

        <div className="pointer-events-auto bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-2 backdrop-blur text-[11px] font-mono text-zinc-400">
          <div>drag empty space to pan · wheel to zoom</div>
          <div>click a turnout to throw it</div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="pointer-events-auto bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 backdrop-blur min-w-[220px]">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
            Blocks
          </div>
          <div className="space-y-1.5">
            {layout.blocks.map((b) => (
              <button
                key={b.id}
                onClick={() => toggleOccupancy(b.id)}
                className="w-full flex items-center gap-2 text-left hover:bg-zinc-900 rounded px-1.5 py-1 transition"
              >
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full border",
                    b.occupied ? "animate-pulse" : "opacity-30",
                  )}
                  style={{
                    background: b.occupied ? b.color : "transparent",
                    borderColor: b.color,
                  }}
                />
                <div className="flex-1 text-[11px] font-mono text-zinc-300">{b.name}</div>
                <div
                  className={cn(
                    "text-[9px] font-mono uppercase",
                    b.occupied ? "text-amber-400" : "text-zinc-600",
                  )}
                >
                  {b.occupied ? "Occ" : "Clr"}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 backdrop-blur min-w-[220px]">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
            Turnouts
          </div>
          <div className="space-y-1">
            {turnouts.map((t) => {
              const normal = t.state !== "diverging";
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTurnout(t.id)}
                  className="w-full flex items-center justify-between text-left hover:bg-zinc-900 rounded px-1.5 py-1 transition"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        normal ? "bg-emerald-400" : "bg-red-400",
                      )}
                    />
                    <div className="text-[11px] font-mono text-zinc-300">
                      {t.label ?? t.id}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "text-[9px] font-mono uppercase",
                      normal ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {normal ? "Norm" : "Div"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-auto bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 backdrop-blur min-w-[220px]">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
            Roster
          </div>
          <div className="space-y-1.5">
            {layout.trains.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-2.5 rounded-sm border border-zinc-700"
                  style={{ background: t.color }}
                />
                <div className="flex-1 text-[11px] font-mono text-zinc-300">
                  {t.road} {t.number}
                </div>
                <div className="text-[9px] font-mono text-zinc-600">
                  {t.position?.direction === "forward" ? "FWD" : "REV"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
