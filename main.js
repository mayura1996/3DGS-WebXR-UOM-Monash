// ─── Gaussian Splat Viewer ─────────────────────────────────────
// Three.js + Spark + Third-Person Avatar with Animation
// ────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

// ── DOM refs ────────────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const overlay = document.getElementById("loading-overlay");
const controlsHint = document.getElementById("controls-hint");
const crosshair = document.getElementById("crosshair");

// ── Renderer ────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ── Scene ───────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);

// ── Lighting ────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
var dl = new THREE.DirectionalLight(0xffffff, 0.8);
dl.position.set(5, 10, 7);
scene.add(dl);

// ── Camera ──────────────────────────────────────────────────────
var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 5, 20);
camera.lookAt(0, 0, 0);

// ── Third-person settings ───────────────────────────────────────
var WALK_SPEED = 2.0;
var RUN_SPEED = 5.0;
var MOUSE_SENS = 0.003;
var PITCH_MIN = THREE.MathUtils.degToRad(-10);
var PITCH_MAX = THREE.MathUtils.degToRad(60);
var CAM_DISTANCE = 5.0;
var CAM_HEIGHT = 2.5;
var AVATAR_TURN_SPEED = 10.0;
var CROSSFADE_DUR = 0.3;

var cameraYaw = 0;
var cameraPitch = 0.3;
var pointerLocked = false;

var keysDown = {
    KeyW: false, KeyS: false, KeyA: false, KeyD: false,
    Space: false, ControlLeft: false, ControlRight: false,
    KeyQ: false, KeyE: false, KeyC: false,
    ShiftLeft: false, ShiftRight: false
};

// ── Pointer Lock ────────────────────────────────────────────────
canvas.addEventListener("click", function () {
    if (!pointerLocked) canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", function () {
    pointerLocked = (document.pointerLockElement === canvas);
    controlsHint.classList.toggle("hidden", pointerLocked);
    crosshair.classList.toggle("visible", pointerLocked);
});

document.addEventListener("mousemove", function (e) {
    if (!pointerLocked) return;
    cameraYaw -= e.movementX * MOUSE_SENS;
    cameraPitch += e.movementY * MOUSE_SENS;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch, PITCH_MIN, PITCH_MAX);
});

document.addEventListener("keydown", function (e) {
    if (e.code in keysDown) keysDown[e.code] = true;
    if (e.code === "Space" || e.code === "ControlLeft" || e.code === "ControlRight") {
        e.preventDefault();
    }
});
document.addEventListener("keyup", function (e) {
    if (e.code in keysDown) keysDown[e.code] = false;
});
canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

// ── Input direction helper ──────────────────────────────────────
function getInputDirection() {
    var dx = 0, dz = 0;
    if (keysDown.KeyW) dz -= 1;
    if (keysDown.KeyS) dz += 1;
    if (keysDown.KeyA) dx -= 1;
    if (keysDown.KeyD) dx += 1;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return null;
    dx /= len;
    dz /= len;
    // Rotate by camera yaw
    var s = Math.sin(cameraYaw);
    var c = Math.cos(cameraYaw);
    return { x: dx * c - dz * s, z: dx * s + dz * c };
}

// ═══════════════════════════════════════════════════════════════
//  GAUSSIAN SPLAT
// ═══════════════════════════════════════════════════════════════

var splatMesh = new SplatMesh({ url: "/Quadrangle.ply" });
// Flip 180 deg around X - PLY from COLMAP uses Y-down; Three.js uses Y-up
splatMesh.quaternion.set(1, 0, 0, 0);
scene.add(splatMesh);

console.log("SplatMesh created, loading...");

if (splatMesh.loaded) {
    splatMesh.loaded.then(function () {
        console.log("Splat loaded OK");
        doAutoFrame();
        overlay.classList.add("hidden");
    }).catch(function (err) {
        console.error("Splat load error:", err);
        document.getElementById("loading-text").textContent = "Error loading splat";
    });
} else {
    // Spark SplatMesh may not expose .loaded — poll until it has geometry
    console.log("splatMesh.loaded not available, polling for splat readiness...");
    var pollCount = 0;
    var pollTimer = setInterval(function () {
        pollCount++;
        var hasChildren = splatMesh.children && splatMesh.children.length > 0;
        var box = new THREE.Box3().setFromObject(splatMesh);
        var notEmpty = !box.isEmpty();
        console.log("Splat poll #" + pollCount + ": children=" + (splatMesh.children ? splatMesh.children.length : 0) + ", boxEmpty=" + box.isEmpty());
        if (notEmpty || pollCount >= 30) {
            clearInterval(pollTimer);
            if (notEmpty) {
                console.log("Splat ready!");
            } else {
                console.log("Splat poll timeout after 60s, proceeding anyway");
            }
            doAutoFrame();
            overlay.classList.add("hidden");
        }
    }, 2000);
}

