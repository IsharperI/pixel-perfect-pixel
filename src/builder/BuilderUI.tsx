import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eraser, GraduationCap, Hammer, MousePointer2, MoveRight, Scale, Sprout, Pencil, Play, Plus, Redo2, RotateCcw, RotateCw, Settings2, Trash2, Undo2, X } from "lucide-react";
import { useLevel, type Tool } from "./levelStore";
import { usePlay } from "./playState";
import { useTour } from "./tour";
import { flagLocked, formatCountdown, formatTime, goalEmoji, goalMissing, goalSentence, isPlayground, type Rules } from "./rules";
import { BEHAVIOUR_COLOURS, BOUNCE_MAX, BOUNCE_MIN, PIECES, PIECE_ORDER, bounceHeight, canMove, type Behaviour, type Motion } from "./pieces";
import { MAX_STOPS } from "./levelStore";
import { SPEEDS, WAITS, defaultMotion } from "./motion";
import { TILT_MAX, TILT_MIN, TILT_STEP } from "./tilt";
import { useSettings, useUI } from "../game/settings";
import { PieceIcon } from "./PieceIcon";
import { ShareButton } from "./ShareLevel";

const TOOLS: { id: Tool; label: string; key: string; icon: typeof Hammer }[] = [
  { id: "build", label: "Build", key: "B", icon: Hammer },
  { id: "select", label: "Move", key: "V", icon: MousePointer2 },
  { id: "paint", label: "Vines", key: "P", icon: Sprout },
  { id: "erase", label: "Erase", key: "E", icon: Eraser },
];

const HINTS: Record<Tool, string> = {
  build: "Click to add a piece, or drag to fill an area · R rotates · right-drag turns the view · middle-drag slides · scroll zooms",
  select: "Click a block, then drag its arrows to move it (green = up, to make it float) · Make it move or tilt for special platforms · R rotates · Delete removes",
  paint: "Click a block's side to grow climbable vines (click again to remove) · drag to paint along a wall · right-drag turns the view",
  erase: "Click a block to remove it, or drag to clear an area · Ctrl+Z brings it back · right-drag turns the view",
};

const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur();

/** Everything drawn over the 3D view: tools, pieces, Play/Stop, the colour legend and hints. */
export function BuilderUI() {
  const { tool, piece, rot, mode, past, future, panelOpen, setTool, setPiece, rotate, undo, redo, setMode, setPanelOpen } = useLevel();
  const touring = useTour((t) => t.status === "active");
  const touchMode = useUI((u) => u.touchMode);

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
        <div className="builder-hint" data-tour-hidden={touring}>
          <kbd>WASD</kbd> move · <kbd>Space</kbd> jump · <kbd>Shift</kbd> crouch · <kbd>Z</kbd> walk/run · <kbd>E</kbd> grab vines · drag to look around
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
            <button key={t.id} className="builder-tool" data-tour={`tool-${t.id}`} data-on={tool === t.id} onClick={(e) => { blur(e); setTool(t.id); }} title={`${t.label} (${t.key})`}>
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
              data-tour={`piece-${id}`}
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
          <button className="builder-action" data-tour="rotate" onClick={(e) => { blur(e); rotate(); }} title="Rotate (R)">
            <RotateCw size={16} aria-hidden style={{ transform: `rotate(${rot * 90}deg)`, transition: "transform .2s" }} />
          </button>
          <button className="builder-action" data-tour="undo" onClick={(e) => { blur(e); undo(); }} disabled={!past.length} title="Undo (Ctrl+Z)">
            <Undo2 size={16} aria-hidden />
          </button>
          <button className="builder-action" onClick={(e) => { blur(e); redo(); }} disabled={!future.length} title="Redo (Ctrl+Y)">
            <Redo2 size={16} aria-hidden />
          </button>
        </div>
        <ClearButton />
      </aside>

      <div className="builder-top" data-panel={panelOpen}>
        <button className="builder-level-btn" data-tour="tour" onClick={(e) => { blur(e); useTour.getState().begin(); }} title="Take the Level Builder tour">
          <GraduationCap size={16} aria-hidden /> <span className="btn-label">Tour</span>
        </button>
        <button className="builder-level-btn" data-tour="level" data-on={panelOpen} onClick={(e) => { blur(e); setPanelOpen(!panelOpen); }} title="Level settings: goal, saving and opening levels (L)">
          <Settings2 size={16} aria-hidden /> <span className="btn-label">Level</span> <kbd>L</kbd>
        </button>
        <ShareButton />
        <button className="builder-play" data-tour="play" onClick={(e) => { blur(e); startPlay(); }} title="Play your level">
          <Play size={18} aria-hidden fill="currentColor" /> Play
        </button>
      </div>

      {tool === "select" && <BlockInspector panelOpen={panelOpen} />}
      {touchMode && tool !== "select" && <DrawButton />}
      {!panelOpen && <Legend />}
      {!panelOpen && !touring && <div className="builder-hint">{HINTS[tool]}</div>}
    </>
  );
}

