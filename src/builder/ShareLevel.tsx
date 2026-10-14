import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Link2, Play } from "lucide-react";
import { currentLevel, useLevel } from "./levelStore";
import { useTour } from "./tour";
import { okToLeave } from "./LevelPanel";
import { LONG_LINK, codeFromHash, decodeLevel, shareLink } from "./shareLink";
import { startPlay } from "./BuilderUI";

const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur(); // keep Space for jumping

/** The Share button: makes a link that opens this level for anyone, and copies it. */
export function ShareButton() {
  const [link, setLink] = useState<string | null>(null);
  const open = async (e: React.MouseEvent) => {
    blur(e);
    setLink(await shareLink(currentLevel()));
  };
  return (
    <>
      <button className="builder-level-btn" data-tour="share" onClick={(e) => void open(e)} title="Share this level as a link anyone can open">
        <Link2 size={16} aria-hidden /> <span className="btn-label">Share</span>
      </button>
      {link && <ShareDialog link={link} onClose={() => setLink(null)} />}
    </>
  );
}

function ShareDialog({ link, onClose }: { link: string; onClose: () => void }) {
  const name = useLevel((s) => s.name);
  const [copied, setCopied] = useState<boolean | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { field.current?.select(); setCopied(false); } // clipboard blocked: select it so Ctrl+C works
  };
  useEffect(() => { void copy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- copy straight away
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  const long = link.length > LONG_LINK;
  return createPortal(
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Share this level" onClick={onClose}>
      <div className="confirm-card share-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title font-display">Share “{name}”</h2>
        <p className="confirm-message">Anyone with this link can play your level and build on their own copy. Nothing is uploaded: the whole level is inside the link.</p>
        <div className="share-row">
          <input ref={field} className="share-field" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
          <button className="win-btn" data-primary onClick={() => void copy()}>
            {copied ? <><Check size={15} aria-hidden /> Copied</> : <><Copy size={15} aria-hidden /> Copy</>}
          </button>
        </div>
        {copied === false && <p className="share-note">Couldn't copy automatically. The link is selected: press Ctrl+C (or long-press and Copy).</p>}
        <p className="share-note">
          The link is a snapshot: if you change the level later, share a new link.
          {long && <> <b>This is a big level, so the link is long ({link.length.toLocaleString()} characters).</b> Email and most chat apps are fine; some text messages may cut it off. Export file (in Level settings) always works.</>}
        </p>
        <div className="confirm-actions">
          <button className="win-btn" autoFocus onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Opening a shared link: load the level from the address and offer to play it. */
export function SharedLevelOpener() {
  const [shared, setShared] = useState<{ name: string } | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    const check = async () => {
      const code = codeFromHash(window.location.hash);
      if (!code) return;
      // Take the level out of the address, so refreshing doesn't throw away your changes
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      const level = await decodeLevel(code);
      useTour.setState({ status: "off" }); // no tour pop-up over the shared level
      if (!level) { setBroken(true); return; }
      if (!okToLeave()) return;
      useLevel.getState().loadLevel(level); // a fresh copy: saving it won't touch anyone else's
      setShared({ name: level.name });
    };
    void check();
    const onHash = () => void check();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (broken) {
    return createPortal(
      <div className="confirm-overlay" role="alertdialog" aria-modal="true" aria-label="Broken link" onClick={() => setBroken(false)}>
        <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
          <h2 className="confirm-title font-display">That link didn't work</h2>
          <p className="confirm-message">The level link looks broken or cut off. Ask for the link again, or for the level file instead.</p>
          <div className="confirm-actions"><button className="win-btn" autoFocus onClick={() => setBroken(false)}>OK</button></div>
        </div>
      </div>,
      document.body,
    );
  }
  if (!shared) return null;
  const close = () => setShared(null);
  return createPortal(
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="A shared level" onClick={close}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">A level for you</p>
        <h2 className="confirm-title font-display">{shared.name}</h2>
        <p className="confirm-message">Someone shared this level with you. Play it, or look around and change it. Save keeps your own copy in this browser.</p>
        <div className="confirm-actions">
          <button className="win-btn" onClick={(e) => { blur(e); close(); }}>Look around first</button>
          <button className="win-btn" data-primary autoFocus onClick={(e) => { blur(e); close(); startPlay(); }}>
            <Play size={15} aria-hidden fill="currentColor" /> Play it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
