import { useRef, useState } from "react";
import { create } from "zustand";
import { Check, Minus, Plus, Download, FilePlus2, FolderOpen, Save, Trash2, Upload, X, AlertTriangle, Info } from "lucide-react";
import { currentLevel, levelSig, useDirty, useLevel } from "./levelStore";
import { deleteSavedLevel, levelFileName, listSavedLevels, readLevelFile, saveLevelToBrowser, toLevelFile, type SavedLevel } from "./levelFile";
import { CLOCK_INFO, DEFAULT_RULES, LIMIT_MAX, LIMIT_MIN, formatLimit, formatTime, goalEmoji, isPlayground, levelChecklist, type Clock } from "./rules";

/** The levels saved in this browser (re-read after every save/delete). */
export const useSlots = create<{ list: SavedLevel[]; refresh: () => void }>((set) => ({
  list: listSavedLevels(),
  refresh: () => set({ list: listSavedLevels() }),
}));

/** Save the current level in this browser. Returns false if the browser won't store it. */
export function saveCurrentLevel(): boolean {
  const L = useLevel.getState();
  const ok = saveLevelToBrowser(L.levelId, currentLevel());
  if (ok) L.markSaved();
  useSlots.getState().refresh();
  return ok;
}

/** Ask before throwing away unsaved changes. */
export function okToLeave(): boolean {
  const L = useLevel.getState();
  if (levelSig(L) === L.baselineSig) return true;
  return window.confirm(`"${L.name}" has changes that aren't saved. Continue without saving them?`);
}

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

