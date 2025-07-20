# 3D Model Viewer Pro - Offline Industrial Viewer

## Project Overview
A professional offline 3D model viewer designed for large-scale industrial use. The application converts `.stl` files to `.glb` using Blender and renders them in Three.js within an Electron app. Fully offline and optimized for industrial touchscreen systems.

## Key Features
- Offline STL to GLB conversion (via Blender)
- Handles large 270MB+ industrial models
- Smooth rendering with Three.js
- Touchscreen and mouse support
- Preloaded sample models
- File picker for custom models
- Zoom, Pan, Rotate, Reset view
- Offline executable with no internet requirement

## Folder Structure

assets/ → Icons & UI assets
dist/ → Final packaged app (excluded from repo)
extras/ → Offline Node.js, VSCode installers (excluded)
models/ → STL / GLB files for viewing
node_modules/ → Installed via npm
resources/ → Bundled Blender for STL to GLB (excluded)
scripts/ → Python conversion scripts
src/ → Application source (index.html, main.js, preload.js)
temp/ → Temporary conversion files
package.json → App configuration


## Setup

npm install
npm run start


## Build for Windows

npm run build-win


## Note
Blender is bundled offline in `resources/` but excluded from GitHub. Ensure this exists for STL conversion to work.

## License
MIT