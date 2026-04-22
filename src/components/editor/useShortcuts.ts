"use client";

import { useEffect } from "react";
import { useLayoutStore } from "@/lib/store/layout";

export function useShortcuts() {
  const setTool = useLayoutStore((s) => s.setTool);
  const setGridEnabled = useLayoutStore((s) => s.setGridEnabled);
  const gridEnabled = useLayoutStore((s) => s.gridEnabled);
  const deleteSelection = useLayoutStore((s) => s.deleteSelection);
  const selection = useLayoutStore((s) => s.selection);
  const undo = useLayoutStore((s) => s.undo);
  const redo = useLayoutStore((s) => s.redo);
  const setDrawFrom = useLayoutStore((s) => s.setDrawFrom);
  const rotateGhost = useLayoutStore((s) => s.rotateGhost);
  const rotateSelectedNode = useLayoutStore((s) => s.rotateSelectedNode);
  const tool = useLayoutStore((s) => s.tool);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const isEditing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (isEditing) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      switch (e.key) {
        case "[": {
          e.preventDefault();
          const delta = e.shiftKey ? -45 : -15;
          const placing = tool === "place_turnout_left" || tool === "place_turnout_right";
          if (placing) rotateGhost(delta);
          else if (selection?.kind === "node") rotateSelectedNode(delta);
          return;
        }
        case "]": {
          e.preventDefault();
          const delta = e.shiftKey ? 45 : 15;
          const placing = tool === "place_turnout_left" || tool === "place_turnout_right";
          if (placing) rotateGhost(delta);
          else if (selection?.kind === "node") rotateSelectedNode(delta);
          return;
        }
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setTool("select");
          break;
        case "p":
          setTool("pan");
          break;
        case "s":
          setTool("place_straight");
          break;
        case "l":
          setTool("place_turnout_left");
          break;
        case "r":
          setTool("place_turnout_right");
          break;
        case "x":
          setTool("delete");
          break;
        case "g":
          setGridEnabled(!gridEnabled);
          break;
        case "escape":
          setDrawFrom(null);
          setTool("select");
          break;
        case "delete":
        case "backspace":
          if (selection) {
            e.preventDefault();
            deleteSelection();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    setTool,
    setGridEnabled,
    gridEnabled,
    deleteSelection,
    selection,
    undo,
    redo,
    setDrawFrom,
    rotateGhost,
    rotateSelectedNode,
    tool,
  ]);
}
