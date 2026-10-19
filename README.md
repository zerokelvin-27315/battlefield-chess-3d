# Battlefield Chess 3D — Prototype 1 (v0.7.7)

Playable 3D chess with procedural military characters, rocky terrain, a character animation preview studio, and cinematic capture sequences.

## Run locally

```sh
python3 -m http.server 8080
```

Open http://localhost:8080 in a modern browser. Three.js and chess.js load from esm.sh, so an internet connection is required.

## Deploy

Cloudflare Pages: connect this GitHub repository, select branch `main`, framework preset `None`, no build command, and root (`/`) as output directory.

## Features

- Standard chess rules through chess.js
- Six military-themed procedural characters in two army colors
- Select a piece and legal destination
- Orbit/zoom camera
- Animated movement and capture effects, including a tile-by-tile Rook napalm lane and a Knight ground-burst backward flip
- Preview Dying state drives the realistic soldier for custom Rook and Knight deaths and follows the selected attacker role for the Rook napalm and Knight grenade deaths
- Three-way animation diagnostics: UAL source skeleton, Quaternius reference character, and retargeted military soldier
- Idle, Walk, and Death play directly on the two Quaternius rigs and retarget onto the soldier
- Independent mesh and skeleton visibility for all three rigs, bone labels, joint XYZ axes, pause, and shared scrub time
- Comparison rigs are normalized to 1.1 m by default and normalized against the skinned vertices actually rendered, then inverse-bind matrices are refreshed so the selected height is enforced after skinning
- Preview camera resets face the three-rig lineup head-on; source, reference, and soldier align with the left pad, center, and right pad respectively
- The retargeted soldier’s Death pose is grounded from its live skinned-vertex bounds to keep it from hovering above the preview platform
- Bone mapping report with rest-pose quaternion and hierarchy differences; live local Euler snapshots for pelvis, spine, neck, head, arm, and leg joints
- Soldier's original embedded animation remains available as Celebration Dance
- Toggleable camera-facing chess symbols, reset, and undo

## Rig and retarget notes

`assets/reference/scene.gltf` and `assets/animations/UAL1_Standard.glb` contain the same 65 joint names and parent hierarchy. The source library provides 195 tracks per clip: rotation, translation, and scale for each joint. The reference character plays those clips directly. The preview loads the three Quaternius clips Idle_Loop, Walk_Loop, and Death01.

The soldier has 70 joints. The 65 Quaternius joints are mapped by anatomical name, including the finger chains, root, and toe ends. The retargeter converts each animated quaternion delta from its source parent rest frame into the soldier's corresponding parent frame, then applies that delta to the soldier's own rest rotation. Translation deltas are transformed between parent frames and scaled to account for the two model sizes; scale tracks preserve the soldier's bind scale. The report calls out inserted finger-base joints and other parent-path differences.

This comparison is intended to help validate retargeting in the browser. The soldier's different rest pose and hierarchy can still produce imperfect motion; inspect Idle, Walk, and Death with the shared scrubber and overlays before treating the retarget as final. No visual validation is claimed by the source-only checks.

## Limitations

This is a JavaScript/Three.js prototype, not yet Rust/WASM. Battlefield pieces remain procedural. Airstrikes, bullet cameras, polished weapon effects, audio, AI, and multiplayer are not implemented. Promotion defaults to queen. Special moves trigger board visual synchronization.
