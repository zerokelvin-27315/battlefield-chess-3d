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

## v0.9.1-preview: independent inverse-bind matrices

The first prototype's single-character vertex sampling missed a multi-instance
failure. Three.js 0.169.0 Skeleton.clone() passes the original boneInverses array
into the new Skeleton. SkeletonUtils.clone() therefore creates separate bones
but still shares inverse-bind data. normalizeRig() calls calculateInverses(),
which empties and repopulates that shared array. Creating the second/dark actor
then changed the bind transforms of the first/white actor and the cached template.
This explains why white visibly exploded while the last-created dark actor looked
intact.

cloneRig() now deep-copies the inverse-bind array and every Matrix4 immediately
after SkeletonUtils cloning. All preview clone paths use this helper, including
the source/reference/retargeted diagnostics, so switching previews cannot mutate
the cached templates either. Armor intentionally shares its own actor's body
skeleton. The existing normalization and height behavior is preserved.

Regression check (requires three@0.169.0 installed outside the repository):

```sh
THREE_ROOT=/path/to/node_modules/three node tools/check-rifleman-skinning.mjs
```

It loads the real production assets and builder, calls the actual normalizer,
creates both palette instances, verifies that constructing dark cannot change
white, and verifies that template inverse-bind values remain identical. Both
actors are sampled at five times across T-pose, Idle, Walk, ready, shooting and
Death, comparing their rendered body deformation in wrapper-local coordinates
and rejecting exploded bounds. Repeated rebuilds must also preserve the source.
The regression failed on the original code and passes with isolated bind data.
This validates the reported multi-instance failure; browser/iPhone visual checks
remain a separate requirement.

## v0.9.2-preview: Quaternius clothing foundation

Source: https://quaternius.itch.io/modular-character-outfits-fantasy

The official free Standard pack was downloaded and inspected. Its included
male Peasant and Ranger parts provide a tunic, pants, arms and modeled boots.
Selected parts are imported into `assets/clothing` with the original license
and author readme. Only glTF dependencies are included; texture dimensions are
limited to 1024 pixels for the mobile preview. The selected assets total 7.5 MiB.
Run `python3 tools/import-quaternius-clothing.py /path/to/Standard.zip` to reproduce.

All selected garments have the same 65 named joints as the existing character,
but some bind proportions differ (notably shoulder and hip widths). Garment
positions/normals are transferred through named source/target bind transforms
before rebinding to the existing rifleman's skeleton. The shared source garments
are never mutated. Each palette owns its fitted geometry and materials.

Following Quaternius's supplied readme, the covered full body is removed; only
the original head/neck remains. Geometry attributes are compacted so hidden body
vertices do not influence precise bounds. The garments supply torso, seat, leg,
arm and boot coverage. The previous box boot shells are omitted. Garment albedo
is converted to luminance in the material shader and tinted to each army palette,
preserving authored normal and roughness maps. This is an adapted fantasy
clothing foundation; tailoring it into the final tactical uniform remains art work.

The original `.12` normalization floor left an `.08` gap above the preview pads
at `.04`. Rifleman wrappers now move down `.075`, leaving a small clearance.
This changes only the fitting studio.

Validation: regression checks now sample *every skinned mesh*, including all
garments and armor, across both palettes and all six preview motions. Template
immutability, repeated rebuilds, finite vertex coordinates, equivalent local
deformation and bounded character extents pass. Offline front/rear geometry
projections were inspected for coverage. Actual browser shading and iPhone
performance remain unverified; previous cloud-browser verification timed out.

## v0.9.3-preview: fitted tactical silhouette

The chest carrier and limb pads use sampled curved shells with chamfered corners
instead of large rectangular blocks. The shell grid prevents a diagonal crease
that appears when bending only the corners of a triangulated flat plate.
The chest is thinner, pads are smaller, shoulder guards are domed, and solid
webbing follows the shoulder surface from chest to back instead of standing up.
The daypack is narrower and tapered, with two external pockets and compression
straps. Armor still merges into the existing single skinned equipment mesh.

The lower tunic vertices are lifted/tapered toward the belt, trouser cuffs extend
down the calf, and boot triangles above y=.295 in the fitted rest pose are removed.
Boot attributes and material groups are compacted together; the trousers overlap
the new opening. Skin weights and joint names remain unchanged. No source glTF,
texture, clip, or cached template is modified.

The regression includes boot retention/cuff overlap assertions plus all six
motion samples for both palettes. Front and rear offline geometry projections
were inspected. These checks cover geometry/deformation, not browser shading or
physical iPhone performance. Both module URLs carry the new preview version to
avoid retaining an older rifleman module in a mobile browser cache.

## v0.9.4-preview: death sequence choices

