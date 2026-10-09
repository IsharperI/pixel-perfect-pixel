import { useRef, useState } from "react";
import { SETTINGS, useSettings, useUI, type SettingDef } from "./settings";

const CATEGORIES = ["Movement", "Jump", "Camera"] as const;

export function SettingsPanel() {
  const open = useUI((s) => s.panelOpen);
  const toggle = useUI((s) => s.toggle);
  const { values, reset, load } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(null), 2200); };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(values, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "platformer-settings.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File) => {
    try {
      const n = load(JSON.parse(await f.text()));
      flash(`Loaded ${n} settings`);
    } catch {
      flash("That file isn't valid settings JSON");
    }
  };

  return (
    <>
      <button className="panel-toggle" data-open={open} onClick={() => toggle("panelOpen")} aria-label="Toggle settings">
        {open ? "→" : "⚙ Tune"} <kbd>T</kbd>
      </button>
      <aside className="settings-panel" data-open={open}>
        <header className="border-b border-border px-5 pb-4 pt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Inspector</p>
          <h2 className="font-display text-xl font-bold tracking-tight">Movement Feel</h2>
        </header>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {CATEGORIES.map((c) => (
            <Section key={c} title={c} defs={SETTINGS.filter((s) => s.category === c)} />
          ))}
        </div>
        <footer className="grid grid-cols-3 gap-2 border-t border-border p-3">
          <button className="tool-btn" onClick={() => { reset(); flash("Reset to defaults"); }}>Reset</button>
          <button className="tool-btn" onClick={exportJson}>Export</button>
          <button className="tool-btn" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
          {note && <p className="col-span-3 text-center text-xs text-muted-foreground">{note}</p>}
        </footer>
      </aside>
    </>
  );
}

function Section({ title, defs }: { title: string; defs: SettingDef[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-2 rounded-lg">
      <button className="section-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        <span className="text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="flex flex-col gap-1 pb-2">{defs.map((d) => <SettingRow key={d.key} def={d} />)}</div>}
    </section>
  );
}

function SettingRow({ def }: { def: SettingDef }) {
  const value = useSettings((s) => s.values[def.key]);
  const parentOn = useSettings((s) => (def.dependsOn ? (s.values[def.dependsOn] as boolean) : true));
  const set = useSettings((s) => s.set);
  const [help, setHelp] = useState(false);
  const isDefault = value === def.default;
  if (!parentOn) return null;

  return (
    <div className="setting-row">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor={def.key} className="text-sm font-medium">{def.label}</label>
          <button className="help-dot" data-on={help} onClick={() => setHelp(!help)} aria-label={`About ${def.label}`}>?</button>
        </div>
        {def.kind === "number" ? (
          <span className="value-pill" data-changed={!isDefault}>
            {(value as number).toFixed(stepDecimals(def.step))}
            {def.unit && <span className="ml-0.5 opacity-60">{def.unit}</span>}
          </span>
        ) : (
          <button id={def.key} role="switch" aria-checked={value as boolean} className="switch" data-on={value as boolean} onClick={() => set(def.key, !value)}>
            <span />
          </button>
        )}
      </div>
      {help && <p className="mt-1 text-xs leading-snug text-muted-foreground">{def.description}</p>}
      {def.kind === "number" && (
        <input
          id={def.key}
          type="range"
          className="slider mt-2"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value as number}
          style={{ "--fill": `${(((value as number) - def.min!) / (def.max! - def.min!)) * 100}%` } as React.CSSProperties}
          onChange={(e) => set(def.key, parseFloat(e.target.value))}
          onPointerUp={(e) => (e.target as HTMLElement).blur()}
          onDoubleClick={() => set(def.key, def.default)}
        />
      )}
    </div>
  );
}

const stepDecimals = (step = 1) => (step >= 1 ? 0 : String(step).split(".")[1]?.length ?? 2);
