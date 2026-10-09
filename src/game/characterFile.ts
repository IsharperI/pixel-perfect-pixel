import type { SettingValues } from "./settings";

/**
 * Character files: the format used for Export/Import files and the browser
 * Save/Load slot. Tagged with a format name and version so future versions of
 * this app (or the Level Builder) can recognise them and upgrade old ones.
 */
export const CHARACTER_FORMAT = "platformer-toolkit-3d/character";
export const CHARACTER_VERSION = 1;

export type CharacterFile = {
  format: typeof CHARACTER_FORMAT;
  version: number;
  savedAt: string;
  values: SettingValues;
};

export function toCharacterFile(values: SettingValues): CharacterFile {
  return { format: CHARACTER_FORMAT, version: CHARACTER_VERSION, savedAt: new Date().toISOString(), values: { ...values } };
}

/**
 * Pull the settings out of a parsed character file. Also accepts the older
 * format (a bare object of settings, exported before files were tagged).
 * Returns null if it doesn't look like character settings at all.
 */
export function readCharacterFile(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  if (obj["format"] === CHARACTER_FORMAT) {
    const v = obj["values"];
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  }
  if ("format" in obj) return null; // some other kind of file
  return obj; // legacy: plain settings object
}

// ---- Browser save slot (Save / Load buttons) --------------------------------

const SLOT_KEY = "platformer-toolkit-3d.saved-character";

/** Save to this browser. Returns false if storage is unavailable (e.g. private browsing). */
export function saveToBrowser(values: SettingValues): boolean {
  try {
    window.localStorage.setItem(SLOT_KEY, JSON.stringify(toCharacterFile(values)));
    return true;
  } catch {
    return false;
  }
}

/** The saved character, or null if nothing has been saved (or it can't be read). */
export function loadFromBrowser(): { values: Record<string, unknown>; savedAt: string | null } | null {
  try {
    const raw = window.localStorage.getItem(SLOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown };
    const values = readCharacterFile(parsed);
    if (!values) return null;
    return { values, savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null };
  } catch {
    return null;
  }
}