/** Start (or restart) playing the level. */
export function startPlay() {
  usePlay.getState().restart();
  useLevel.getState().setMode("play");
}

/** Along the top while playing: what to do, stars collected, and the clock. */
function PlayHud() {
  const rules = useLevel((s) => s.rules);
  const blocks = useLevel((s) => s.blocks);
  const bestTime = useLevel((s) => s.bestTime);
  const collected = usePlay((s) => s.collected.length);
  const won = usePlay((s) => s.won);
  const hint = usePlay((s) => s.hint);
  const totalStars = useMemo(() => blocks.filter((b) => b.piece === "star").length, [blocks]);
  const missing = goalMissing(rules, blocks);
  const playground = isPlayground(rules);
  const locked = flagLocked(rules, collected, totalStars);

  return (
    <div className="play-hud" data-won={won} aria-live="polite">
      <div className="play-hud-pill">
        <span className="play-hud-goal">
          <span aria-hidden>{locked ? "🔒" : goalEmoji(rules)}</span>
          <span>{goalSentence(rules)}</span>
        </span>
        {totalStars > 0 && (
          <span className="play-hud-part" data-done={collected >= totalStars}>
            <span aria-hidden>⭐</span> <strong className="tabular-nums">{collected}/{totalStars}</strong>
          </span>
        )}
        {!playground && rules.clock !== "none" && (
          <span className="play-hud-part">
            <Clock rules={rules} />
            {rules.clock === "trial" && bestTime !== null && <span className="play-hud-sub">Best {formatTime(bestTime)}</span>}
          </span>
        )}
      </div>
      {missing && <p className="play-hud-missing">{missing}</p>}
      {hint && <HintToast key={hint.at} text={hint.text} />}
    </div>
  );
}

/** A message that shows for a couple of seconds. */
function HintToast({ text }: { text: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShown(false), 2200); return () => clearTimeout(t); }, []);
  return shown ? <p className="play-hud-hint">{text}</p> : null;
}

