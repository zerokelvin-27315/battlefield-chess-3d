# Ragdoll tuning studio

Open `ragdoll-studio.html` on the preview deployment, or follow **Open ragdoll
tuning studio** below the rifleman motion controls. This is a separate page;
the battlefield does not import or run the physics engine.

## Workflow

1. Start with **Chest launch**, **Leg blast**, or **Collapse**.
2. Adjust individual impulses, body launch velocity, and body/floor settings.
3. Press **Simulate & preview**. Progress updates and Cancel remain responsive.
4. Replay, pause, scrub, change camera, or use quarter/half speed. The uniform
   selector switches palette without changing the simulation.
5. Expand **Copy or import a preset**, press **Copy settings**, and paste the
   complete JSON into chat. Download JSON is also available. If clipboard access
   is unavailable, select and copy the text directly from the JSON field.

Copy/download are disabled after editing until the changed settings have been
simulated. Export contains the exact settings used by the displayed result.
Import validates a pasted preset and runs it. Valid drafts are saved locally
in the browser; a restored edited draft needs simulation again before export.

## Controls and units

The physics rig is the full-size source character. Impulses use N·s, velocity
uses m/s, and hit offsets use meters in the selected body's local frame. Forces
and momentum use fixed world axes: +X sideways, +Y up, +Z forward. Negative Z
throws the character backward. The rendered character uses the same normalization
as the game's 1.10 m rifleman preview. Grid cells and reported travel use actual
one-unit chess squares at that scale; changing uniform does not affect scale.

Up to eight hits can target the head, chest, abdomen, pelvis, individual limbs,
both calves, or both feet. Calves/feet apply the specified impulse to each member
of the pair. Each hit has a start time, impulse duration, direction, and offset.
Off-center offsets add torque. Whole-body momentum adds the same velocity to each
body without adding more torque; launch duration spreads it across the impact
window. Hit times must be earlier than the animation's end.

Body/floor controls include gravity, friction, bounce, linear/angular damping,
joint flexibility, duration, rifle release, and release time. Self collision
remains disabled, as in the published authoring solver. Extreme valid settings
can deliberately produce exaggerated results; Copy exports those exact results.
Bodies collide with an infinite flat floor, not other chess pieces or terrain.

## Reproducible authoring

`ragdoll-simulation.js` is a dependency-injected generator shared by the browser
and Node baker. Both use Three.js 0.169.0 and Cannon-es 0.20.0, the same dressed
65-bone rifleman, fixed 360 Hz physics, 80 solver iterations, 30 Hz bone samples,
calibrated cone/twist references, mesh floor correction, and rifle release.
The browser yields between samples to let progress, cancellation, and rendering
continue. Playback uses the generated skeletal clip with a held final pose.

Presets use `format: "battlefield-ragdoll-preset"`, `version: 1`, an exact engine
identifier, a name, and validated settings. Keep these fields when pasting back.
The CLI rejects incompatible versions and out-of-range or non-finite values.

```sh
npm ci --prefix tools/ragdoll

# Reproduce the standard chest/blast clips (existing default workflow).
npm run bake --prefix tools/ragdoll

# Bake a copied preset; the main two animation clips are not overwritten.
npm run bake --prefix tools/ragdoll -- --preset /path/to/preset.json \
  --output /path/to/custom-ragdoll.json

# Integration checks: exact default parity and custom timed impacts.
node tools/ragdoll/check-studio.mjs
THREE_ROOT=tools/ragdoll/node_modules/three node tools/check-rifleman-skinning.mjs
```

Custom output contains a `DeathCustom` skeletal clip, diagnostics, and the original
validated preset. Promoting a custom sequence into the game's motion selector
remains a reviewed code change. Names are descriptive only, not executable code.

The studio loads pinned Three.js and Cannon-es modules from esm.sh, just as the
existing preview loads Three.js. No additional runtime dependency reaches the
ordinary battlefield or the existing animation preview page.

## Validation and texture repair

The browser flow was checked with desktop and 393 × 852 mobile layouts using
the actual geometry, textures, and pinned engine modules. Checks cover simulation,
multiple hits, palette rendering, held end pose, backwards scrubbing, clipboard
JSON, disabled export after edits, reload recovery, cancellation, and panel sizing.
An exported browser preset was also baked through the CLI.

Browser decoding exposed two pre-existing truncated Ranger textures. The original
`T_Ranger_BaseColor.png` and `T_Ranger_ORM.png` were restored from the official free
Quaternius Standard pack and resized with the existing importer's 1024 px Lanczos
and optimized PNG settings. Both now decode fully; geometry, UVs, and materials
are unchanged. Source: https://quaternius.itch.io/modular-character-outfits-fantasy
