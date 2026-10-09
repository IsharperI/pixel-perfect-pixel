import { useEffect, useRef } from "react";
import { liveStats, useSettings } from "./settings";

/** Screen-edge speed streaks that fade in at high speed and flicker slightly. */
export function SpeedLines() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      const on = useSettings.getState().values["speedLines"] === true;
      // Fade in from about 10 u/s, full strength near 22 u/s
      const k = on ? Math.min(Math.max((liveStats.speedT - 0.25) / 0.7, 0), 1) : 0;
      el.style.opacity = k.toFixed(3);
      if (k > 0 && t - last > 45) {
        // Small random rotation each ~45ms makes the streaks flicker like motion
        last = t;
        el.style.transform = `rotate(${(Math.random() * 6).toFixed(2)}deg) scale(${(1.02 + Math.random() * 0.04).toFixed(3)})`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="speed-lines" aria-hidden />;
}