/** The stopwatch (counting up) or countdown (red in the last ten seconds). Stops when the run ends. */
function Clock({ rules }: { rules: Rules }) {
  const startedAt = usePlay((s) => s.startedAt);
  const finishTime = usePlay((s) => s.finishTime);
  const lost = usePlay((s) => s.lost);
  const [now, setNow] = useState(() => performance.now() / 1000);
  const stopped = finishTime !== null || lost;
  useEffect(() => {
    if (stopped) return;
    let id = 0;
    const tick = () => { setNow(performance.now() / 1000); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [stopped]);
  const elapsed = finishTime ?? Math.max(0, now - startedAt);
  if (rules.clock === "countdown") {
    const left = lost ? 0 : rules.limit - elapsed;
    return (
      <>
        <span aria-hidden>⏳</span>
        <strong className="tabular-nums play-hud-countdown" data-urgent={left < 10}>{formatCountdown(left)}</strong>
      </>
    );
  }
  return <><span aria-hidden>⏱️</span><strong className="tabular-nums">{formatTime(elapsed)}</strong></>;
}

const CONFETTI_COLOURS = ["#fbbf24", "#f59ac0", "#22c55e", "#60a5fa", "#f97316", "#a78bfa"];

/** The end of a run: a celebration when you win, or "Out of time!" when a countdown runs out. */
function WinScreen() {
  const won = usePlay((s) => s.won);
  const lost = usePlay((s) => s.lost);
  const finishTime = usePlay((s) => s.finishTime);
  const newBest = usePlay((s) => s.newBest);
  const collected = usePlay((s) => s.collected.length);
  const rules = useLevel((s) => s.rules);
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
  if (!won && !lost) return null;

  const actions = (
    <div className="win-actions">
      <button className="win-btn" data-primary onClick={(e) => { blur(e); startPlay(); }}>
        <RotateCcw size={16} aria-hidden /> {lost ? "Try again" : "Play again"} <kbd>Enter</kbd>
      </button>
      <button className="win-btn" onClick={(e) => { blur(e); useLevel.getState().setMode("edit"); }}>
        <Pencil size={16} aria-hidden /> Back to building <kbd>Esc</kbd>
      </button>
    </div>
  );

  if (lost) {
    const left = totalStars - collected;
    return (
      <div className="win-overlay" data-lost role="dialog" aria-label="Out of time">
        <div className="win-card">
          <div className="win-emoji" aria-hidden>⏰</div>
          <h2 className="win-title font-display">Out of time!</h2>
          <p className="win-detail">{rules.stars && left > 0 ? `${left} collectable${left === 1 ? "" : "s"} still to find. So close!` : "So close! Have another go."}</p>
          {actions}
        </div>
      </div>
    );
  }

  const title = rules.clock === "trial" && newBest ? "New best time!" : "You did it!";
  const parts: string[] = [];
  if (finishTime !== null && rules.clock === "trial") {
    parts.push(formatTime(finishTime));
    if (!newBest && bestTime !== null && bestTime !== finishTime) parts.push(`best ${formatTime(bestTime)}`);
    else if (!newBest) parts.push("that's the time to beat");
  }
  if (finishTime !== null && rules.clock === "countdown") parts.push(`with ${formatCountdown(rules.limit - finishTime)} to spare`);
  if (totalStars > 0) parts.push(collected >= totalStars ? `all ${totalStars} collectable${totalStars === 1 ? "" : "s"}` : `collectables: ${collected} of ${totalStars}`);
  const detail = parts.join(" · ");

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
        <div className="win-emoji" aria-hidden>{rules.clock !== "none" ? "⏱️" : rules.stars && !rules.flag ? "⭐" : "🏁"}</div>
        <h2 className="win-title font-display">{title}</h2>
        {detail && <p className="win-detail">{detail}</p>}
        {actions}
      </div>
    </div>
  );
}

/**
 * Touch screens: the Draw switch. On, your finger places (or paints, or erases) and the camera holds
 * still. Off, one finger turns the view, two fingers pinch to zoom and drag to slide it.
 */
function DrawButton() {
  const draw = useLevel((s) => s.draw);
  const nudgeAt = useLevel((s) => s.drawNudgeAt);
  const [nudging, setNudging] = useState(false);
  useEffect(() => {
    if (nudgeAt < 0) return;
    setNudging(true);
    const t = setTimeout(() => setNudging(false), 1800);
    return () => clearTimeout(t);
  }, [nudgeAt]);
  return (
    <div className="draw-switch">
      {nudging && !draw && <p className="draw-nudge">Tap Draw to put things down</p>}
      <button
        className="draw-btn"
        data-tour="draw"
        data-on={draw}
        data-nudge={nudging && !draw}
        aria-pressed={draw}
        onClick={(e) => { blur(e); useLevel.getState().setDraw(!draw); }}
      >
        <Pencil size={22} aria-hidden />
        <span className="draw-btn-label">{draw ? "Draw on" : "Draw off"}</span>
        <span className="draw-btn-sub">{draw ? "camera still" : "drag to look"}</span>
      </button>
    </div>
  );
}

/** Pick one of a few labelled choices. */
function Choice<T extends string | number | boolean>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="insp-row">
      <span className="insp-label">{label}</span>
      <div className="insp-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={String(v)} role="radio" aria-checked={value === v} data-on={value === v} onClick={(e) => { blur(e); onChange(v); }}>{text}</button>
        ))}
      </div>
    </div>
  );
}