/** Level Settings: name, goal, readiness checklist, and saving/opening levels. */
export function LevelPanel() {
  const open = useLevel((s) => s.panelOpen);
  const setOpen = useLevel((s) => s.setPanelOpen);
  const { name, rules, blocks, bestTime, levelId, setName, setRules, setBestTime } = useLevel();
  const dirty = useDirty();
  const slots = useSlots((s) => s.list);
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flash = (text: string, ok = true) => {
    setNote({ text, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2400);
  };
  const isSaved = slots.some((s) => s.id === levelId);
  const checklist = levelChecklist(rules, blocks);
  // Countdown steps: 5 seconds at a time up to a minute, then 15
  const stepLimit = (dir: 1 | -1) => {
    const l = rules.limit, step = dir > 0 ? (l >= 60 ? 15 : 5) : (l > 60 ? 15 : 5);
    setRules({ limit: Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, l + dir * step)) });
  };

  const save = () => {
    const ok = saveCurrentLevel();
    flash(ok ? `Saved "${name}"` : "This browser won't let us save", ok);
  };
  const openSlot = (slot: SavedLevel) => {
    if (slot.id === levelId && !dirty) return flash("That level is already open");
    if (!okToLeave()) return;
    const level = readLevelFile(slot.file);
    if (!level) return flash("That saved level couldn't be read", false);
    useLevel.getState().loadLevel(level, slot.id);
    flash(`Opened "${level.name}"`);
  };
  const remove = (slot: SavedLevel) => {
    if (!window.confirm(`Delete "${slot.name}" from this browser? This can't be undone.`)) return;
    deleteSavedLevel(slot.id);
    useSlots.getState().refresh();
    flash(`Deleted "${slot.name}"`);
  };
  const newLevel = () => {
    if (!okToLeave()) return;
    useLevel.getState().newLevel();
    flash("Started a new level");
  };
  const exportFile = () => {
    const blob = new Blob([JSON.stringify(toLevelFile(currentLevel()), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = levelFileName(name);
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importFile = async (f: File) => {
    try {
      const level = readLevelFile(JSON.parse(await f.text()));
      if (!level) throw new Error("not a level");
      if (!okToLeave()) return;
      useLevel.getState().loadLevel(level);
      flash(`Opened "${level.name}" (${level.blocks.length} pieces)`);
    } catch {
      flash("That file isn't a level file", false);
    }
  };

  return (
    <aside className="settings-panel level-panel" data-open={open} aria-label="Level settings" aria-hidden={!open}>
      <header className="flex items-start gap-2 border-b border-border px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Level settings</p>
          <input
            className="level-name font-display"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => { if (!e.target.value.trim()) setName("My level"); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
            aria-label="Level name"
            maxLength={40}
          />
        </div>
        <button className="level-close" onClick={() => setOpen(false)} aria-label="Close level settings" title="Close (L)">
          <X size={16} aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="level-heading">What wins the level?</p>
        <div className="goal-grid">
          {([["flag", "🏁", "Reach the flag", "Touch the checkered flag."], ["stars", "⭐", "Collect the stars", "Grab every star."]] as const).map(([key, emoji, title, blurb]) => (
            <button key={key} className="goal-card" role="checkbox" aria-checked={rules[key]} data-on={rules[key]} onClick={() => setRules({ [key]: !rules[key] })}>
              <span className="goal-tick" aria-hidden>{rules[key] && <Check size={13} strokeWidth={3} />}</span>
              <span className="goal-emoji" aria-hidden>{emoji}</span>
              <span className="goal-title">{title}</span>
              <span className="goal-blurb">{blurb}</span>
            </button>
          ))}
        </div>
        {rules.flag && rules.stars && (
          <div className="goal-need" role="radiogroup" aria-label="With both ticked">
            <button role="radio" aria-checked={rules.need === "all"} data-on={rules.need === "all"} onClick={() => setRules({ need: "all" })}>
              <strong>Do all of them</strong><span>Flag is locked 🔒 until every star is found</span>
            </button>
            <button role="radio" aria-checked={rules.need === "any"} data-on={rules.need === "any"} onClick={() => setRules({ need: "any" })}>
              <strong>Do any one</strong><span>Reach the flag <em>or</em> collect every star</span>
            </button>
          </div>
        )}
        {isPlayground(rules) && <p className="goal-note">🛝 Nothing ticked: it's just a playground to run around in.</p>}

        <p className="level-heading">Clock</p>
        <div className="clock-row" role="radiogroup" aria-label="Clock">
          {(["none", "trial", "countdown"] as Clock[]).map((c) => (
            <button key={c} className="clock-card" role="radio" aria-checked={rules.clock === c} data-on={rules.clock === c} onClick={() => setRules({ clock: c })} title={CLOCK_INFO[c].blurb}>
              <span className="goal-emoji" aria-hidden>{CLOCK_INFO[c].emoji}</span>
              <span className="goal-title">{CLOCK_INFO[c].title}</span>
            </button>
          ))}
        </div>
        <p className="goal-note">{CLOCK_INFO[rules.clock].blurb}</p>
        {rules.clock === "countdown" && (
          <div className="level-best">
            <span>Time limit</span>
            <div className="limit-stepper">
              <button onClick={() => stepLimit(-1)} disabled={rules.limit <= LIMIT_MIN} aria-label="Less time"><Minus size={14} aria-hidden /></button>
              <strong>{formatLimit(rules.limit)}</strong>
              <button onClick={() => stepLimit(1)} disabled={rules.limit >= LIMIT_MAX} aria-label="More time"><Plus size={14} aria-hidden /></button>
            </div>
          </div>
        )}
        {rules.clock === "trial" && (
          <div className="level-best">
            <span>Best time</span>
            <strong>{bestTime === null ? "none yet" : formatTime(bestTime)}</strong>
            {bestTime !== null && <button className="level-link" onClick={() => setBestTime(null)}>Reset</button>}
          </div>
        )}

        <p className="level-heading">Ready to play?</p>
        <ul className="level-checklist">
          {checklist.map((c) => (
            <li key={c.text} data-ok={c.ok} data-warn={!!c.warn}>
              {c.warn ? <Info size={14} aria-hidden /> : c.ok ? <Check size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
              <span>{c.text}</span>
            </li>
          ))}
        </ul>

        <p className="level-heading">Your levels</p>
        <div className="level-save-row">
          <button className="level-save" data-state={isSaved && !dirty ? "saved" : "unsaved"} onClick={save} disabled={isSaved && !dirty}>
            {isSaved && !dirty ? <><Check size={15} aria-hidden /> Saved</> : <><Save size={15} aria-hidden /> {isSaved ? "Save changes" : "Save level"}</>}
          </button>
          <button className="tool-btn level-new" onClick={newLevel} title="Start a new level">
            <FilePlus2 size={15} aria-hidden /> New
          </button>
        </div>
        {slots.length === 0 ? (
          <p className="level-empty">Levels you save appear here. They're kept in this browser.</p>
        ) : (
          <ul className="level-slots">
            {slots.map((s) => (
              <li key={s.id} data-current={s.id === levelId}>
                <button className="level-slot-open" onClick={() => openSlot(s)} title={`Open "${s.name}"`}>
                  <span className="level-slot-name">{s.name}{s.id === levelId && <em> · open</em>}</span>
                  <span className="level-slot-meta">{goalEmoji(readLevelFile(s.file)?.rules ?? DEFAULT_RULES)} {when(s.savedAt)}</span>
                </button>
                <button className="level-slot-icon" onClick={() => openSlot(s)} aria-label={`Open ${s.name}`} title="Open">
                  <FolderOpen size={15} aria-hidden />
                </button>
                <button className="level-slot-icon" data-danger onClick={() => remove(s)} aria-label={`Delete ${s.name}`} title="Delete">
                  <Trash2 size={15} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <button className="tool-btn level-file-btn" onClick={exportFile} title="Download this level as a file you can share">
          <Download size={14} aria-hidden /> Export file
        </button>
        <button className="tool-btn level-file-btn" onClick={() => fileRef.current?.click()} title="Open a level file">
          <Upload size={14} aria-hidden /> Import file
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
        {note && <p className="col-span-2 text-center text-xs" data-ok={note.ok} role="status" style={{ color: note.ok ? "var(--muted-foreground)" : "var(--destructive)" }}>{note.text}</p>}
      </footer>
    </aside>
  );
}
