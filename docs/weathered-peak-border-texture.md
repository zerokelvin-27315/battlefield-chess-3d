# Weathered Peak border texture mapping

Implementation notes for the raised frame in `main.js` and atlas assets.

## Atlas layout

`assets/weathered-peak-border-atlas.png` is a 2048×1024 RGBA atlas:

- Left 1024×1024 cell: approved transparent frame artwork, resized with an 8px edge gutter.
- Right cell: generated horizontal stone side-face tile (1008×447) centered vertically, also with an 8px edge gutter.
- `assets/weathered-peak-side.png` is the generated side tile source used to rebuild the atlas.
- `python3 tools/build-weathered-peak-atlas.py` rebuilds the atlas deterministically from the cap and side assets.

The playable board keeps using `assets/weathered-peak-board.png`; it is a separate, approved surface texture. Do not fold the board surface into this atlas or modify it while adjusting the frame.

## Three.js `ExtrudeGeometry` groups

For Three.js `0.169.0`, the frame geometry is non-indexed (`geometry.index === null`):

- Material group `0`: bottom and top cap triangles.
- Material group `1`: extrusion side walls.

Material array entry `0` samples the atlas cap cell. Entry `1` samples the side cell. The group assignment matters: mapping entry `1` as if it were the cap puts texture on vertical sides while leaving the top plain.

Group `start` and `count` address vertices for this non-indexed geometry. Iterate vertices directly (`vertex = i`); do not call `geometry.index.getX(i)`. That previously threw before the scene could initialize.

## Cap UVs and orientation

Cap vertices are expressed in the original Shape x/y plane. Project them over the square cap cell, including its atlas offset and scale:

```js
u = capCell.u + ((position.x + borderHalf) / (2 * borderHalf)) * capCell.w
v = capCell.v + ((position.y + borderHalf) / (2 * borderHalf)) * capCell.h
```

The mesh then rotates by `-Math.PI / 2` around X. Source shape x becomes world X; source shape y becomes negative world Z; extrusion z becomes world height. The transparent center in the cap cell keeps the frame separate from all 64 playable squares.

## Side UVs and normals

Read `geometry.attributes.normal` for each group-1 vertex in local Shape/extrusion space. The side-wall normal points along local X or Y; use the perpendicular shape coordinate as the horizontal run:

- `abs(normal.x) > abs(normal.y)`: wall runs along local Y, so U comes from local Y.
- Otherwise: wall runs along local X, so U comes from local X.

Divide that coordinate by the side tile's world repeat length (2.25m). Set V from extrusion Z across the full beveled height (`depth + 2 * bevelThickness`). After rotation, V is world-up on all four sides. This keeps stones upright and consistent when the face normal changes around the frame.

The side material shader remaps the fractional UV into the atlas side cell. It mirrors alternate U tiles (`floor(U)` parity) so the generated texture can repeat seamlessly even though its left and right source edges differ. Keep the atlas side rectangle and UV constants synchronized with the atlas builder's cell positions.

## Asset validation and cache

Validate complete PNG decoding, not just the PNG header. A previously published border PNG had malformed IDAT data and showed only the plain rim. Use Pillow to call `Image.open(path).load()`, verify the cap is RGBA with transparent center and opaque frame, and verify the atlas decodes at 2048×1024. Bump the texture URL query after replacing an asset to avoid stale browser caches.
