import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "../game/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Platformer Toolkit 3D — Tune & Feel Character Movement" },
      { name: "description", content: "Tune a 3D platformer character's movement with live sliders, then play to feel the difference." },
      { property: "og:title", content: "Platformer Toolkit 3D" },
      { property: "og:description", content: "Live-tune jump height, gravity, coyote time and camera — then play instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
