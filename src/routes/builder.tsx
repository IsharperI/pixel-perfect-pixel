import { createFileRoute } from "@tanstack/react-router";
import { LevelBuilder } from "../builder/LevelBuilder";

export const Route = createFileRoute("/builder")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Level Builder — Platformer Toolkit 3D" },
      { name: "description", content: "Build 3D platformer levels with blocks, then play them with the character you tuned." },
    ],
  }),
  component: LevelBuilder,
});
