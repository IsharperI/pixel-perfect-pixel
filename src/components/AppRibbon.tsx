import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Blocks, Eye, EyeOff, FolderOpen, Save, SlidersHorizontal } from "lucide-react";
import { useSettings, useUI } from "../game/settings";
import { loadFromBrowser, saveToBrowser } from "../game/characterFile";

/**
 * Top ribbon shared by every page: Save/Load, the app name, and the mode tabs.
 * Pages can swap in their own Save/Load (the Level Builder saves levels).
 */
export function AppRibbon({ saveLoad }: { saveLoad?: React.ReactNode } = {}) {
  return (
    <header className="app-ribbon">
      {saveLoad ?? <SaveLoad />}
      <span className="app-ribbon-title font-display">Platformer Toolkit 3D</span>
      <nav className="app-ribbon-tabs" aria-label="Mode">
        <Link to="/" className="app-tab" activeOptions={{ exact: true }} activeProps={{ "data-active": "true" }}>
          <SlidersHorizontal size={15} aria-hidden />
          <span className="tab-long">Character Modifiers</span>
          <span className="tab-short">Character</span>
        </Link>
        <Link to="/builder" className="app-tab" activeProps={{ "data-active": "true" }}>
          <Blocks size={15} aria-hidden />
          <span className="tab-long">Level Builder</span>
          <span className="tab-short">Builder</span>
        </Link>
      </nav>
      <HideUIButton />
    </header>
  );
}

/**
 * Hide UI: tucks away every panel and overlay that covers the game (H on a keyboard),
 * so you can see what you're doing. It lives in the ribbon, which is always on screen.
 */
function HideUIButton() {
  const hidden = useUI((s) => s.hideUI);
  const toggle = useUI((s) => s.toggle);
  // Mark the page, so the stylesheet can hide the overlays (see "Hide UI" in styles.css)
  useEffect(() => {
    document.documentElement.dataset["hideUi"] = String(hidden);
  }, [hidden]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && ((el.tagName === "INPUT" && (el as HTMLInputElement).type === "text") || el.tagName === "TEXTAREA")) return;
      if (e.code === "KeyH" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggle("hideUI");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggle]);
  return (
    <button
      className="ribbon-btn hide-ui-btn"
      data-hidden={hidden}
      onClick={(e) => { (e.currentTarget as HTMLElement).blur(); toggle("hideUI"); }}
      title={hidden ? "Show the panels again (H)" : "Hide the panels so you can see the game (H)"}
      aria-pressed={hidden}
    >
      {hidden ? <Eye size={15} aria-hidden /> : <EyeOff size={15} aria-hidden />}
      <span>{hidden ? "Show UI" : "Hide UI"}</span>
    </button>
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
