# Quaternius rifleman fitting prototype

## Direction

Use the supplied desert/dark tactical character lineup as an appearance target.
Characters remain fully animated, with no miniature bases. First evaluate the
shared rifleman before developing heavy support, jetpack, medic, sniper, and
commander variants. This change is confined to Preview studio; battlefield
pieces, chess rules, board, terrain, and production deployment configuration
remain unchanged.

## Existing assets and evaluation

- `assets/reference/scene.gltf`: Quaternius superhero reference, 65-joint skin,
  14,318 triangles including eyes and eyebrows. Its body proportions and full
  articulated hierarchy are suitable for a first armor-fitting experiment.
- `assets/animations/UAL1_Standard.glb`: 43 clips on the matching joint hierarchy;
  clips play directly rather than through the separate soldier retargeter.
- `assets/soldier/scene.gltf`: separate 70-joint soldier, 15,432 triangles; retained
  in the existing three-rig diagnostic preview.
- The source animation library's CC0 license remains in assets/animations/License.txt.
  This prototype introduces no new third-party character assets.

## Implementation

`rifleman.js` clones the existing skinned character and keeps joint names and
source clips intact. Chest plates, straps, pouches, pack, shoulder guards,
forearm guards, thigh plates, kneepads, shin guards, boot plates, helmet and
goggles use rigid skin weights to the relevant existing bones. All armor is
merged into one skinned draw, avoiding a separate draw for each armor panel.

Armor vertices are authored in the unanimated character coordinate system and
bound to the same skeleton as the body. Inverse-bind matrices convert them to
bone-local coordinates during skinning. Do not pre-transform vertices into
bone-local coordinates as well; that would apply the inverse bind twice.

The body keeps its original skin weights. A bone-influence mask preserves the
source face texture while clothing receives desert/dark colors and feet receive
a boot color. Hair is hidden under the helmet. Prototype armor uses vertex
colors and material roughness; detailed cloth, camouflage, wear atlases and
normal maps remain future visual work.

The rifle attaches to the right hand. Its orientation is calibrated against the
native pistol-ready clip, with the bind pose restored before normalization.
An optional CCD support-hand layer runs only over pistol-ready/shoot clips.
This is a grip-fitting experiment, not a completed rifle animation set. Finger
curl, elbow constraints, and weapon/body intersections need visual review.

Preview studio opens with both palettes. Uncheck the rifleman option to return
to procedural previews or enable the original rig comparison. Idle, Walk,
weapon-ready, shooting, Death and T-pose are available, including shared pause
and scrub. Camera changes apply only inside this fitting preview.

Per prototype: 18,930 triangles and 10 visible mesh draws (including the rifle's
seven parts). Geometry consolidation of the rifle and sharing armor resources
between palette variants are follow-up optimization opportunities. Assets remain
lazy-loaded on entering preview; no new external model downloads are introduced.

## Validation and limits

- JavaScript syntax and whitespace checks passed.
- Loaded the actual reference glTF and UAL GLB with Three.js 0.169.0 in Node.
- Built the equipment and sampled six clips at 0, 0.4, 0.8, 1.2 and 2 seconds;
  rendered skinned vertex coordinates were finite.
- Offline mesh projections inspected for T-pose, Idle, Walk, ready and Death.
  This caught an incorrect initial rifle orientation, subsequently corrected.
- Browser validation is blocked: the cloud browser refused the local HTTP
  development URL; the local Chromium download also failed.
- WebGL shader compilation, full preview lifecycle, shading, close-up clipping,
  two-palette readability, and physical iPhone performance are not verified.
- Do not treat this first geometry/rigging pass as reference-quality final art
  or promote it to battlefield use before visual review.
