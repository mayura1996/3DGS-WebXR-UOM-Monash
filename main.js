// ─── Gaussian Splat Viewer ─────────────────────────────────────
// Three.js  +  Spark  +  FPS Fly Camera (Pointer Lock)
// ────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

// ── DOM references ──────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const overlay = document.getElementById("loading-overlay");
const controlsHint = document.getElementById("controls-hint");
const crosshair = document.getElementById("crosshair");

// ── Renderer ────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ── Scene ───────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);

// ── Lighting (needed for FBX materials) ─────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// ── Camera ──────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 2, 10);

// ═══════════════════════════════════════════════════════════════
//  FPS FLY CAMERA — Pointer Lock + WASD
// ═══════════════════════════════════════════════════════════════

// --- tuning knobs ---
const MOVE_SPEED = 6.0;   // units / sec
const FAST_MULTIPLIER = 3.0;   // when Shift is held
const MOUSE_SENS = 0.002; // radians per pixel of mouse delta
const PITCH_LIMIT = THREE.MathUtils.degToRad(89); // ±89° — nearly straight up/down

// --- state ---
let yaw = 0;    // rotation around world Y  (left/right)
let pitch = 0;    // rotation around local X   (up/down)
let pointerLocked = false;

const keysDown = {
  KeyW: false, KeyS: false, KeyA: false, KeyD: false,
  Space: false, ControlLeft: false, ControlRight: false,
  KeyQ: false, KeyE: false, KeyC: false,
  ShiftLeft: false, ShiftRight: false,
};

// Initialise yaw / pitch from the camera's current orientation so
// that auto-frame doesn't cause a jump.
function syncYawPitchFromCamera() {
  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  yaw = euler.y;
  pitch = euler.x;
}

// ── Pointer Lock ────────────────────────────────────────────────
canvas.addEventListener("click", () => {
  if (!pointerLocked) canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = (document.pointerLockElement === canvas);
  controlsHint.classList.toggle("hidden", pointerLocked);
  crosshair.classList.toggle("visible", pointerLocked);
});

// ── Mouse look ──────────────────────────────────────────────────
document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;

  yaw -= e.movementX * MOUSE_SENS;
  pitch -= e.movementY * MOUSE_SENS;

  // Clamp pitch to ±89° — wide range, NOT a tiny lock
  pitch = THREE.MathUtils.clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
});

// ── Keyboard ────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.code in keysDown) keysDown[e.code] = true;
  // Prevent default for Space / Ctrl to avoid scrolling / browser shortcuts
  if (e.code === "Space" || e.code === "ControlLeft" || e.code === "ControlRight") {
    e.preventDefault();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code in keysDown) keysDown[e.code] = false;
});

// Prevent context menu on canvas so right-click doesn't interrupt
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ── Movement helper (called every frame) ────────────────────────
const _moveDir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

function updateMovement(dt) {
  // Build a direction vector from held keys
  _moveDir.set(0, 0, 0);

  // Forward / back  (camera's forward projected onto XZ or full 3D)
  _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  // Right
  _right.set(1, 0, 0).applyQuaternion(camera.quaternion);

  if (keysDown.KeyW) _moveDir.add(_forward);
  if (keysDown.KeyS) _moveDir.sub(_forward);
  if (keysDown.KeyA) _moveDir.sub(_right);
  if (keysDown.KeyD) _moveDir.add(_right);

  // Vertical (world-up)
  if (keysDown.Space || keysDown.KeyE) _moveDir.y += 1;
  if (keysDown.ControlLeft || keysDown.ControlRight || keysDown.KeyQ || keysDown.KeyC) _moveDir.y -= 1;

  if (_moveDir.lengthSq() === 0) return;
  _moveDir.normalize();

  const speed = MOVE_SPEED * ((keysDown.ShiftLeft || keysDown.ShiftRight) ? FAST_MULTIPLIER : 1);
  camera.position.addScaledVector(_moveDir, speed * dt);
}

