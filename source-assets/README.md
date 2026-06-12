# Source Assets

Keep original reconstruction files here, outside Vite's generated `dist` directory.

The Hongsheng optimizer expects:

```text
source-assets/HongshengTemple.ply
```

The Jianshui optimizer expects:

```text
source-assets/jiangshuiConfucius.ply
```

PLY files are ignored by Git because they can be very large. Run `npm run optimize:hongsheng`
or `npm run optimize:jianshui` after placing the relevant source model at the path above.

For the complete asset workflow, see [../ASSET_GUIDE.md](../ASSET_GUIDE.md).
