# Weathered Peak border texture mapping

Notes for future changes to the raised border in `main.js`.

## Three.js `ExtrudeGeometry` groups

For the current Three.js version (`0.169.0`), the raised frame uses an `ExtrudeGeometry` with an outer contour and an inner hole. Its geometry is **non-indexed** (`geometry.index === null`), and its material groups are:

- Material group `0`: bottom and top cap triangles.
- Material group `1`: extrusion side walls.

The border image belongs on the top caps, so the mapped material must be material-array entry `0`. Keep the vertical side walls on entry `1` with a plain weathered stone material. Mapping entry `1` puts the texture on the sides and leaves the visible top surface plain.

Group `start` and `count` values address vertices for this non-indexed geometry. Iterate vertices directly (`vertex = i`); do not call `geometry.index.getX(i)` because there is no index buffer. This previously threw during startup and hid the whole scene.

## Cap UV projection

`ExtrudeGeometry` cap vertices are expressed in the original `Shape` x/y plane. Before the mesh rotation, project those coordinates across the whole square border artwork:

```js
u = (position.x + borderHalf) / (2 * borderHalf)
v = (position.y + borderHalf) / (2 * borderHalf)
```

Apply the projection only to group `0`, then rotate the mesh onto the board with `rotation.x = -Math.PI / 2`. The artwork is a square frame with a transparent center; its outer ring aligns with the geometry ring. Keep its center transparent so it cannot cover the playable 8×8 surface.

## Asset and cache checks

The border PNG must be a valid RGBA PNG, not just a file with a PNG header. A prior generated file had a valid header but malformed IDAT chunk data, so the texture failed to decode while the rest of the scene rendered. Validate the complete file with Pillow (`Image.open(...).load()`), and check that alpha ranges from 0 in the center to 255 on the stone frame. Keep the asset reasonably sized (the repaired version is 1024×1024, about 557 KB).

Add a version query to the border texture URL when replacing the PNG so browsers do not keep a cached broken copy. The approved `weathered-peak-board.png` is separate and should remain unchanged.
