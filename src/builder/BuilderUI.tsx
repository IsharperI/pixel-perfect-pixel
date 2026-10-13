import { Eraser, Hammer, MousePointer2, Pencil, Play, Redo2, RotateCw, Undo2 } from "lucide-react";
import { useLevel, type Tool } from "./levelStore";
import { BEHAVIOUR_COLOURS, PIECES, PIECE_ORDER, type Behaviour } from "./pieces";
import { PieceIcon } from "./PieceIcon";

const TOOLS: { id: Tool; label: string; key: string; icon: typeof Hammer }[] = [
  { id: "build", label: "Build", key: "B", icon: Hammer },
  { id: "select", label: "Move", key: "V", icon: MousePointer2 },
  { id: "erase", label: "Erase", key: "E", icon: Eraser },
];

const HINTS: Record<Tool, string> = {
  build: "Click the ground or a block to add a piece · R rotates · drag to turn the view · right-drag to slide · scroll to zoom",
  select: "Click a block, then drag its arrows to move it (green = up, to make it float) · R rotates it · Delete removes it",
  erase: "Click a block to remove it · Ctrl+Z brings it back",
};

const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur();

/** Everything drawn over the 3D view: tools, pieces, Play/Stop, the colour legend and hints. */
export function BuilderUI() {
  const { tool, piece, rot, mode, past, future, setTool, setPiece, rotate, undo, redo, setMode } = useLevel();

  if (mode === "play") {
    return (
      <>
        <button className="builder-play" data-playing="true" onClick={(e) => { blur(e); setMode("edit"); }}>
          <Pencil size={18} aria-hidden /> Back to building <kbd>Esc</kbd>
        </button>
        <div className="builder-hint">
          <kbd>WASD</kbd> move · <kbd>Space</kbd> jump · <kbd>Shift</kbd> crouch · <kbd>Z</kbd> walk/run · drag to look around
        </div>
      </>
    );
  }

  return (
    <>
      <aside className="builder-toolbar" aria-label="Building tools">
        <p className="builder-heading">Tools</p>
        <div className="builder-tools">
          {TOOLS.map((t) => (
            <button key={t.id} className="builder-tool" data-on={tool === t.id} onClick={(e) => { blur(e); setTool(t.id); }} title={`${t.label} (${t.key})`}>
              <t.icon size={18} aria-hidden />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <p className="builder-heading">Pieces</p>
        <div className="builder-pieces">
          {PIECE_ORDER.map((id, i) => (
            <button
              key={id}
              className="builder-piece"
              data-on={tool === "build" && piece === id}
              onClick={(e) => { blur(e); setPiece(id); }}
              title={`${PIECES[id].label} (${i + 1})`}
            >
              <PieceIcon piece={id} />
              <span>{PIECES[id].label}</span>
            </button>
          ))}
        </div>

        <div className="builder-actions">
          <button className="builder-action" onClick={(e) => { blur(e); rotate(); }} title="Rotate (R)">
            <RotateCw size={16} aria-hidden style={{ transform: `rotate(${rot * 90}deg)`, transition: "transform .2s" }} />
          </button>
          <button className="builder-action" onClick={(e) => { blur(e); undo(); }} disabled={!past.length} title="Undo (Ctrl+Z)">
            <Undo2 size={16} aria-hidden />
          </button>
          <button className="builder-action" onClick={(e) => { blur(e); redo(); }} disabled={!future.length} title="Redo (Ctrl+Y)">
            <Redo2 size={16} aria-hidden />
          </button>
        </div>
      </aside>

      <button className="builder-play" onClick={(e) => { blur(e); setMode("play"); }} title="Play your level">
        <Play size={18} aria-hidden fill="currentColor" /> Play
      </button>

      <Legend />
      <div className="builder-hint">{HINTS[tool]}</div>
    </>
  );
}

/** What each colour means. */
function Legend() {
  const shown: Behaviour[] = ["solid", "slope", "start"];
  return (
    <div className="builder-legend" aria-label="Colour key">
      <p className="builder-heading">Colour key</p>
      {shown.map((b) => (
        <div key={b} className="builder-legend-row">
          <span className="builder-swatch" style={{ background: BEHAVIOUR_COLOURS[b].colour, borderColor: BEHAVIOUR_COLOURS[b].edge }} />
          <span>{BEHAVIOUR_COLOURS[b].meaning}</span>
        </div>
      ))}
    </div>
  );
}