// ── Apply yaw+pitch to camera quaternion ────────────────────────
const _euler = new THREE.Euler(0, 0, 0, "YXZ");

function applyMouseLook() {
  _euler.set(pitch, yaw, 0, "YXZ");
  camera.quaternion.setFromEuler(_euler);
}

// ═══════════════════════════════════════════════════════════════
//  SPLAT LOADING
// ═══════════════════════════════════════════════════════════════

const splatMesh = new SplatMesh({ url: "/Quadrangle.ply" });
// Flip 180° around X — PLY from COLMAP uses Y-down; Three.js uses Y-up
splatMesh.quaternion.set(1, 0, 0, 0);
scene.add(splatMesh);

if (splatMesh.loaded) {
  splatMesh.loaded
    .then(() => {
      console.log("Splat loaded ✔");
      autoFrame();
      overlay.classList.add("hidden");
    })
    .catch((err) => {
      console.error("Failed to load splat:", err);
      document.getElementById("loading-text").textContent =
        "Error loading splat – see console.";
    });
} else {
  setTimeout(() => {
    autoFrame();
    overlay.classList.add("hidden");
  }, 4000);
}

// ═══════════════════════════════════════════════════════════════
//  AVATAR LOADING (FBX)
// ═══════════════════════════════════════════════════════════════

const fbxLoader = new FBXLoader();
fbxLoader.load(
  "/assets/avatar.fbx",
  (fbx) => {
    // -- Debug: log raw bounding box before any adjustments --
    const rawBox = new THREE.Box3().setFromObject(fbx);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    console.log("Avatar raw bounding box size:", rawSize.toArray().map(v => v.toFixed(2)));

    // -- Auto-scale: if the avatar is taller than ~3 units, shrink it --
    const targetHeight = 1.8; // ~human height in scene units
    const currentHeight = rawSize.y;
    if (currentHeight > 0) {
      const scaleFactor = targetHeight / currentHeight;
      fbx.scale.setScalar(scaleFactor);
      console.log(`Avatar scaled by ${scaleFactor.toFixed(4)} (raw height=${currentHeight.toFixed(2)})`);
    }

    // -- Position at origin, feet on the ground --
    // Recompute box after scaling
    const box = new THREE.Box3().setFromObject(fbx);
    const minY = box.min.y;
    fbx.position.y -= minY; // shift so feet touch y=0

    // -- Apply fallback material if textures are missing --
    fbx.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // If the mesh has no map (texture), apply a neutral material
        if (!child.material?.map) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xbbbbbb,
            roughness: 0.6,
            metalness: 0.1,
          });
        }
      }
    });

    scene.add(fbx);
    console.log("Avatar loaded ✔");
  },
  (progress) => {
    if (progress.total) {
      const pct = ((progress.loaded / progress.total) * 100).toFixed(0);
      console.log(`Avatar loading… ${pct}%`);
    }
  },
  (err) => {
    console.error("Failed to load avatar FBX:", err);
  }
);

// ── Auto-frame: position camera so the splat is visible ─────────
function autoFrame() {
  try {
    const box = new THREE.Box3().setFromObject(splatMesh);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim * 1.5;

      camera.position.copy(center).add(new THREE.Vector3(0, dist * 0.4, dist));
      camera.lookAt(center);
      syncYawPitchFromCamera();
      console.log(`Auto-framed: center=${center.toArray()}, dist=${dist.toFixed(2)}`);
      return;
    }
  } catch (_) { /* geometry might not be available */ }

  // Fallback
  camera.position.set(0, 5, 20);
  camera.lookAt(0, 0, 0);
  syncYawPitchFromCamera();
}

// ═══════════════════════════════════════════════════════════════
//  RENDER LOOP
// ═══════════════════════════════════════════════════════════════

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1); // cap to avoid huge jumps on tab-switch

  if (pointerLocked) {
    updateMovement(dt);
  }
  applyMouseLook();
  renderer.render(scene, camera);
});

// ── Responsive resize ───────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
