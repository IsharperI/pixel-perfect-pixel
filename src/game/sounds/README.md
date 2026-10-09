# Custom sounds

Every sound effect in the game is generated in code, so this folder can be empty.

To replace a sound with your own recording, drop an audio file in this folder
named after the sound it replaces:

| File name    | Plays when…                          |
| ------------ | ------------------------------------ |
| `jump.mp3`   | the player jumps                     |
| `land.mp3`   | the player lands (louder when harder)|
| `skid.mp3`   | the player skids on a hard turn      |
| `flap.mp3`   | each Float (Kirby) flap              |
| `exhale.mp3` | exhaling out of a Float              |

- `.mp3`, `.ogg`, `.wav` and `.m4a` all work.
- Files are picked up automatically; no code changes needed.
- Keep them short, and trim silence from the start so they feel instant.
- Delete a file to go back to the generated sound.
- Make sure you have the rights to any sound you add if you share the app publicly.
