import { useEffect, useRef, useState } from "react";
import { FolderOpen, Save } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { AppRibbon } from "../components/AppRibbon";
import { SceneLighting } from "../game/SceneLighting";
import { SpeedLines } from "../game/SpeedLines";
import { EditorScene } from "./EditorScene";
import { PlayScene } from "./PlayScene";
import { BuilderUI, startPlay } from "./BuilderUI";
import { LevelPanel, saveCurrentLevel } from "./LevelPanel";
import { usePlay } from "./playState";
import { levelSig, useLevel, type Tool } from "./levelStore";
import { PIECE_ORDER } from "./pieces";

/** The Level Builder page: build with blocks, then press Play to try your level. */
export function LevelBuilder() {
  const mode = useLevel((s) => s.mode);
  const run = usePlay((s) => s.run);
  useBuilderKeys();
  useWarnBeforeLeaving();
  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <AppRibbon saveLoad={<LevelSaveLoad />} />
      <div className="relative flex-1 overflow-hidden" data-mode={mode}>
        <Canvas shadows dpr={[1, 2]} gl={{ stencil: true }} camera={{ position: [9, 11, 14], fov: 50 }} onContextMenu={(e) => e.preventDefault()}>
          <SceneLighting />
          {mode === "edit" ? <EditorScene /> : <PlayScene key={run} />}
        </Canvas>
        {mode === "play" && <SpeedLines />}
        <BuilderUI />
        {mode === "edit" && <LevelPanel />}
      </div>
    </div>
  );
}

/** If the level has unsaved changes, ask before the page is refreshed or closed. */
function useWarnBeforeLeaving() {
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      const S = useLevel.getState();
      if (levelSig(S) !== S.baselineSig) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
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
        else if (e.code === "Enter" && (usePlay.getState().won || usePlay.getState().lost)) startPlay();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.code === "KeyZ") { e.preventDefault(); if (e.shiftKey) S.redo(); else S.undo(); return; }
      if (mod && e.code === "KeyY") { e.preventDefault(); S.redo(); return; }
      if (mod || e.altKey) return;
      if (e.code === "KeyR") S.rotate();
      else if (e.code === "KeyL") S.setPanelOpen(!S.panelOpen);
      else if (TOOL_KEYS[e.code]) S.setTool(TOOL_KEYS[e.code]!);
      else if (/^Digit[1-9]$/.test(e.code)) { const p = PIECE_ORDER[Number(e.code.slice(5)) - 1]; if (p) S.setPiece(p); }
      else if ((e.code === "Delete" || e.code === "Backspace") && S.selectedId) { e.preventDefault(); S.remove(S.selectedId); }
      else if (e.code === "Escape") S.select(null);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);
}

/** In the Level Builder, the ribbon's Save and Load are for levels. */
function LevelSaveLoad() {
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = (text: string, ok = true) => {
    setNote({ text, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2000);
  };
  const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur();
  return (
    <div className="app-saveload">
      <button className="ribbon-btn" onClick={(e) => { blur(e); const ok = saveCurrentLevel(); flash(ok ? `Saved "${useLevel.getState().name}"` : "Couldn't save in this browser", ok); }} title="Save this level in this browser">
        <Save size={14} aria-hidden /><span>Save</span>
      </button>
      <button
        className="ribbon-btn"
        onClick={(e) => { blur(e); const S = useLevel.getState(); if (S.mode === "play") S.setMode("edit"); S.setPanelOpen(true); }}
        title="Open one of your saved levels"
      >
        <FolderOpen size={14} aria-hidden /><span>Load</span>
      </button>
      {note && <span className="ribbon-note" data-ok={note.ok} role="status">{note.text}</span>}
    </div>
  );
}
