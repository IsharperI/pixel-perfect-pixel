import { useEffect, useMemo, useState } from "react";
import { Eraser, Hammer, MousePointer2, Pencil, Play, Redo2, RotateCcw, RotateCw, Settings2, Undo2 } from "lucide-react";
import { useLevel, type Tool } from "./levelStore";
import { usePlay } from "./playState";
import { GOAL_INFO, formatTime, goalMissing } from "./rules";
import { BEHAVIOUR_COLOURS, PIECES, PIECE_ORDER, type Behaviour } from "./pieces";
import { PieceIcon } from "./PieceIcon";

const TOOLS: { id: Tool; label: string; key: string; icon: typeof Hammer }[] = [
  { id: "build", label: "Build", key: "B", icon: Hammer },
  { id: "select", label: "Move", key: "V", icon: MousePointer2 },
  { id: "erase", label: "Erase", key: "E", icon: Eraser },
];

const HINTS: Record<Tool, string> = {
  build: "Click to add a piece, or drag to fill an area · R rotates · right-drag turns the view · middle-drag slides · scroll zooms",
  select: "Click a block, then drag its arrows to move it (green = up, to make it float) · R rotates it · Delete removes it",
  erase: "Click a block to remove it, or drag to clear an area · Ctrl+Z brings it back · right-drag turns the view",
};

const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur();

