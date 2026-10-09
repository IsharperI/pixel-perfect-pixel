import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Blocks, FolderOpen, Save, SlidersHorizontal } from "lucide-react";
import { useSettings } from "../game/settings";
import { loadFromBrowser, saveToBrowser } from "../game/characterFile";

/** Top ribbon shared by every page: Save/Load, the app name, and the mode tabs. */
export function AppRibbon() {
  return (
    <header className="app-ribbon">
      <SaveLoad />
      <span className="app-ribbon-title font-display">Platformer Toolkit 3D</span>
      <nav className="app-ribbon-tabs" aria-label="Mode">
        <Link to="/" className="app-tab" activeOptions={{ exact: true }} activeProps={{ "data-active": "true" }}>
          <SlidersHorizontal size={15} aria-hidden />
          <span>Character Modifiers</span>
        </Link>
        <Link to="/builder" className="app-tab" activeProps={{ "data-active": "true" }}>
          <Blocks size={15} aria-hidden />
          <span>Level Builder</span>
        </Link>
      </nav>
    </header>
  );
}

const formatWhen = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

/** Save the current character to this browser, or load the saved one back. Nothing saves automatically. */
function SaveLoad() {
  const [savedAt, setSavedAt] = useState<string | null | undefined>(undefined); // undefined = nothing saved
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const saved = loadFromBrowser();
    setSavedAt(saved ? saved.savedAt : undefined);
    return () => clearTimeout(timer.current);
  }, []);

  const flash = (text: string, ok = true) => {
    setNote({ text, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2000);
  };
  const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur(); // keep Space for jumping

  const save = (e: React.MouseEvent) => {
    blur(e);
    if (saveToBrowser(useSettings.getState().values)) {
      setSavedAt(new Date().toISOString());
      flash("Character saved");
    } else flash("Couldn't save in this browser", false);
  };
  const load = (e: React.MouseEvent) => {
    blur(e);
    const saved = loadFromBrowser();
    if (!saved) return flash("Nothing saved yet", false);
    useSettings.getState().load(saved.values);
    flash("Character loaded");
  };

  const hasSave = savedAt !== undefined;
  return (
    <div className="app-saveload">
      <button className="ribbon-btn" onClick={save} title="Save the current character in this browser">
        <Save size={14} aria-hidden /><span>Save</span>
      </button>
      <button
        className="ribbon-btn"
        onClick={load}
        disabled={!hasSave}
        title={hasSave ? `Load the character saved ${formatWhen(savedAt ?? null)}`.trim() : "Nothing saved yet"}
      >
        <FolderOpen size={14} aria-hidden /><span>Load</span>
      </button>
      {note && <span className="ribbon-note" data-ok={note.ok} role="status">{note.text}</span>}
    </div>
  );
}
