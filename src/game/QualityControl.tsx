import { useEffect } from "react";
import { PerformanceMonitor } from "@react-three/drei";
import { loadGraphics, useQuality } from "./quality";

/**
 * Put inside a Canvas (which takes its `dpr` from useQuality). In Auto mode, watches the
 * frame rate and steps quality down (or back up) to keep the game smooth.
 */
export function QualityControl() {
  const auto = useQuality((q) => q.graphics === "auto");
  useEffect(() => { loadGraphics(); }, []);
  if (!auto) return null;
  return (
    <PerformanceMonitor
      // Below ~45fps: step down; steadily above ~58fps: step back up
      bounds={(refresh) => (refresh > 90 ? [50, 85] : [45, 58])}
      flipflops={6}
      onDecline={() => useQuality.getState().stepDown()}
      onIncline={() => useQuality.getState().stepUp()}
    />
  );
}
