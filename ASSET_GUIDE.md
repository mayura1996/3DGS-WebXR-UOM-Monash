# Adding Heritage Assets

This guide explains how to add a new Gaussian splat heritage site to Heritage
Immersia.

## Asset Locations

```text
source-assets/
  NewSite.ply                 Original reconstruction; ignored by Git

public/
  NewSite-optimized.spz       Optimized model loaded by the website

public/images/
  new-site-card.jpg           Dashboard card image
```

Never place source files in `dist/`. Vite deletes and recreates that directory
during every production build.

Raw `.ply` and `.fbx` files are ignored by Git. Optimized `.spz` files and card
images are committed.

## 1. Add the Source PLY

Place the original reconstruction in `source-assets/`:

```text
source-assets/NewSite.ply
```

The optimizer supports binary little-endian Gaussian-splat PLY files, including
files larger than 2 GB.

## 2. Optimize the Model

Run the optimizer directly:

```powershell
node scripts/optimize-splat.mjs source-assets/NewSite.ply public/NewSite-optimized.spz 500000
```

The last number is the target splat count. `350000` loads faster; `500000`
retains more detail. Keep the generated file below GitHub's 100 MB file limit.

Optionally add a reusable command to `package.json`:

```json
"optimize:new-site": "node scripts/optimize-splat.mjs source-assets/NewSite.ply public/NewSite-optimized.spz 500000"
```

Then run:

```powershell
npm run optimize:new-site
```

## 3. Add a Card Image

Create a landscape image with a `3:2` aspect ratio. The current cards use
`1200 x 800` JPEG images at approximately 300-400 KB.

Save it as:

```text
public/images/new-site-card.jpg
```

Add its CSS background in `style.css`:

```css
.new-site-image {
  background:
    linear-gradient(0deg, rgba(0, 0, 0, 0.18), transparent),
    url("/images/new-site-card.jpg") center/cover;
}
```

Only use images the project owns or is licensed to redistribute. Record any
required attribution in the interface or repository documentation.

## 4. Add the Dashboard Card

Add an article inside `#site-grid` in `index.html`:

```html
<article class="site-card featured" data-continent="asia" data-country="china">
  <div class="card-image new-site-image">
    <span class="status available">WebXR ready</span>
  </div>
  <div class="card-content">
    <div class="card-meta"><span>China</span><span>Historic period</span></div>
    <h3>New Heritage Site</h3>
    <p>A short, accessible description of the site's significance.</p>
    <button class="explore-site" data-site="new-site" type="button">
      Enter experience <span>-></span>
    </button>
  </div>
</article>
```

The `data-site` value is the site's unique ID. Use the same ID in `main.js`,
`viewer.js`, and the direct URL.

Update the initial adventure count in `index.html`. The count updates
automatically after JavaScript loads.

Add new continent or country options to the filter dropdowns when necessary.

## 5. Register the Route

Add the site to the `sites` object in `main.js`:

```js
"new-site": { name: "New Heritage Site" }
```

The direct development URL will be:

```text
http://127.0.0.1:5173/?site=new-site
```

## 6. Configure the Viewer

Add a configuration to `SITE_CONFIGS` in `viewer.js`:

```js
"new-site": {
    splatUrl: "/NewSite-optimized.spz",
    avatarSpawn: [0, 0.1, 8],
    avatarScale: 1,
    transform: {
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        positionX: 0,
        positionY: 0,
        positionZ: 0
    }
}
```

- `avatarSpawn`: starting `[x, y, z]` position for the avatar.
- `avatarScale`: site-specific avatar size.
- `rotationX/Y/Z`: splat orientation in degrees.
- `scale`: uniform splat scale.
- `positionX/Y/Z`: splat world position.

These values are isolated per site.

## 7. Tune the Scene

Start Vite:

```powershell
npm run dev
```

Open the site's direct URL. Do not use VS Code Live Server on port `5500`;
bare npm imports and `public/` asset paths require Vite.

Use the on-screen **Splat** debug tab to adjust rotation, scale, and position.
Use **Frame Scene** to see the complete capture. Use the **Avatar** tab to tune
avatar scale.

Copy the final displayed values into the site's `SITE_CONFIGS` entry. The
**Reset** buttons then restore those saved site-specific defaults.

## 8. Validate

Run:

```powershell
npm run build
```

Check:

1. The card appears and filtering works.
2. Clicking the card loads the correct model.
3. The direct `?site=new-site` URL works.
4. The scene orientation, ground height, and avatar size look correct.
5. Mouse look, scroll zoom, WASD movement, and Reset still work.
6. No raw PLY or FBX files are staged for Git.

Useful Git check:

```powershell
git status --short
```