The shipped Standard animation library contains only one full death (`Death01`)
plus `Hit_Chest` and `Hit_Head`. `death-sequences.js` composes those existing CC0
tracks into four additional preview choices: chest shot, headshot, blast knockdown
and repeated hits. They are authored compositions, not extra downloaded Quaternius
death clips. Chest/head sequences lead with the appropriate reaction and blend
into the collapse; repeated hits chain three chest reactions before collapse.
Blast knockdown accelerates the native collapse and adds a small root lift/drift.
Source clips are never modified and generated clips are cached per library.

All five deaths play once and hold. Replay restarts the existing actions without
rebuilding the clothing/armor. The shared scrubber uses the selected clip duration;
seeking explicitly reactivates a clamped action, so users can scrub backwards
after the final pose. Original rig-comparison controls retain their 4-second range.

Validation samples both clothed characters in all ten available preview motions
at six times, including the end of each clip, and verifies unchanged source clips,
final-pose holding, backwards scrubbing, replay and the previous skinning checks.
No additional models or textures are loaded. These sequences currently apply to
the rifleman fitting studio, pending visual review before battlefield integration.
Browser rendering/iPhone review is still needed for the timing and blast motion.

## v0.9.5-preview: simulated chest launch and leg-sweep blast

Chest shot and blast now use actual offline Cannon-es 0.20.0 ragdoll simulations,
baked to `assets/animations/ragdoll-deaths.json`. Headshot and repeated hits keep
their prior UAL compositions. Browser playback loads only the roughly 218 KiB
JSON clips; the physics engine is not a browser dependency.

Reproduce with pinned authoring dependencies:

```sh
npm ci --prefix tools/ragdoll
npm run bake --prefix tools/ragdoll
THREE_ROOT=tools/ragdoll/node_modules/three node tools/check-rifleman-skinning.mjs
```

The authoring script loads the actual fitted rifleman, uses relaxed idle arms
with a balanced standing stance, and creates rigid bodies for pelvis, abdomen,
chest, head, upper/lower arms, hands, thighs, calves and feet. Cone/twist constraints
join them. Twist references are calibrated in a common initial world frame;
independent arbitrary local tangents introduced unwanted preloaded rotation.
The fixed 360 Hz solver uses 80 iterations. Joint anchor separation stays below
1 mm in these generated sequences. Floor contacts use friction and zero restitution;
body-to-body self collision is disabled for this authoring pass.

Chest impact applies an upward/backward impulse to the chest over 60 ms. The
torso leads, both feet leave the floor, the limbs trail, and the rig settles on
its back behind the original position. Blast applies backward impulses to calves
and feet; legs sweep behind the hips and the character pitches forward, finishing
face down. Colliders approximate the dressed body. Any residual mesh penetration
is corrected offline in the root track. The rifle releases after .16 s into its
own rigid body, avoiding a held barrel propping up the fallen character.

Body rotations are transformed into bone-local frames; all original bone lengths
are preserved. Static channels are collapsed to one key and keyframes are sampled
at 30 Hz. Replays and both palette instances use the same deterministic baked
motion. These clips do not dynamically react to other pieces or terrain at runtime.

Validation checks chest-leading motion, both feet lifted, landing behind the
starting position, face-up chest-shot finish, legs leading backward in the blast,
face-down blast finish, bounded joint error, and reproduction of simulated head,
torso and pelvis trajectories by actual Three.js playback. Both visible skinned
rigs settle on the floor within numerical tolerance. Existing palette/deformation,
holding, backward scrub and replay checks pass. Offline side-view mesh sequences
at 0, .2, .5, .9 and 3.6 seconds were inspected. Browser/iPhone visual review is
still required; the existing Cloudflare preview workflow is unchanged.

Engine references: https://github.com/pmndrs/cannon-es and
https://pmndrs.github.io/cannon-es/docs/classes/ConeTwistConstraint.html

### v0.9.8-preview: remove covered body surfaces

The garmented body's height crop accidentally retained the upper surfaces of
T-pose shoulders and arms. These hidden body triangles intersected the uniform
and appeared as pale patches at shoulders and elbows. The exposed body now also
requires head/neck skin influence and rejects arm influences. Neck vertices keep
their natural clavicle/spine blend inside the collar.
Original head and neck skin remain; garments provide the covered body surfaces. Skin
weights, bone transforms, garment meshes, armor, and animations are unchanged.
Regression checks reject retained limb skin in both palettes and confirm head
geometry is still present. The shared physics solver still reproduces the
published chest/blast clips exactly.

### v0.9.6-preview: two-square chest-shot momentum

The chest-shot simulation retains its upward/backward chest impulse and adds
4.9 m/s of backward velocity across the body over the same 60 ms impact window.
This carries the torso and trailing limbs backwards without adding excessive
rotational torque. The pelvis settles approximately two board squares behind
its starting point at the default 1.10 m preview height. One square is one world
unit; validation measures the baked displacement through the production rig
normalizer, with a tolerance of 0.1 square. Blast physics is unchanged.
