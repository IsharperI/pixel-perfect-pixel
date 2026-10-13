/**
 * Optional custom character model. Drop a .glb file into src/game/models/ and it
 * replaces the capsule body (see src/game/models/README.md). Found automatically
 * at build time; if there's no file, the built-in capsule is used.
 */
const FILES = import.meta.glob("./models/*.glb", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const entries = Object.entries(FILES).sort(([a], [b]) => a.localeCompare(b));
// Prefer one named character.glb; otherwise the first .glb found
const chosen = entries.find(([p]) => /\/character\.glb$/i.test(p)) ?? entries[0];

export const CUSTOM_MODEL_URL: string | null = chosen ? chosen[1] : null;
export const CUSTOM_MODEL_NAME: string | null = chosen ? chosen[0].split("/").pop()! : null;

/** What the character is doing, for picking an animation clip from the model. */
export type AnimState = "idle" | "walk" | "run" | "jump" | "fall";