/** Settings for the selected block: make it move, its stops, speed, waiting, and how it starts and ends. */
function BlockInspector({ panelOpen }: { panelOpen: boolean }) {
  const block = useLevel((s) => s.blocks.find((b) => b.id === s.selectedId) ?? null);
  const stopIndex = useLevel((s) => s.stopIndex);
  if (!block) return null;
  const S = useLevel.getState();
  const m = block.move;
  const label = PIECES[block.piece].label;
  const nearest = <T extends number>(v: number, opts: readonly T[]) => opts.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

  return (
    <div className="insp" data-panel={panelOpen} aria-label="Selected piece">
      <div className="insp-head">
        <span className="insp-title">{m ? `Moving ${label.toLowerCase()}` : block.tilt ? `Tilting ${label.toLowerCase()}` : label}</span>
        <button className="insp-x" onClick={(e) => { blur(e); S.select(null); }} aria-label="Deselect"><X size={14} aria-hidden /></button>
      </div>
      {block.piece === "bounce" ? (
        <BounceSlider id={block.id} height={bounceHeight(block)} />
      ) : block.piece === "star" ? (
        <HomingToggle id={block.id} on={!!block.homing} />
      ) : !canMove(block.piece) ? (
        <p className="insp-note">{PIECES[block.piece].ramp ? "Ramps can't move or tilt (yet)." : "This piece stays put."} Drag the arrows to move it around.</p>
      ) : block.tilt ? (
        <>
          <p className="insp-note">
            It tips toward whichever {block.piece === "plank" ? "end" : "side"} you stand on, like a seesaw, and slowly levels out when you step off.
            The pivot is in the middle.
          </p>
          <TiltSlider id={block.id} max={block.tilt.max} />
          <button className="level-link insp-stopmoving" onClick={(e) => { blur(e); S.setTilt(block.id, false); }}>Stop it tilting</button>
        </>
      ) : !m ? (
        <>
          <div className="insp-makes">
            <button className="insp-make" data-tour="make-move" onClick={(e) => { blur(e); S.setMotion(block.id, defaultMotion()); }}>
              <MoveRight size={16} aria-hidden /> Make it move
            </button>
            <button className="insp-make" data-kind="tilt" data-tour="make-tilt" onClick={(e) => { blur(e); S.setTilt(block.id, true); }}>
              <Scale size={16} aria-hidden /> Make it tilt
            </button>
          </div>
          <p className="insp-note">Moving platforms turn orange and travel between stops you place. Tilting ones turn purple and tip like a seesaw when you stand on them.</p>
        </>
      ) : (
        <>
          <div className="insp-row">
            <span className="insp-label">Stops</span>
            <div className="insp-stops">
              {[0, ...m.stops.map((_, i) => i + 1)].map((i) => (
                <button key={i} className="insp-stop" data-on={stopIndex === i} onClick={(e) => { blur(e); S.selectStop(i); }} title={i === 0 ? "Where it starts (moves the whole path)" : `Stop ${i + 1}: drag its arrows to move it`}>
                  {i + 1}
                </button>
              ))}
              {m.stops.length < MAX_STOPS && (
                <button className="insp-stop" data-add onClick={(e) => { blur(e); S.addStop(block.id); }} title="Add another stop"><Plus size={13} aria-hidden /></button>
              )}
            </div>
          </div>
          <p className="insp-note">
            {stopIndex === 0 ? "Stop 1 is where it starts. Moving it moves the whole path." : `Drag the arrows to move stop ${stopIndex + 1}.`}
            {stopIndex > 0 && <button className="level-link insp-remove" onClick={(e) => { blur(e); S.removeStop(block.id, stopIndex); }}>Remove stop {stopIndex + 1}</button>}
          </p>
          <Choice<number> label="Speed" value={nearest(m.speed, Object.values(SPEEDS))} options={[[SPEEDS.slow, "Slow"], [SPEEDS.medium, "Medium"], [SPEEDS.fast, "Fast"]]} onChange={(speed) => S.updateMotion(block.id, { speed })} />
          <Choice<number> label="Wait at stops" value={nearest(m.wait, Object.values(WAITS))} options={[[WAITS.none, "No"], [WAITS.short, "A bit"], [WAITS.long, "Longer"]]} onChange={(wait) => S.updateMotion(block.id, { wait })} />
          <Choice<Motion["trigger"]> label="Starts" value={m.trigger} options={[["always", "Right away"], ["step", "When stepped on"]]} onChange={(trigger) => S.updateMotion(block.id, { trigger })} />
          <Choice<boolean> label="At the end" value={m.loop} options={[[false, "Back and forth"], [true, "Loop"]]} onChange={(loop) => S.updateMotion(block.id, { loop })} />
          <button className="level-link insp-stopmoving" onClick={(e) => { blur(e); S.setMotion(block.id, undefined); }}>Stop it moving</button>
        </>
      )}
    </div>
  );
}

