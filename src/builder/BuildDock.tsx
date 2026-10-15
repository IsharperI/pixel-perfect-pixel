import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Boxes, Eraser, Flag, Flame, MousePointer2, Redo2, RotateCw, Sparkles, Sprout, Trash2, Undo2, Wrench } from "lucide-react";
import { useLevel, type Tool } from "./levelStore";
import { PIECES, type PieceId } from "./pieces";
import { PieceIcon } from "./PieceIcon";
import { ConfirmDialog } from "./BuilderUI";
import { TOUR, useTour } from "./tour";
import { useUI } from "../game/settings";

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE BUILD DOCK
 *  A compact bar along the bottom: pick a category, and its pieces (or tools)
 *  pop up in a row just above. Edit the categories and wording here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type Action = "rotate" | "undo" | "redo" | "clear";
type Item =
  | { kind: "piece"; id: PieceId; tip: string }
  | { kind: "tool"; id: Tool; label: string; tip: string; key: string }
  | { kind: "action"; id: Action; label: string; tip: string };

type Category = { id: string; label: string; icon: typeof Boxes; items: Item[] };

export const CATEGORIES: Category[] = [
  {
    id: "tools", label: "Tools", icon: Wrench, items: [
      { kind: "tool", id: "select", label: "Move", key: "V", tip: "Click a block to move it (green arrow = up), or make it move or tilt" },
      { kind: "tool", id: "erase", label: "Erase", key: "E", tip: "Click a block to remove it, or drag to clear an area" },
      { kind: "action", id: "rotate", label: "Turn", tip: "Turn the piece before you place it (R)" },
      { kind: "action", id: "undo", label: "Undo", tip: "Undo the last change (Ctrl+Z)" },
      { kind: "action", id: "redo", label: "Redo", tip: "Redo it again (Ctrl+Y)" },
      { kind: "action", id: "clear", label: "Clear", tip: "Remove everything and start again" },
    ],
  },
  {
    id: "ground", label: "Ground", icon: Boxes, items: [
      { kind: "piece", id: "cube", tip: "Cube: solid ground to stand on" },
      { kind: "piece", id: "wide", tip: "Big block: a wide, flat 2×2 floor" },
      { kind: "piece", id: "plank", tip: "Plank: a long, thin platform" },
    ],
  },
  {
    id: "interactions", label: "Interactions", icon: Sparkles, items: [
      { kind: "piece", id: "ramp", tip: "Ramp: a gentle slope. Downhill speeds you up, uphill slows you down" },
      { kind: "piece", id: "steep", tip: "Steep ramp: a steeper slope, harder to climb" },
      { kind: "piece", id: "bounce", tip: "Bounce pad: springs you into the air (hold jump for extra)" },
      { kind: "tool", id: "paint", label: "Vines", key: "P", tip: "Vines: click the side of a block to grow vines you can climb" },
    ],
  },
  {
    id: "hazards", label: "Hazards", icon: Flame, items: [
      { kind: "piece", id: "lava", tip: "Lava: ouch! Sends you back to your last checkpoint" },
    ],
  },
  {
    id: "goals", label: "Goals", icon: Flag, items: [
      { kind: "piece", id: "start", tip: "Start: where you begin (one per level)" },
      { kind: "piece", id: "checkpoint", tip: "Checkpoint: once touched, you come back here" },
      { kind: "piece", id: "goal", tip: "Goal flag: reach it to finish (one per level)" },
      { kind: "piece", id: "star", tip: "Collectable: grab them all" },
    ],
  },
];

/** The tour (and anything else) refers to dock items by these names. */
const tourName = (it: Item) => (it.kind === "piece" ? `piece-${it.id}` : it.kind === "tool" ? `tool-${it.id}` : it.id);

/** Which category holds the current tool or piece. */
function categoryOf(tool: Tool, piece: PieceId) {
  return CATEGORIES.find((c) => c.items.some((it) => (tool === "build" ? it.kind === "piece" && it.id === piece : it.kind === "tool" && it.id === tool)))?.id ?? null;
}

const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur();

