# Custom character model

The character is a built-in capsule unless you add your own model here.

**To use your own:** drop a `.glb` file into this folder. Name it `character.glb`
(any `.glb` works, but `character.glb` wins if there are several). It's picked up
automatically — no code changes needed. Delete it to go back to the capsule.

- It's scaled to the capsule's height (about 1.9 units) and centred, feet down.
- It should face **+Z** (the glTF standard; most exporters, Mixamo included, do this).
- **Animations:** if the file has clips, they play automatically by name:
  `idle`/`stand` when standing, `walk`, `run`/`sprint`/`jog` when moving (speeding
  up with you), `jump` going up, `fall` coming down. Names just need to contain
  those words, in any case.
- Use `.glb` (a single file). A `.gltf` with separate `.bin`/texture files won't load.
- You'll probably want **Floating Limbs** off (Animation settings) if your model
  has its own arms and legs, and the face/nose/eyes come from your model.
- Make sure you have the rights to any model you add if you share the app publicly.
