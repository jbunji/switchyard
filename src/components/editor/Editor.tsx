"use client";

import { TrackCanvas } from "@/components/canvas/TrackCanvas";
import { useAutosave } from "@/lib/store/persistence";
import { Topbar } from "./Topbar";
import { Toolbar } from "./Toolbar";
import { Inspector } from "./Inspector";
import { StatusBar } from "./StatusBar";
import { useShortcuts } from "./useShortcuts";

export function Editor() {
  useAutosave();
  useShortcuts();

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <div className="flex-1 relative overflow-hidden">
          <TrackCanvas />
        </div>
        <Inspector />
      </div>
      <StatusBar />
    </div>
  );
}
