import { useEffect, useState } from "react";
import { liveStats, useSettings, useUI } from "./settings";
import { useTutorial } from "./tutorial";
import { input } from "./input";

/** The Debug window: live numbers, plus the Trail / Ghost / Walk-Run switches. Opened from the top bar. */
export function DebugOverlay() {
  const { showDebug, showTrail, showGhost, touchMode, toggle } = useUI();
  const runButton = useSettings((v) => v.values["runButton"] === true);
  const [s, setS] = useState({ ...liveStats });
  const [running, setRunning] = useState(input.running);
  useEffect(() => {
    if (!showDebug) return;
    const id = setInterval(() => { setS({ ...liveStats }); setRunning(input.running); }, 80);
    return () => clearInterval(id);
  }, [showDebug]);
  if (!showDebug) return null;
  const toggleRun = (e: React.MouseEvent) => {
    input.running = !input.running;
    setRunning(input.running);
    (e.currentTarget as HTMLElement).blur(); // keep Space for jumping
  };
  const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur();

  return (
    <div className="debug-overlay pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
      <div className="hud-card pointer-events-auto font-mono text-xs leading-relaxed">
        <div className="mb-1.5 flex items-center gap-2">
          <button className="chip" data-on={showTrail} onClick={(e) => { blur(e); toggle("showTrail"); }} title="Draw a dotted line along your jumps">Trail</button>
          <button className="chip" data-on={showGhost} disabled={!showTrail} onClick={(e) => { blur(e); toggle("showGhost"); }} title="Show your previous jump arc, faded, to compare against the current one">Ghost</button>
          {runButton && !touchMode && (
            <button className="chip run-chip" data-on={running} onClick={toggleRun} title="Walking or running. Tap Z (or click here) to switch.">
              {running ? "Running" : "Walking"}
            </button>
          )}
        </div>
        <Row k="speed" v={`${s.speed.toFixed(2)} u/s`} />
        <Row k="vertical" v={`${s.vy.toFixed(2)} u/s`} />
        <Row k="grounded" v={s.grounded ? "yes" : "no"} hl={s.grounded} />
        <Row k="move" v={s.move} hl={s.move !== "—"} />
        <Row k="gravity" v={`${s.gravity.toFixed(1)} u/s²`} />
        <Row k="jump vel" v={`${s.jumpVelocity.toFixed(1)} u/s`} />
      </div>
    </div>
  );
}

/** The controls, in a bar along the bottom (fits around the tutorial card and the Movement Feel panel). */
export function ControlsBar() {
  const touchMode = useUI((u) => u.touchMode);
  const panelOpen = useUI((u) => u.panelOpen);
  const tutorial = useTutorial((t) => t.status === "active");
  return (
    <div className="controls-bar" data-panel={panelOpen} data-tutorial={tutorial} data-touch={touchMode}>
      <div className="hud-card text-xs text-muted-foreground">
        {touchMode
          ? <>Left thumb: move (push all the way to run) · <b>Jump</b> / <b>Crouch</b> buttons · swipe right side to look</>
          : <><kbd>WASD</kbd> move · <kbd>Z</kbd> walk/run · <kbd>Space</kbd> jump · <kbd>Shift</kbd> crouch · <kbd>E</kbd> grab vines · drag to orbit · <kbd>T</kbd> Movement Feel</>}
      </div>
    </div>
  );
}

function Row({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">{k}</span>
      <span className={hl ? "text-accent font-semibold" : ""}>{v}</span>
    </div>
  );
}