/** Everything drawn over the 3D view: tools, pieces, Play/Stop, the colour legend and hints. */
export function BuilderUI() {
  const { tool, piece, rot, mode, past, future, panelOpen, setTool, setPiece, rotate, undo, redo, setMode, setPanelOpen } = useLevel();

  if (mode === "play") {
    return (
      <>
        <div className="builder-top">
          <button className="builder-play" data-playing="true" onClick={(e) => { blur(e); setMode("edit"); }}>
            <Pencil size={18} aria-hidden /> Back to building <kbd>Esc</kbd>
          </button>
        </div>
        <PlayHud />
        <WinScreen />
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

      <div className="builder-top" data-panel={panelOpen}>
        <button className="builder-level-btn" data-on={panelOpen} onClick={(e) => { blur(e); setPanelOpen(!panelOpen); }} title="Level settings: goal, saving and opening levels (L)">
          <Settings2 size={16} aria-hidden /> Level <kbd>L</kbd>
        </button>
        <button className="builder-play" onClick={(e) => { blur(e); startPlay(); }} title="Play your level">
          <Play size={18} aria-hidden fill="currentColor" /> Play
        </button>
      </div>

      {!panelOpen && <Legend />}
      {!panelOpen && <div className="builder-hint">{HINTS[tool]}</div>}
    </>
  );
}

/** Start (or restart) playing the level. */
export function startPlay() {
  usePlay.getState().restart();
  useLevel.getState().setMode("play");
}

/** The goal along the top while playing: stars collected, the timer, or what to do. */
function PlayHud() {
  const goal = useLevel((s) => s.goal);
  const blocks = useLevel((s) => s.blocks);
  const bestTime = useLevel((s) => s.bestTime);
  const collected = usePlay((s) => s.collected.length);
  const won = usePlay((s) => s.won);
  const totalStars = useMemo(() => blocks.filter((b) => b.piece === "star").length, [blocks]);
  const missing = goalMissing(goal, blocks);
  const info = GOAL_INFO[goal];

  return (
    <div className="play-hud" data-won={won} aria-live="polite">
      <div className="play-hud-pill">
        {goal === "time" ? (
          <>
            <span aria-hidden>{info.emoji}</span>
            <Timer />
            {bestTime !== null && <span className="play-hud-sub">Best {formatTime(bestTime)}</span>}
          </>
        ) : goal === "stars" ? (
          <><span aria-hidden>⭐</span><strong className="tabular-nums">{collected} / {totalStars}</strong></>
        ) : (
          <><span aria-hidden>{info.emoji}</span><span>{info.title}</span></>
        )}
        {goal !== "stars" && totalStars > 0 && (
          <span className="play-hud-stars"><span aria-hidden>⭐</span> <span className="tabular-nums">{collected}/{totalStars}</span></span>
        )}
      </div>
      {missing && <p className="play-hud-missing">{missing}</p>}
    </div>
  );
}

/** A running clock for time trials (stops when you finish). */
function Timer() {
  const startedAt = usePlay((s) => s.startedAt);
  const finishTime = usePlay((s) => s.finishTime);
  const [now, setNow] = useState(() => performance.now() / 1000);
  useEffect(() => {
    if (finishTime !== null) return;
    let id = 0;
    const tick = () => { setNow(performance.now() / 1000); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [finishTime]);
  return <strong className="tabular-nums">{formatTime(finishTime ?? Math.max(0, now - startedAt))}</strong>;
}

const CONFETTI_COLOURS = ["#fbbf24", "#f59ac0", "#22c55e", "#60a5fa", "#f97316", "#a78bfa"];

/** The celebration when you finish the level. */
function WinScreen() {
  const won = usePlay((s) => s.won);
  const finishTime = usePlay((s) => s.finishTime);
  const newBest = usePlay((s) => s.newBest);
  const collected = usePlay((s) => s.collected.length);
  const goal = useLevel((s) => s.goal);
  const blocks = useLevel((s) => s.blocks);
  const bestTime = useLevel((s) => s.bestTime);
  const totalStars = blocks.filter((b) => b.piece === "star").length;
  const confetti = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 1.4,
      colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]!,
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 1080,
      round: i % 3 === 0,
    })),
    [won], // eslint-disable-line react-hooks/exhaustive-deps -- new confetti for each win
  );
  if (!won) return null;

  const title = goal === "stars" ? "All the stars!" : goal === "time" ? (newBest ? "New best time!" : "Finished!") : "You did it!";
  let detail = "";
  if (goal === "time" && finishTime !== null) {
    detail = newBest || bestTime === null || bestTime === finishTime
      ? `${formatTime(finishTime)}${newBest ? "" : " · that's the time to beat"}`
      : `${formatTime(finishTime)} · best ${formatTime(bestTime)}`;
  } else if (goal === "stars") detail = `You collected all ${totalStars} star${totalStars === 1 ? "" : "s"}`;
  else if (totalStars > 0) detail = `Stars: ${collected} of ${totalStars}`;

  return (
    <div className="win-overlay" role="dialog" aria-label={title}>
      <div className="win-confetti" aria-hidden>
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              left: `${c.left}%`, background: c.colour, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`,
              borderRadius: c.round ? "50%" : "2px",
              ["--drift" as string]: `${c.drift}px`, ["--spin" as string]: `${c.spin}deg`,
            }}
          />
        ))}
      </div>
      <div className="win-card">
        <div className="win-emoji" aria-hidden>{goal === "stars" ? "⭐" : goal === "time" ? "⏱️" : "🏁"}</div>
        <h2 className="win-title font-display">{title}</h2>
        {detail && <p className="win-detail">{detail}</p>}
        <div className="win-actions">
          <button className="win-btn" data-primary onClick={(e) => { blur(e); startPlay(); }}>
            <RotateCcw size={16} aria-hidden /> Play again <kbd>Enter</kbd>
          </button>
          <button className="win-btn" onClick={(e) => { blur(e); useLevel.getState().setMode("edit"); }}>
            <Pencil size={16} aria-hidden /> Back to building <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

/** What each colour means. */
function Legend() {
  const shown: Behaviour[] = ["solid", "slope", "start", "goal", "star"];
  return (
    <div className="builder-legend" aria-label="Colour key">
      <p className="builder-heading">Colour key</p>
      {shown.map((b) => (
        <div key={b} className="builder-legend-row">
          <span className="builder-swatch" data-kind={b} style={{ background: BEHAVIOUR_COLOURS[b].colour, borderColor: BEHAVIOUR_COLOURS[b].edge }} />
          <span>{BEHAVIOUR_COLOURS[b].meaning}</span>
        </div>
      ))}
    </div>
  );
}
