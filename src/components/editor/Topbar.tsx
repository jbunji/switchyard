"use client";

import { useRef } from "react";
import {
  Download,
  FileJson,
  Grid3x3,
  Magnet,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  Upload,
} from "lucide-react";
import { useLayoutStore } from "@/lib/store/layout";
import { cn } from "@/lib/utils";
import { downloadLayoutJson, uploadLayoutJson } from "@/lib/store/persistence";

export function Topbar() {
  const fileInput = useRef<HTMLInputElement>(null);
  const layout = useLayoutStore((s) => s.layout);
  const past = useLayoutStore((s) => s.past);
  const future = useLayoutStore((s) => s.future);
  const undo = useLayoutStore((s) => s.undo);
  const redo = useLayoutStore((s) => s.redo);
  const gridEnabled = useLayoutStore((s) => s.gridEnabled);
  const setGridEnabled = useLayoutStore((s) => s.setGridEnabled);
  const snapEnabled = useLayoutStore((s) => s.snapEnabled);
  const setSnapEnabled = useLayoutStore((s) => s.setSnapEnabled);
  const setLayout = useLayoutStore((s) => s.setLayout);
  const resetLayout = useLayoutStore((s) => s.resetLayout);
  const loadDemo = useLayoutStore((s) => s.loadDemo);

  const rename = (name: string) => {
    setLayout({ ...layout, name, updatedAt: new Date().toISOString() });
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const next = await uploadLayoutJson(file);
    if (next) setLayout(next);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2 px-3 h-12 border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 pr-3 border-r border-zinc-800">
        <div className="w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600">
          <Sparkles size={14} className="text-zinc-950" />
        </div>
        <div className="text-sm font-semibold text-zinc-100 tracking-tight">Switchyard</div>
      </div>

      <input
        value={layout.name}
        onChange={(e) => rename(e.target.value)}
        className="bg-transparent text-sm text-zinc-300 font-mono px-2 py-1 rounded hover:bg-zinc-900 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-700 w-48"
      />

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      <TopbarButton onClick={undo} disabled={past.length === 0} title="Undo (Cmd/Ctrl+Z)">
        <Undo2 size={16} />
      </TopbarButton>
      <TopbarButton onClick={redo} disabled={future.length === 0} title="Redo (Cmd/Ctrl+Shift+Z)">
        <Redo2 size={16} />
      </TopbarButton>

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      <TopbarButton
        active={gridEnabled}
        onClick={() => setGridEnabled(!gridEnabled)}
        title="Toggle grid (G)"
      >
        <Grid3x3 size={16} />
      </TopbarButton>
      <TopbarButton
        active={snapEnabled}
        onClick={() => setSnapEnabled(!snapEnabled)}
        title="Toggle endpoint snap"
      >
        <Magnet size={16} />
      </TopbarButton>

      <div className="flex-1" />

      <TopbarButton onClick={loadDemo} title="Load demo layout">
        <span className="text-[11px] font-mono px-1">demo</span>
      </TopbarButton>
      <TopbarButton onClick={resetLayout} title="Clear layout">
        <RotateCcw size={16} />
      </TopbarButton>

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      <TopbarButton onClick={() => fileInput.current?.click()} title="Import JSON">
        <Upload size={16} />
      </TopbarButton>
      <TopbarButton onClick={() => downloadLayoutJson(layout)} title="Export JSON">
        <Download size={16} />
      </TopbarButton>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        onChange={onUpload}
        className="hidden"
      />

      <div className="ml-2 flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded">
        <FileJson size={11} />
        autosaved
      </div>
    </div>
  );
}

function TopbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 min-w-8 px-2 rounded flex items-center justify-center transition-colors",
        disabled && "opacity-30 cursor-not-allowed",
        !disabled && active && "bg-zinc-100 text-zinc-950",
        !disabled && !active && "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}
