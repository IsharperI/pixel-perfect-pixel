import { useEffect, useState } from "react";
import { TOUR, tourState, useTour } from "./tour";

/** The Level Builder tour: a welcome offer on the first visit, then a step card while it runs. */
export function BuilderTour() {
  const status = useTour((t) => t.status);
  const offer = useTour((t) => t.offer);
  useEffect(() => { offer(); }, [offer]);
  if (status === "welcome") return <Welcome />;
  if (status === "active") return <TourCard />;
  return null;
}

function Welcome() {
  const begin = useTour((t) => t.begin);
  const skip = useTour((t) => t.skip);
  return (
    <div className="tut-backdrop" style={{ zIndex: 70 }}>
      <div className="tut-welcome" role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Level Builder</p>
        <h1 id="tour-welcome-title" className="font-display text-2xl font-bold tracking-tight">Let's build a level!</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Snap blocks together like LEGO, add moving platforms, vines and bounce pads, then jump in and play it.
          Take the quick tour ({TOUR.length} short steps), or start building straight away.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button className="tut-primary" onClick={begin} autoFocus>Show me how</button>
          <button className="tool-btn flex-1" onClick={skip}>I'll explore</button>
        </div>
        <p className="text-xs text-muted-foreground">You can take the tour any time from the Tour button.</p>
      </div>
    </div>
  );
}

function TourCard() {
  const index = useTour((t) => t.index);
  const goTo = useTour((t) => t.goTo);
  const exit = useTour((t) => t.exit);
  const step = TOUR[index]!;
  const [done, setDone] = useState(false);

  // Watch for the step's goal a few times a second (once done, it stays done)
  useEffect(() => {
    setDone(false);
    const check = step.done;
    if (!check) return;
    const id = setInterval(() => {
      if (check(tourState(), useTour.getState().start)) { setDone(true); clearInterval(id); }
    }, 150);
    return () => clearInterval(id);
  }, [index, step]);

  // Light up the buttons this step is about
  useEffect(() => {
    const names = step.glow ?? [];
    const apply = () => {
      document.querySelectorAll("[data-tour-glow]").forEach((el) => el.removeAttribute("data-tour-glow"));
      for (const n of names) document.querySelectorAll(`[data-tour="${n}"]`).forEach((el) => el.setAttribute("data-tour-glow", "true"));
    };
    apply();
    const id = setInterval(apply, 400); // buttons come and go (Play mode, the inspector)
    return () => { clearInterval(id); document.querySelectorAll("[data-tour-glow]").forEach((el) => el.removeAttribute("data-tour-glow")); };
  }, [step]);

  const last = index === TOUR.length - 1;
  const ready = done || !step.done;
  const blur = (e: React.PointerEvent) => (e.currentTarget as HTMLElement).blur();

  return (
    <aside className="tut-card tour-card" aria-live="polite" aria-label="Level Builder tour">
      <div className="tut-progress" aria-hidden><span style={{ width: `${((index + 1) / TOUR.length) * 100}%` }} /></div>
      <header className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tour · {index + 1}/{TOUR.length}</span>
        <button className="tut-close" onClick={exit} onPointerUp={blur} aria-label="Close the tour" title="Close the tour (reopen with the Tour button)">×</button>
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
        <button className="tool-btn flex-1" disabled={index === 0} onClick={() => goTo(index - 1)} onPointerUp={blur}>Back</button>
        <button className="tut-next flex-[2]" data-ready={ready} onClick={() => (last ? exit() : goTo(index + 1))} onPointerUp={blur}>
          {last ? "Finish" : ready ? "Next" : "Skip this step"}
        </button>
      </footer>
    </aside>
  );
}
