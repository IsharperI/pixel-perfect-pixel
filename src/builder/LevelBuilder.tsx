import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { AppRibbon } from "../components/AppRibbon";
import { SceneLighting } from "../game/SceneLighting";
import { SpeedLines } from "../game/SpeedLines";
import { EditorScene } from "./EditorScene";
import { PlayScene } from "./PlayScene";
import { BuilderUI } from "./BuilderUI";
import { useLevel, type Tool } from "./levelStore";
import { PIECE_ORDER } from "./pieces";

/** The Level Builder page: build with blocks, then press Play to try your level. */
export function LevelBuilder() {
  const mode = useLevel((s) => s.mode);
  useBuilderKeys();
  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <AppRibbon />
      <div className="relative flex-1 overflow-hidden" data-mode={mode}>
        <Canvas shadows dpr={[1, 2]} gl={{ stencil: true }} camera={{ position: [9, 11, 14], fov: 50 }} onContextMenu={(e) => e.preventDefault()}>
          <SceneLighting />
          {mode === "edit" ? <EditorScene /> : <PlayScene />}
        </Canvas>
        {mode === "play" && <SpeedLines />}
        <BuilderUI />
      </div>
    </div>
  );
}

const TOOL_KEYS: Record<string, Tool> = { KeyB: "build", KeyV: "select", KeyE: "erase" };

/** Keyboard shortcuts for building (and Esc to stop playing). */
function useBuilderKeys() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const S = useLevel.getState();
      if (S.mode === "play") {
        if (e.code === "Escape") S.setMode("edit");
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.code === "KeyZ") { e.preventDefault(); if (e.shiftKey) S.redo(); else S.undo(); return; }
      if (mod && e.code === "KeyY") { e.preventDefault(); S.redo(); return; }
      if (mod || e.altKey) return;
      if (e.code === "KeyR") S.rotate();
      else if (TOOL_KEYS[e.code]) S.setTool(TOOL_KEYS[e.code]!);
      else if (/^Digit[1-9]$/.test(e.code)) { const p = PIECE_ORDER[Number(e.code.slice(5)) - 1]; if (p) S.setPiece(p); }
      else if ((e.code === "Delete" || e.code === "Backspace") && S.selectedId) { e.preventDefault(); S.remove(S.selectedId); }
      else if (e.code === "Escape") S.select(null);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);
}