function doAutoFrame() {
    console.log("doAutoFrame called");
    try {
        var box = new THREE.Box3().setFromObject(splatMesh);
        if (!box.isEmpty()) {
            var center = box.getCenter(new THREE.Vector3());
            var size = box.getSize(new THREE.Vector3());
            var maxDim = Math.max(size.x, size.y, size.z);
            var dist = maxDim * 1.5;
            console.log("Splat center:", center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2));
            console.log("Splat size:", size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));

            camera.position.set(center.x, center.y + dist * 0.4, center.z + dist);
            camera.lookAt(center);

            // Also move avatar there if loaded
            if (avatarObject) {
                avatarObject.position.set(center.x, center.y + avatarBaseY, center.z);
            }
            return;
        }
    } catch (e) {
        console.warn("autoFrame box failed:", e);
    }

    console.log("autoFrame fallback: camera at (0,5,20)");
    camera.position.set(0, 5, 20);
    camera.lookAt(0, 0, 0);
}

// ═══════════════════════════════════════════════════════════════
//  AVATAR (Mixamo FBX with skin)
// ═══════════════════════════════════════════════════════════════
// avatar.fbx (15MB) = base character mesh with skeleton
// Idle.fbx (1.6MB) = idle animation (without skin)
// Walk.fbx (15MB) = walk animation (with or without skin)

var avatarMixer = null;
var avatarObject = null;
var avatarBaseY = 0;
var avatarActions = {};
var currentAction = null;
var currentAnimName = "";

// Load avatar.fbx as the BASE character
var fbxLoader = new FBXLoader();
fbxLoader.load("/assets/avatar.fbx", function (fbx) {

    // Compute bounding box
    fbx.updateMatrixWorld(true);
    var totalBox = new THREE.Box3();
    var meshCount = 0;
    fbx.traverse(function (child) {
        if (child.isMesh && child.geometry) {
            meshCount++;
            child.geometry.computeBoundingBox();
            if (child.geometry.boundingBox) {
                var mb = child.geometry.boundingBox.clone();
                mb.applyMatrix4(child.matrixWorld);
                totalBox.union(mb);
            }
            var posAttr = child.geometry.getAttribute("position");
            console.log("  Mesh " + meshCount + ": " + child.name
                + ", verts=" + (posAttr ? posAttr.count : 0)
                + ", skinned=" + (child.isSkinnedMesh ? "YES" : "no"));
        }
    });
    var rawSize = totalBox.getSize(new THREE.Vector3());
    console.log("Avatar meshes: " + meshCount + ", size: "
        + rawSize.x.toFixed(1) + " x " + rawSize.y.toFixed(1) + " x " + rawSize.z.toFixed(1));

    // Scale: Mixamo is usually in cm (h ~170)
    var h = rawSize.y;
    if (h > 3) {
        fbx.scale.setScalar(1.8 / h);
        console.log("Avatar scaled: " + (1.8 / h).toFixed(4));
    } else if (h === 0) {
        fbx.scale.setScalar(0.01);
        console.log("Avatar bounds empty, using default 0.01 scale");
    }

    // Position feet at y=0
    fbx.updateMatrixWorld(true);
    var scaledBox = new THREE.Box3();
    fbx.traverse(function (child) {
        if (child.isMesh && child.geometry) {
            child.geometry.computeBoundingBox();
            if (child.geometry.boundingBox) {
                var mb2 = child.geometry.boundingBox.clone();
                mb2.applyMatrix4(child.matrixWorld);
                scaledBox.union(mb2);
            }
        }
    });
    if (!scaledBox.isEmpty()) {
        avatarBaseY = -scaledBox.min.y;
    }
    fbx.position.y = avatarBaseY;
    console.log("Avatar feet offset: " + avatarBaseY.toFixed(3));

    // Apply fallback material if no textures
    fbx.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (!child.material || !child.material.map) {
                child.material = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.6, metalness: 0.1 });
            }
        }
    });

    scene.add(fbx);
    avatarObject = fbx;
    console.log("Avatar added to scene (avatar.fbx)");

    // Log bones
    var bones = [];
    fbx.traverse(function (n) { if (n.isBone) bones.push(n.name); });
    console.log("Avatar bones (" + bones.length + "): " + bones.slice(0, 8).join(", "));

    // Create animation mixer
    avatarMixer = new THREE.AnimationMixer(fbx);

    // If avatar.fbx itself has embedded animations, register them
    if (fbx.animations && fbx.animations.length > 0) {
        console.log("avatar.fbx has " + fbx.animations.length + " embedded clip(s)");
        fbx.animations.forEach(function (clip, i) {
            console.log("  [" + i + "] " + clip.name + " (" + clip.duration.toFixed(2) + "s)");
        });
    }

    // Load external animation clips
    loadAnimClip("idle", "/assets/Idle.fbx");
    loadAnimClip("walk", "/assets/Walk.fbx");

    // Re-frame camera
    doAutoFrame();

}, function (progress) {
    if (progress.total) {
        console.log("Avatar loading: " + ((progress.loaded / progress.total) * 100).toFixed(0) + "%");
    }
}, function (err) {
    console.error("avatar.fbx load failed:", err);
});

