# Alpine Highlands board integration

The Weathered Peak chess assembly sits at `HIGHLANDS_BOARD_ELEVATION` in `main.js` (`-4.8` world units). The entire `boardGroup` moves together, so the 8×8 surface, invisible square hit targets, pieces, frame, and island rocks keep their relative alignment. The outer cliff mesh is part of the separate alpine scenery group, so it receives the same vertical offset explicitly. The Classic environment resets the board translation to zero.

When changing the elevation, keep the following in sync:

- The initial camera position and OrbitControls target use the default Highlands elevation.
- `resetCamera()` targets the active board elevation. Environment changes reset the camera after moving the group.
- Camera focus and capture effects use world-space piece positions. Piece movement, square coordinates, and hit targets remain local to `boardGroup`.
- The alpine valley terrain leaves a 5.3-unit square opening. Terrain triangles outside that opening overlap the lower cliff skirt; the playing surface remains above the terrain.

## Continuous cliff loop

The island cliff is one closed perimeter mesh with four sides and shared corner vertices. Each perimeter sample has several descending bands, with increasing outward offsets toward the base. This connects the adjacent faces at every corner and avoids the gaps left by four independent side strips. Keep the perimeter sample loop closed (`next = (j + 1) % cliffLoopSteps`) when changing its resolution.

The valley ground is a grid with cells inside the central opening omitted. If the cliff footprint or elevation changes, inspect the board from below and at a low three-quarter angle to confirm that the terrain intersects the lower skirt and no corner openings have returned.
