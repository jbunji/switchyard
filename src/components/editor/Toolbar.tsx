"use client";

import {
  Hand,
  Minus,
  MousePointer2,
  Split,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useLayoutStore, type Tool } from "@/lib/store/layout";
import { cn } from "@/lib/utils";

interface ToolDef {
  id: Tool;
  label: string;
  hint: string;
  shortcut: string;
  icon: LucideIcon;
  flip?: boolean;
}

const TOOLS: ToolDef[] = [
  { id: "select", label: "Select", hint: "Select & inspect", shortcut: "V", icon: MousePointer2 },
  { id: "pan", label: "Pan", hint: "Drag the canvas", shortcut: "P", icon: Hand },
  { id: "place_straight", label: "Straight", hint: "Click two nodes to connect", shortcut: "S", icon: Minus },
  { id: "place_turnout_left", label: "Left Turnout", hint: "Place a left-hand switch", shortcut: "L", icon: Split, flip: true },
  { id: "place_turnout_right", label: "Right Turnout", hint: "Place a right-hand switch", shortcut: "R", icon: Split },
  { id: "delete", label: "Delete", hint: "Click to remove", shortcut: "X", icon: Trash2 },
];

export function Toolbar() {
  const tool = useLayoutStore((s) => s.tool);
  const setTool = useLayoutStore((s) => s.setTool);

  return (
    <div className="flex flex-col gap-1 p-2 border-r border-zinc-800 bg-zinc-950 w-14">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.shortcut}) — ${t.hint}`}
            className={cn(
              "relative h-10 w-10 rounded-md flex items-center justify-center transition-colors group",
              active
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
            )}
          >
            <Icon size={18} style={t.flip ? { transform: "scaleX(-1)" } : undefined} />
            <span
              className={cn(
                "absolute right-1 bottom-1 text-[8px] font-mono leading-none",
                active ? "text-zinc-500" : "text-zinc-600",
              )}
            >
              {t.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
}