export function BuildDock() {
  const tool = useLevel((s) => s.tool);
  const piece = useLevel((s) => s.piece);
  const rot = useLevel((s) => s.rot);
  const canUndo = useLevel((s) => s.past.length > 0);
  const canRedo = useLevel((s) => s.future.length > 0);
  const panelOpen = useLevel((s) => s.panelOpen);
  const touchMode = useUI((u) => u.touchMode);
  const [open, setOpen] = useState<string | null>(() => categoryOf(tool, piece));
  const [hover, setHover] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const dock = useRef<HTMLDivElement>(null);

  // Picking something some other way (a number key, the tour) opens its category
  useEffect(() => {
    const c = categoryOf(tool, piece);
    if (c) setOpen(c);
  }, [tool, piece]);

  // The tour: open the category of the first thing the current step points at
  const tourIndex = useTour((t) => (t.status === "active" ? t.index : -1));
  const glow = tourIndex >= 0 ? TOUR[tourIndex]?.glow ?? [] : [];
  useEffect(() => {
    // (in the order the step lists them, so the main thing comes first)
    for (const name of glow) {
      const c = CATEGORIES.find((cat) => cat.items.some((it) => tourName(it) === name));
      if (c) { setOpen(c.id); break; }
    }
  }, [tourIndex]); // eslint-disable-line react-hooks/exhaustive-deps -- once per step

  // Tell the page how tall the dock is, so the Draw button and tour card can sit above it
  useLayoutEffect(() => {
    const el = dock.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--dock-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--dock-h"); };
  }, []);

  const S = useLevel.getState;
  const activeItem = (it: Item) =>
    it.kind === "piece" ? tool === "build" && piece === it.id : it.kind === "tool" ? tool === it.id : false;
  const press = (it: Item) => {
    if (it.kind === "piece") S().setPiece(it.id);
    else if (it.kind === "tool") S().setTool(it.id);
    else if (it.id === "rotate") S().rotate();
    else if (it.id === "undo") S().undo();
    else if (it.id === "redo") S().redo();
    else setAsking(true);
  };
  const label = (it: Item) => (it.kind === "piece" ? PIECES[it.id].label : it.label);
  const disabled = (it: Item) => (it.kind === "action" && ((it.id === "undo" && !canUndo) || (it.id === "redo" && !canRedo)));

  const cat = CATEGORIES.find((c) => c.id === open);
  const current = CATEGORIES.flatMap((c) => c.items).find(activeItem);
  // The caption: what's under the pointer, or else what's picked
  const caption = hover ?? (current ? current.tip : null);

  return (
    <div className="dock-wrap" data-panel={panelOpen}>
      <div className="build-dock" ref={dock} aria-label="Building pieces and tools">
        {caption && !touchMode && <p className="dock-caption">{caption}</p>}
        {touchMode && current && <p className="dock-caption">{current.tip}</p>}
        {cat && (
          <div className="dock-items" role="toolbar" aria-label={cat.label}>
            {cat.items.map((it) => (
              <button
                key={tourName(it)}
                className="dock-item"
                data-tour={tourName(it)}
                data-on={activeItem(it)}
                data-danger={it.kind === "action" && it.id === "clear" ? true : undefined}
                disabled={disabled(it)}
                onClick={(e) => { blur(e); press(it); }}
                onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(it.tip); }}
                onPointerLeave={() => setHover(null)}
                title={it.kind === "tool" ? `${it.label} (${it.key})` : it.tip}
                aria-label={label(it)}
              >
                <span className="dock-icon" aria-hidden>
                  {it.kind === "piece" ? <PieceIcon piece={it.id} size={30} />
                    : it.id === "select" ? <MousePointer2 size={20} />
                    : it.id === "erase" ? <Eraser size={20} />
                    : it.id === "paint" ? <Sprout size={20} />
                    : it.id === "rotate" ? <RotateCw size={20} style={{ transform: `rotate(${rot * 90}deg)`, transition: "transform .2s" }} />
                    : it.id === "undo" ? <Undo2 size={20} />
                    : it.id === "redo" ? <Redo2 size={20} />
                    : <Trash2 size={20} />}
                </span>
                <span className="dock-label">{label(it)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="dock-cats" role="tablist" aria-label="Categories">
          {CATEGORIES.map((c) => {
            const holdsGlow = c.id !== open && c.items.some((it) => glow.includes(tourName(it)));
            const holdsPick = c.items.some(activeItem);
            return (
              <button
                key={c.id}
                role="tab"
                className="dock-cat"
                aria-selected={open === c.id}
                data-open={open === c.id}
                data-picked={holdsPick}
                data-tour={`cat-${c.id}`}
                data-glow-cat={holdsGlow}
                onClick={(e) => { blur(e); setOpen(open === c.id ? null : c.id); }}
                title={c.label}
              >
                <c.icon size={18} aria-hidden />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {asking && (
        <ConfirmDialog
          title="Reset level?"
          message="This removes every piece except the Start pad. (Undo can bring it back.)"
          yes="Yes, clear it"
          no="No, keep it"
          onAnswer={(yes) => { setAsking(false); if (yes) useLevel.getState().clearLevel(); }}
        />
      )}
    </div>
  );
}
