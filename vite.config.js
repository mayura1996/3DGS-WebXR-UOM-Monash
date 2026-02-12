import { defineConfig } from "vite";

export default defineConfig({
    // Serve files from public/ at the root (default behaviour).
    // The Quadrangle.ply file lives in public/ and will be served as /Quadrangle.ply.
    server: {
        open: true,   // auto-open browser on `npm run dev`
        port: 5173,
    },
});
