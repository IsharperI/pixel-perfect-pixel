import { Bug, GraduationCap, SlidersHorizontal } from "lucide-react";
import { useUI } from "./settings";
import { useTutorial } from "./tutorial";
import { usePhone } from "./usePhone";

/** Top-bar switches for the Character page's windows: Movement Feel, Debug and the Tutorial. */
export function CharacterRibbonTools() {
  const hidden = useUI((u) => u.hideUI);
  const panelOpen = useUI((u) => u.panelOpen);
  const showDebug = useUI((u) => u.showDebug);
  const showOrToggle = useUI((u) => u.showOrToggle);
  const tutorialOn = useTutorial((t) => t.status === "active");
  const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur(); // keep Space for jumping
  const phone = usePhone();
  if (phone) {
    // Phones: one button for the bottom drawer (Movement Feel and Debug are tabs in it)
    return (
      <div className="ribbon-tools">
        <button className="ribbon-btn tune-btn" data-on={!hidden && panelOpen} aria-pressed={!hidden && panelOpen}
          onClick={(e) => { blur(e); showOrToggle("panelOpen"); }} title="Movement Feel and Debug">
          <SlidersHorizontal size={15} aria-hidden /><span>Tune</span>
        </button>
      </div>
    );
  }
  return (
    <div className="ribbon-tools">
      <button className="ribbon-btn" data-on={!hidden && panelOpen} aria-pressed={!hidden && panelOpen}
        onClick={(e) => { blur(e); showOrToggle("panelOpen"); }} title="Movement Feel: tune how the character moves (T)">
        <SlidersHorizontal size={14} aria-hidden /><span>Movement Feel</span>
      </button>
      <button className="ribbon-btn" data-on={!hidden && showDebug} aria-pressed={!hidden && showDebug}
        onClick={(e) => { blur(e); showOrToggle("showDebug"); }} title="Debug: live speed and jump numbers, trail and ghost">
        <Bug size={14} aria-hidden /><span>Debug</span>
      </button>
      <button className="ribbon-btn" data-on={!hidden && tutorialOn} aria-pressed={!hidden && tutorialOn}
        onClick={(e) => { blur(e); if (tutorialOn && !hidden) useTutorial.getState().exit(); else useTutorial.getState().reopen(); }}
        title="The guided tutorial">
        <GraduationCap size={14} aria-hidden /><span>Tutorial</span>
      </button>
    </div>
  );
}

/** For the phone menu: open (or carry on with) the tutorial. */
export function TutorialMenuItem() {
  return (
    <button className="ribbon-btn" onClick={(e) => { (e.currentTarget as HTMLElement).blur(); useTutorial.getState().reopen(); }}>
      <GraduationCap size={14} aria-hidden /><span>Tutorial</span>
    </button>
  );
}
