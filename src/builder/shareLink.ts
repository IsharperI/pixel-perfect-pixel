/**
 * Share a level as a link. The whole level is squeezed (with the browser's built-in
 * compression) into the part of the address after the "#", so nothing is stored
 * anywhere and nothing is sent to a server:
 *   https://…/builder#level=1.<compressed level file>
 */
import { readLevelFile, toLevelFile, type LevelData } from "./levelFile";

const PREFIX = "#level=1.";

/** Links longer than this may get cut off by some chat apps and text messages. */
export const LONG_LINK = 2000;

const toBase64Url = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64Url = (text: string) => {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Response(bytes as BodyInit).body!.pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** The level as the code that goes after "#level=1." (no best time: that's yours, not theirs). */
export async function encodeLevel(level: LevelData): Promise<string> {
  const { format, version, name, rules, blocks } = toLevelFile({ ...level, bestTime: null });
  const json = JSON.stringify({ format, version, name, rules, blocks });
  return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw")));
}

/** Read a level back from its code. Null if the code is broken or incomplete. */
export async function decodeLevel(code: string): Promise<LevelData | null> {
  try {
    const bytes = await pipe(fromBase64Url(code), new DecompressionStream("deflate-raw"));
    return readLevelFile(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

/** A full link that opens this level in the Level Builder. */
export async function shareLink(level: LevelData, base = `${window.location.origin}/builder`): Promise<string> {
  return `${base}${PREFIX}${await encodeLevel(level)}`;
}

/** The level code in an address's "#…" part, if it has one. */
export function codeFromHash(hash: string): string | null {
  return hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null;
}
