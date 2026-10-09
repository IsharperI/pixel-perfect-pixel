import { Link } from "@tanstack/react-router";
import { Blocks, SlidersHorizontal } from "lucide-react";

/** Top ribbon shared by every page: the app name plus the mode tabs. */
export function AppRibbon() {
  return (
    <header className="app-ribbon">
      <span className="app-ribbon-title font-display">Platformer Toolkit 3D</span>
      <nav className="app-ribbon-tabs" aria-label="Mode">
        <Link to="/" className="app-tab" activeOptions={{ exact: true }} activeProps={{ "data-active": "true" }}>
          <SlidersHorizontal size={15} aria-hidden />
          <span>Character Modifiers</span>
        </Link>
        <Link to="/builder" className="app-tab" activeProps={{ "data-active": "true" }}>
          <Blocks size={15} aria-hidden />
          <span>Level Builder</span>
        </Link>
      </nav>
    </header>
  );
}
