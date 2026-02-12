# 3DGS-WebXR-UOM-Monash

A web viewer for 3D Gaussian Splats with an animated third-person avatar, built with [Three.js](https://threejs.org/) and [`@sparkjsdev/spark`](https://sparkjs.dev/).

This project is part of a research collaboration between the University of Melbourne and Monash University. It allows users to explore Gaussian Splat scenes using a Mixamo-rigged avatar with idle, walk, and run animations.

## Features

- **Gaussian Splat Rendering**: Visualizes large point clouds (`.ply`) using Spark.
- **Animated Avatar**: Third-person character controller with smooth blending between Idle, Walk, and Run states.
- **Optimized Loading**: Uses a lightweight "animation-only" loading strategy to keep the initial load fast.
    - Base Avatar Mesh (`avatar.fbx`): ~15MB (Geometry + Skeleton)
    - Animation Clips (`Idle.fbx`, `Walk.fbx`): ~1.5MB (Animation data only)
- **Responsive Camera**: Smooth orbiting and auto-follow camera system.
- **Auto-Framing**: Automatically centers the camera on the Splat or Avatar upon loading.

## Getting Started

1.  **Install dependencies**

    ```bash
    npm install
    ```

2.  **Add your assets**

    -   Place your Gaussian Splat file in `public/` (e.g., `public/Quadrangle.ply`).
    -   Ensure avatar assets are in `public/assets/`:
        -   `avatar.fbx` (Base mesh with skeleton)
        -   `Idle.fbx` (Idle animation clip)
        -   `Walk.fbx` (Walk animation clip)
    *Note: `.ply` and `.fbx` files are ignored by git to save space.*

3.  **Run the dev server**

    ```bash
    npm run dev
    ```

4.  **Open in Browser**
    Go to **http://localhost:5173**.

## Controls

| Key / Input | Action |
| :--- | :--- |
| **Mouse Click** | Focus canvas / Lock pointer (if enabled) |
| **Mouse Drag** | Orbit camera around avatar |
| **W / S** | Walk Forward / Backward |
| **A / D** | Turn Left / Right |
| **Shift + Move** | Run (Sprint) |
| **Space** | Move Up (Fly mode) |
| **Ctrl** | Move Down (Fly mode) |

## Project Structure

-   `main.js`: Core logic for Three.js scene, Avatar controller, Animation mixer, and Splat loading.
-   `index.html`: Main entry point with UI overlay.
-   `public/`: Static assets (Splats, FBX models).

## Tech Stack

-   **Three.js** – 3D Rendering Engine
-   **Spark** – High-performance Gaussian Splat renderer
-   **Vite** – Fast development server and bundler
