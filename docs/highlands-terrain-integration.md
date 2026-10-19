# Alpine Highlands board integration

The Weathered Peak chess assembly sits at `HIGHLANDS_BOARD_ELEVATION` in `main.js` (`-6.2` world units). The entire `boardGroup` moves together, so the 8×8 surface, invisible square hit targets, pieces, frame, and island rocks keep their relative alignment. The outer cliff mesh is part of the separate alpine scenery group, so it receives the same vertical offset explicitly. The Classic environment resets the board translation to zero.

When changing the elevation, keep the following in sync:

- The initial camera position and OrbitControls target use the default Highlands elevation.
- `resetCamera()` targets the active board elevation. Environment changes reset the camera after moving the group.
- Camera focus and capture effects use world-space piece positions. Piece movement, square coordinates, and hit targets remain local to `boardGroup`.
- The alpine valley terrain is a continuous grid with no opening below the island. Its height profile keeps the playing surface above ground while the lowered cliff skirt intersects the terrain around the island.

## Continuous cliff loop

The island cliff is one closed perimeter mesh with four sides and shared corner vertices. Each perimeter sample has several descending bands, with increasing outward offsets toward the base. This connects the adjacent faces at every corner and avoids the gaps left by four independent side strips. Keep the perimeter sample loop closed (`next = (j + 1) % cliffLoopSteps`) when changing its resolution.

The valley ground grid includes every cell beneath the island. If the cliff footprint or elevation changes, inspect the board from below and at a low three-quarter angle to confirm that the terrain intersects the lower skirt and no corner openings have returned. The river mesh was removed to keep the valley floor continuous and uncluttered around the embedded island.

## Mountain camera occlusion

The four distant mountain masses are tracked independently. During Highlands battle mode, nine rays are sampled from the camera to a 3×3 set of points across the playable board every 100 ms. Any mountain that intersects a sampled view ray fades smoothly to 12% opacity; it returns to opaque when the board is clear. A radial height estimate also detects when the camera enters a mountain mass, including cases where a ray starting inside the mesh would not hit its front face. Per-mountain cloned materials keep the fade isolated from other scenery. Keep the ray target points aligned with the board footprint if its dimensions change.
