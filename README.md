# 3DGS-WebXR-UOM-Monash

A simple web viewer for 3D Gaussian Splats, built with [Three.js](https://threejs.org/) and [Spark](https://sparkjs.dev/).

This is part of a collaboration between the University of Melbourne and Monash University.

## Getting started

1. **Install dependencies**

   ```
   npm install
   ```

2. **Place your `.ply` file**

   Drop your Gaussian Splat `.ply` file into the `public/` folder (e.g. `public/Quadrangle.ply`).

3. **Run the dev server**

   ```
   npm run dev
   ```

4. Open **http://localhost:5173** in your browser.

## Controls

| Key | Action |
|---|---|
| Click canvas | Lock pointer (enter fly mode) |
| Mouse | Look around |
| W / S | Move forward / back |
| A / D | Strafe left / right |
| Space | Fly up |
| Ctrl | Fly down |
| Shift | Move faster |
| Esc | Unlock pointer |

## Tech stack

- **Three.js** – 3D scene, camera, renderer
- **Spark** – Gaussian Splat rendering
- **Vite** – Dev server and bundler
