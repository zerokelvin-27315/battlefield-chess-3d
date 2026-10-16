# Battlefield Chess 3D — Prototype 1

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
- Orbit/zoom/pan camera
- Animated movement and capture effects
- Separate two-character preview studio with animation selectors
- Toggleable camera-facing chess symbols
- Reset and undo

## Limitations

This is a JavaScript/Three.js prototype, not yet Rust/WASM. Characters are procedural articulated placeholders rather than rigged GLB models. Airstrikes, bullet cameras, polished weapon effects, audio, AI, and multiplayer are not yet implemented. Promotion defaults to queen. Special moves trigger board visual synchronization.