/** Can the homing attack lock onto this collectable? */
function HomingToggle({ id, on }: { id: string; on: boolean }) {
  const characterHas = useSettings((s) => !!s.values["homingAttack"]);
  return (
    <>
      <Choice<boolean> label="Homing attack target" value={on} options={[[false, "Off"], [true, "On"]]} onChange={(v) => useLevel.getState().setHoming(id, v)} />
      <p className="insp-note">
        {on
          ? "In mid-air, the homing attack can lock onto it: press jump to dash to it, grab it and bounce off. It gets a blue ring so players know."
          : "Switch on to let the homing attack lock onto it in mid-air. Great for chains of collectables over a gap."}
        {on && !characterHas && <> <b>Your character's Homing Attack is off:</b> switch it on in Character Modifiers (Moves).</>}
      </p>
    </>
  );
}

/** How high a bounce pad launches you. */
function BounceSlider({ id, height }: { id: string; height: number }) {
  const feel = height <= 3 ? "A little hop" : height <= 6 ? "A big boing" : height <= 9 ? "Super bounce" : "To the sky!";
  return (
    <div className="insp-row">
      <span className="insp-label">How high</span>
      <div className="tilt-slider" data-kind="bounce">
        <input
          type="range"
          min={BOUNCE_MIN}
          max={BOUNCE_MAX}
          step={1}
          value={height}
          onChange={(e) => useLevel.getState().setBounce(id, Number(e.target.value))}
          onPointerUp={(e) => (e.currentTarget as HTMLElement).blur()}
          aria-label="How high it bounces you, in blocks"
        />
        <strong>{height}</strong>
      </div>
      <p className="insp-note">
        <b className="insp-bounce-feel">{feel}</b> Launches you {height} blocks up. Hold jump as you land for an extra-high bounce.
      </p>
    </div>
  );
}

/** How far a tilting platform tips. Past the character's Slide Angle, it slides them off. */
function TiltSlider({ id, max }: { id: string; max: number }) {
  const slide = useSettings((s) => s.values["slideSlope"] as number);
  const drops = max > slide;
  const feel = max <= 15 ? "A gentle wobble" : max <= 30 ? "A wobbly seesaw" : drops ? "Tips you off!" : "Very tippy";
  return (
    <div className="insp-row">
      <span className="insp-label">How far it tips</span>
      <div className="tilt-slider">
        <input
          type="range"
          min={TILT_MIN}
          max={TILT_MAX}
          step={TILT_STEP}
          value={max}
          onChange={(e) => useLevel.getState().setTiltMax(id, Number(e.target.value))}
          onPointerUp={(e) => (e.currentTarget as HTMLElement).blur()}
          aria-label="How far it tips, in degrees"
          style={{ ["--fill" as string]: `${((max - TILT_MIN) / (TILT_MAX - TILT_MIN)) * 100}%` }}
        />
        <strong>{max}°</strong>
      </div>
      <p className="insp-note" data-drops={drops}>
        <b>{feel}</b>{" "}
        {drops
          ? `Steeper than your character's Slide Angle (${slide}°), so they'll slide off the low end.`
          : `Your character can stand on it (their Slide Angle is ${slide}°).`}
      </p>
    </div>
  );
}

/** Empty the level, after asking. */
function ClearButton() {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button className="builder-clear" onClick={(e) => { blur(e); setAsking(true); }} title="Remove everything and start again">
        <Trash2 size={14} aria-hidden /> Clear level
      </button>
      {asking && (
        <ConfirmDialog
          title="Reset level?"
          message="This removes every piece except the Start pad. (Undo can bring it back.)"
          yes="Yes, clear it"
          no="No, keep it"
          onAnswer={(yes) => { setAsking(false); if (yes) useLevel.getState().clearLevel(); }}
        />
      )}
    </>
  );
}

/** A friendly yes/no question. Enter = yes, Esc = no. */
export function ConfirmDialog({ title, message, yes, no, onAnswer }: { title: string; message: string; yes: string; no: string; onAnswer: (yes: boolean) => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onAnswer(false); }
      else if (e.key === "Enter") { e.stopImmediatePropagation(); e.preventDefault(); onAnswer(true); }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onAnswer]);
  // Drawn on top of the whole page (not inside whatever panel opened it)
  return createPortal(
    <div className="confirm-overlay" role="alertdialog" aria-modal="true" aria-label={title} onClick={() => onAnswer(false)}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title font-display">{title}</h2>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="win-btn" onClick={() => onAnswer(false)}>{no}</button>
          <button className="win-btn" data-danger autoFocus onClick={() => onAnswer(true)}>{yes}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** What each colour means. */
function Legend() {
  const shown: Behaviour[] = ["solid", "slope", "moving", "tilting", "vines", "bounce", "danger", "start", "checkpoint", "goal", "star"];
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
