import { createFileRoute, Link } from "@tanstack/react-router";
import { Blocks } from "lucide-react";
import { AppRibbon } from "../components/AppRibbon";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Level Builder — Platformer Toolkit 3D" },
      { name: "description", content: "Build 3D platformer levels and playtest them with the character you tuned." },
    ],
  }),
  component: LevelBuilderPage,
});

function LevelBuilderPage() {
  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <AppRibbon />
      <main className="grid flex-1 place-items-center overflow-y-auto p-6">
        <div className="tut-welcome text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
            <Blocks size={24} aria-hidden />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Coming soon</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Level Builder</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Build platformer levels block by block on a 3D grid, then play them with the character you tuned in
            Character Modifiers. Planned pieces include platforms, bouncy pads, ladders, grind rails, jump targets and loops.
          </p>
          <Link to="/" className="tut-primary mt-2 inline-block">Tune your character</Link>
        </div>
      </main>
    </div>
  );
}
