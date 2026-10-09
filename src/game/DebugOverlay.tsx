import { useEffect, useState } from "react";
import { liveStats, useUI } from "./settings";

export function DebugOverlay() {
  const { showDebug, showTrail, showGhost, toggle } = useUI();
  const [s, setS] = useState({ ...liveStats });
  useEffect(() => {
    const id = setInterval(() => setS({ ...liveStats }), 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
      <div className="hud-card pointer-events-auto flex items-center gap-2">
        <span className="font-display text-sm font-bold tracking-tight">Platformer Toolkit 3D</span>
        <button className="chip" data-on={showDebug} onClick={() => toggle("showDebug")}>Debug</button>
        <button className="chip" data-on={showTrail} onClick={() => toggle("showTrail")}>Trail</button>
        <button className="chip" data-on={showGhost} disabled={!showTrail} onClick={() => toggle("showGhost")} title="Show your previous jump arc, faded, to compare against the current one">Ghost</button>
      </div>
      {showDebug && (
        <div className="hud-card font-mono text-xs leading-relaxed">
          <Row k="speed" v={`${s.speed.toFixed(2)} u/s`} />
          <Row k="vertical" v={`${s.vy.toFixed(2)} u/s`} />
          <Row k="grounded" v={s.grounded ? "yes" : "no"} hl={s.grounded} />
          <Row k="gravity" v={`${s.gravity.toFixed(1)} u/s²`} />
          <Row k="jump vel" v={`${s.jumpVelocity.toFixed(1)} u/s`} />
        </div>
      )}
      <div className="hud-card text-xs text-muted-foreground">
        <kbd>WASD</kbd> move · <kbd>Space</kbd> jump · drag to orbit · <kbd>T</kbd> settings
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