// Load an external FBX just for its animation clip
var animsLoaded = 0;
var animsTotal = 2; // idle + walk
function loadAnimClip(name, path) {
    var loader = new FBXLoader();
    loader.load(path, function (animFbx) {
        if (animFbx.animations && animFbx.animations.length > 0) {
            var clip = animFbx.animations[0];
            console.log(name + " clip loaded: " + clip.name + " (" + clip.duration.toFixed(2) + "s, " + clip.tracks.length + " tracks)");
            avatarActions[name] = avatarMixer.clipAction(clip);
            console.log(name + " animation registered");
        } else {
            console.warn(path + " has no animation clips");
        }
        animsLoaded++;
        if (animsLoaded >= animsTotal) {
            // All animations loaded — start idle
            if (avatarActions.idle) {
                avatarActions.idle.play();
                currentAction = avatarActions.idle;
                currentAnimName = "idle";
                console.log("Starting idle animation");
            } else if (avatarActions.walk) {
                avatarActions.walk.play();
                currentAction = avatarActions.walk;
                currentAnimName = "walk";
                console.log("No idle clip, starting walk animation");
            }
        }
    }, undefined, function (err) {
        console.warn("Failed to load " + path + ":", err);
        animsLoaded++;
    });
}

// ── Crossfade ───────────────────────────────────────────────────
function fadeToAction(name) {
    if (name === currentAnimName) return;
    var next = avatarActions[name];
    if (!next) return;

    if (currentAction) currentAction.fadeOut(CROSSFADE_DUR);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(CROSSFADE_DUR).play();
    currentAction = next;
    currentAnimName = name;
}

// ═══════════════════════════════════════════════════════════════
//  RENDER LOOP
// ═══════════════════════════════════════════════════════════════

var clock = new THREE.Clock();

renderer.setAnimationLoop(function () {
    var dt = Math.min(clock.getDelta(), 0.1);

    // Move avatar
    var dir = getInputDirection();
    if (avatarObject && dir) {
        var spd = (keysDown.ShiftLeft || keysDown.ShiftRight) ? RUN_SPEED : WALK_SPEED;
        avatarObject.position.x += dir.x * spd * dt;
        avatarObject.position.z += dir.z * spd * dt;

        if (keysDown.Space || keysDown.KeyE) avatarObject.position.y += spd * dt;
        if (keysDown.ControlLeft || keysDown.ControlRight || keysDown.KeyQ || keysDown.KeyC) {
            avatarObject.position.y -= spd * dt;
        }

        // Face movement direction (smooth)
        var target = Math.atan2(dir.x, dir.z);
        var cur = avatarObject.rotation.y;
        var d = target - cur;
        d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        avatarObject.rotation.y += d * Math.min(1, AVATAR_TURN_SPEED * dt);
    }

    // Camera follow
    if (avatarObject) {
        var ox = CAM_DISTANCE * Math.sin(cameraYaw) * Math.cos(cameraPitch);
        var oz = CAM_DISTANCE * Math.cos(cameraYaw) * Math.cos(cameraPitch);
        var oy = CAM_HEIGHT + CAM_DISTANCE * Math.sin(cameraPitch);
        camera.position.set(avatarObject.position.x + ox, avatarObject.position.y + oy, avatarObject.position.z + oz);
        camera.lookAt(avatarObject.position.x, avatarObject.position.y + 1.4, avatarObject.position.z);
    }

    // Animation
    if (avatarMixer) {
        avatarMixer.update(dt);
        var moving = keysDown.KeyW || keysDown.KeyS || keysDown.KeyA || keysDown.KeyD;
        fadeToAction(moving ? "walk" : "idle");
    }

    renderer.render(scene, camera);
});

// ── Resize ──────────────────────────────────────────────────────
window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
