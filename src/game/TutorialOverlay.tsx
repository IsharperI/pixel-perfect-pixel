import { useEffect, useState } from "react";
import { STEPS, useTutorial, eventsSinceStart } from "./tutorial";
import { useSettings } from "./settings";

/** Welcome prompt on first visit, then the step card while the tutorial runs. */
export function Tutorial() {
  const status = useTutorial((t) => t.status);
  if (status === "welcome") return <Welcome />;
  if (status === "active") return <StepCard />;
  return null;
}

function Welcome() {
  const start = useTutorial((t) => t.start_tutorial);
  const skip = useTutorial((t) => t.skip);
  return (
    <div className="tut-backdrop">
      <div className="tut-welcome" role="dialog" aria-modal="true" aria-labelledby="tut-welcome-title">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Platformer Toolkit 3D</p>
        <h1 id="tut-welcome-title" className="font-display text-2xl font-bold tracking-tight">What makes a jump feel good?</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every number behind how a 3D platformer character moves is a slider here, and you can feel each change instantly.
          Take the guided tour ({STEPS.length} short steps), or jump straight in and explore.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button className="tut-primary" onClick={start} autoFocus>Start the tutorial</button>
          <button className="tool-btn flex-1" onClick={skip}>Explore on my own</button>
        </div>
        <p className="text-xs text-muted-foreground">You can open the tutorial any time from the top-left.</p>
      </div>
    </div>
  );
}

function StepCard() {
  const index = useTutorial((t) => t.index);
  const goTo = useTutorial((t) => t.goTo);
  const exit = useTutorial((t) => t.exit);
  const step = STEPS[index]!;
  const [done, setDone] = useState(false);

  // Watch for the step's goal, checking a few times a second
  useEffect(() => {
    setDone(false);
    const check = step.done;
    if (!check) return;
    const id = setInterval(() => {
      if (check(eventsSinceStart(), useSettings.getState().values, useTutorial.getState().startValues)) {
        setDone(true);
        clearInterval(id);
      }
    }, 150);
    return () => clearInterval(id);
  }, [index, step]);

  const last = index === STEPS.length - 1;
  const ready = done || !step.done;
  const blurAfter = (e: React.PointerEvent) => (e.currentTarget as HTMLElement).blur(); // keep Space for jumping

  return (
    <aside className="tut-card" aria-live="polite" aria-label="Tutorial">
      <div className="tut-progress" aria-hidden><span style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} /></div>
      <header className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {step.chapter} · {index + 1}/{STEPS.length}
        </span>
        <button className="tut-close" onClick={exit} onPointerUp={blurAfter} aria-label="Close tutorial" title="Close tutorial (reopen from the top-left)">×</button>
      </header>
      <h3 className="font-display text-lg font-bold leading-tight tracking-tight">{step.title}</h3>
      <p className="text-sm leading-relaxed">{step.body}</p>
      {step.tryIt && (
        <div className="tut-try" data-done={done}>
          <span className="tut-mark" aria-hidden>{done ? "✓" : "→"}</span>
          <span><strong>{done ? "Nice! " : "Try it: "}</strong>{step.tryIt}</span>
        </div>
      )}
      <footer className="flex gap-2">
        <button className="tool-btn flex-1" disabled={index === 0} onClick={() => goTo(index - 1)} onPointerUp={blurAfter}>Back</button>
        <button className="tut-next flex-[2]" data-ready={ready} onClick={() => (last ? exit() : goTo(index + 1))} onPointerUp={blurAfter}>
          {last ? "Finish" : ready ? "Next" : "Skip this step"}
        </button>
      </footer>
    </aside>
  );
}
