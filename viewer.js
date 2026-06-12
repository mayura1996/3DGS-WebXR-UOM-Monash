// ─── Gaussian Splat Viewer ─────────────────────────────────────
// Three.js + Spark + First-Person / Third-Person Modes
// ────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const SITE_CONFIGS = {
    "candi-sewu": {
        splatUrl: "/Candi1-optimized.spz",
        avatarSpawn: [0, 0.1, 4],
        avatarScale: 1,
        transform: {
            rotationX: -180,
            rotationY: -22,
            rotationZ: 0,
            scale: 14.1,
            positionX: -12,
            positionY: 3.9,
            positionZ: 3.1
        }
    },
    "hongsheng-temple": {
        splatUrl: "/HongshengTemple-optimized.spz",
        avatarSpawn: [0, 0.1, 8],
        avatarScale: 0.6,
        transform: {
            rotationX: -180,
            rotationY: 0,
            rotationZ: 0,
            scale: 2.1,
            positionX: -19.1,
            positionY: 7,
            positionZ: 9.1
        }
    },
    "jianshui-confucius": {
        splatUrl: "/JianshuiConfucius-optimized.spz",
        avatarSpawn: [0, 0.1, 24],
        avatarScale: 1,
        transform: {
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scale: 0.07,
            positionX: 7.45,
            positionY: 98.47,
            positionZ: -12.53
        }
    }
};

const requestedSiteId = new URLSearchParams(window.location.search).get("site");
const ACTIVE_SITE = SITE_CONFIGS[requestedSiteId] || SITE_CONFIGS["candi-sewu"];

// ── DOM refs ────────────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const overlay = document.getElementById("loading-overlay");
const controlsHint = document.getElementById("controls-hint");
const crosshair = document.getElementById("crosshair");
const viewToggleBtn = document.getElementById("view-toggle");

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

// ── Movement settings ───────────────────────────────────────────
var WALK_SPEED = 4.0;
var RUN_SPEED = 10.0;
var MOUSE_SENS = 0.003;

var CAM_DISTANCE = 4.5;
var CAM_HEIGHT = 2.0;
var AVATAR_TURN_SPEED = 10.0;
var CROSSFADE_DUR = 0.3;
var AVATAR_HEIGHT = 1.65;
var AVATAR_SPAWN = new THREE.Vector3(...ACTIVE_SITE.avatarSpawn);

var cameraYaw = 0;
var cameraPitch = -0.08;
var pointerLocked = false;

// ── View mode state ─────────────────────────────────────────────
var firstPerson = false;   // start in third-person

viewToggleBtn.addEventListener("click", function () {
    firstPerson = !firstPerson;
    viewToggleBtn.textContent = firstPerson ? "Switch to Third Person" : "Switch to First Person";
    if (avatarObject) avatarObject.visible = !firstPerson;
    if (!firstPerson) {
        cameraPitch = -0.08;
        positionThirdPersonCamera();
    }
});
// Start with avatar hidden
viewToggleBtn.textContent = "Switch to First Person";

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
    cameraPitch = THREE.MathUtils.clamp(
        cameraPitch,
        THREE.MathUtils.degToRad(-89),
        THREE.MathUtils.degToRad(89)
    );
});

document.addEventListener("wheel", function (e) {
    if (e.target.closest && e.target.closest("#splat-debug")) return;
    e.preventDefault();

    var zoomFactor = Math.exp(e.deltaY * 0.001);
    if (!firstPerson) {
        CAM_DISTANCE = THREE.MathUtils.clamp(CAM_DISTANCE * zoomFactor, 1.5, 30);
        positionThirdPersonCamera();
        return;
    }

    var moveDistance = THREE.MathUtils.clamp(Math.abs(e.deltaY) * 0.012, 0.25, 4);
    var viewDirection = new THREE.Vector3();
    camera.getWorldDirection(viewDirection);
    camera.position.addScaledVector(viewDirection, e.deltaY < 0 ? moveDistance : -moveDistance);
}, { passive: false });

document.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("#splat-debug")) return;
    if (e.code in keysDown) keysDown[e.code] = true;
    if (e.code === "Space" || e.code === "ControlLeft" || e.code === "ControlRight") {
        e.preventDefault();
    }
});
document.addEventListener("keyup", function (e) {
    if (e.code in keysDown) keysDown[e.code] = false;
});
canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

function aimCameraAt(target) {
    var direction = target.clone().sub(camera.position).normalize();
    cameraYaw = Math.atan2(direction.x, -direction.z);
    cameraPitch = Math.asin(THREE.MathUtils.clamp(-direction.y, -1, 1));
    camera.lookAt(target);
}

function positionThirdPersonCamera() {
    var target = avatarObject ? avatarObject.position : AVATAR_SPAWN;
    var ox = CAM_DISTANCE * Math.sin(cameraYaw) * Math.cos(cameraPitch);
    var oz = CAM_DISTANCE * Math.cos(cameraYaw) * Math.cos(cameraPitch);
    var oy = CAM_HEIGHT + CAM_DISTANCE * Math.sin(cameraPitch);
    camera.position.set(target.x + ox, target.y + oy, target.z + oz);
    camera.lookAt(target.x, target.y + 1.35, target.z);
}

// ── Input direction helper ──────────────────────────────────────
function getInputDirection() {
    var forwardInput = 0;
    var rightInput = 0;
    if (keysDown.KeyW) forwardInput += 1;
    if (keysDown.KeyS) forwardInput -= 1;
    if (keysDown.KeyA) rightInput -= 1;
    if (keysDown.KeyD) rightInput += 1;

    var len = Math.sqrt(forwardInput * forwardInput + rightInput * rightInput);
    if (len < 0.01) return null;
    forwardInput /= len;
    rightInput /= len;

    // Camera forward points from its orbit position toward the avatar.
    var forwardX = -Math.sin(cameraYaw);
    var forwardZ = -Math.cos(cameraYaw);
    var rightX = Math.cos(cameraYaw);
    var rightZ = -Math.sin(cameraYaw);

    return {
        x: forwardX * forwardInput + rightX * rightInput,
        z: forwardZ * forwardInput + rightZ * rightInput
    };
}

// ═══════════════════════════════════════════════════════════════
//  GAUSSIAN SPLAT
// ═══════════════════════════════════════════════════════════════

var splatMesh = new SplatMesh({ url: ACTIVE_SITE.splatUrl });
splatMesh.rotation.set(
    THREE.MathUtils.degToRad(ACTIVE_SITE.transform.rotationX),
    THREE.MathUtils.degToRad(ACTIVE_SITE.transform.rotationY),
    THREE.MathUtils.degToRad(ACTIVE_SITE.transform.rotationZ)
);
splatMesh.scale.setScalar(ACTIVE_SITE.transform.scale);
splatMesh.position.set(
    ACTIVE_SITE.transform.positionX,
    ACTIVE_SITE.transform.positionY,
    ACTIVE_SITE.transform.positionZ
);
scene.add(splatMesh);

var DEFAULT_SPLAT_TRANSFORM = ACTIVE_SITE.transform;

var transformControls = {
    rotationX: document.getElementById("rotation-x"),
    rotationY: document.getElementById("rotation-y"),
    rotationZ: document.getElementById("rotation-z"),
    scale: document.getElementById("scale"),
    positionX: document.getElementById("position-x"),
    positionY: document.getElementById("position-y"),
    positionZ: document.getElementById("position-z")
};

function setTransformControl(name, value) {
    var input = transformControls[name];
    input.value = value;
    var output = document.getElementById(input.id + "-value");
    var isRotation = name.startsWith("rotation");
    var numericValue = Number(value);
    var decimals = name === "scale" && Math.abs(numericValue) < 1 ? 2 : name === "scale" ? 1 : 2;
    output.value = isRotation ? Math.round(numericValue) + "°" : numericValue.toFixed(decimals);
}

function applySplatTransform() {
    splatMesh.rotation.set(
        THREE.MathUtils.degToRad(Number(transformControls.rotationX.value)),
        THREE.MathUtils.degToRad(Number(transformControls.rotationY.value)),
        THREE.MathUtils.degToRad(Number(transformControls.rotationZ.value))
    );
    splatMesh.scale.setScalar(Number(transformControls.scale.value));
    splatMesh.position.set(
        Number(transformControls.positionX.value),
        Number(transformControls.positionY.value),
        Number(transformControls.positionZ.value)
    );

    Object.entries(transformControls).forEach(function ([name, input]) {
        setTransformControl(name, input.value);
    });
}

Object.entries(DEFAULT_SPLAT_TRANSFORM).forEach(function ([name, value]) {
    setTransformControl(name, value);
});
Object.values(transformControls).forEach(function (input) {
    input.addEventListener("input", applySplatTransform);
});

document.getElementById("reset-transform").addEventListener("click", function () {
    Object.entries(DEFAULT_SPLAT_TRANSFORM).forEach(function ([name, value]) {
        setTransformControl(name, value);
    });
    applySplatTransform();
});

document.getElementById("frame-splat").addEventListener("click", function () {
    firstPerson = true;
    viewToggleBtn.textContent = "Switch to Third Person";
    if (avatarObject) avatarObject.visible = false;
    frameSplatOverview();
});

document.querySelectorAll(".debug-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
        document.querySelectorAll(".debug-tab").forEach(function (item) {
            item.classList.toggle("active", item === tab);
        });
        document.querySelectorAll(".debug-panel").forEach(function (panel) {
            panel.classList.toggle("active", panel.id === tab.dataset.panel);
        });
    });
});

console.log("SplatMesh created, loading...");

var splatReady = splatMesh.initialized || splatMesh.loaded;
if (splatReady) {
    splatReady.then(function () {
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
    if (!firstPerson) {
        if (avatarObject) {
            avatarObject.position.set(AVATAR_SPAWN.x, AVATAR_SPAWN.y + avatarBaseY, AVATAR_SPAWN.z);
            avatarObject.visible = true;
        }
        positionThirdPersonCamera();
        return;
    }

    try {
        var box = new THREE.Box3().setFromObject(splatMesh);
        if (!box.isEmpty()) {
            var center = box.getCenter(new THREE.Vector3());
            var size = box.getSize(new THREE.Vector3());
            var maxDim = Math.max(size.x, size.y, size.z);
            var dist = maxDim * 1.1;
            console.log("Splat center:", center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2));
            console.log("Splat size:", size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));

            camera.position.set(center.x, center.y + dist * 0.4, center.z + dist);
            aimCameraAt(center);

            // Also move avatar there if loaded
            if (avatarObject) {
                avatarObject.position.set(AVATAR_SPAWN.x, AVATAR_SPAWN.y + avatarBaseY, AVATAR_SPAWN.z);
                avatarObject.visible = !firstPerson;  // respect current mode
            }
            return;
        }
    } catch (e) {
        console.warn("autoFrame box failed:", e);
    }

    console.log("autoFrame fallback: camera at (0,5,20)");
    camera.position.set(0, 5, 20);
    aimCameraAt(new THREE.Vector3(0, 0, 0));
}

function frameSplatOverview() {
    var box = new THREE.Box3().setFromObject(splatMesh);
    if (box.isEmpty()) return;

    var center = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(center.x, center.y + maxDim * 0.35, center.z + maxDim * 1.25);
    aimCameraAt(center);
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
var avatarBaseScale = 1;
var avatarBaseFeetOffset = 0;
var avatarActions = {};
var currentAction = null;
var currentAnimName = "";

var avatarScaleControl = document.getElementById("avatar-scale");
var avatarScaleValue = document.getElementById("avatar-scale-value");
avatarScaleControl.value = ACTIVE_SITE.avatarScale;

function applyAvatarScale() {
    var multiplier = Number(avatarScaleControl.value);
    avatarScaleValue.value = multiplier.toFixed(2) + "×";
    if (!avatarObject) return;

    var feetY = avatarObject.position.y - avatarBaseY;
    avatarObject.scale.setScalar(avatarBaseScale * multiplier);
    avatarBaseY = avatarBaseFeetOffset * multiplier;
    avatarObject.position.y = feetY + avatarBaseY;
}

avatarScaleControl.addEventListener("input", applyAvatarScale);
document.getElementById("reset-avatar").addEventListener("click", function () {
    avatarScaleControl.value = ACTIVE_SITE.avatarScale;
    applyAvatarScale();
});

applyAvatarScale();

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
        fbx.scale.setScalar(AVATAR_HEIGHT / h);
        console.log("Avatar scaled: " + (AVATAR_HEIGHT / h).toFixed(4));
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
    fbx.position.set(AVATAR_SPAWN.x, AVATAR_SPAWN.y + avatarBaseY, AVATAR_SPAWN.z);
    avatarBaseScale = fbx.scale.x;
    avatarBaseFeetOffset = avatarBaseY;
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
    applyAvatarScale();
    avatarObject.visible = !firstPerson;  // hide in first-person mode
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
    var dir = getInputDirection();
    var spd = (keysDown.ShiftLeft || keysDown.ShiftRight) ? RUN_SPEED : WALK_SPEED;

    if (firstPerson) {
        // ── First-Person mode ──────────────────────────────────
        // Move camera directly
        if (dir) {
            camera.position.x += dir.x * spd * dt;
            camera.position.z += dir.z * spd * dt;
        }
        // Vertical movement: E = up, Q = down
        if (keysDown.Space || keysDown.KeyE) camera.position.y += spd * dt;
        if (keysDown.ControlLeft || keysDown.ControlRight || keysDown.KeyQ || keysDown.KeyC) {
            camera.position.y -= spd * dt;
        }

        // Look direction from yaw/pitch
        var lookX = Math.sin(cameraYaw) * Math.cos(cameraPitch);
        var lookY = -Math.sin(cameraPitch);
        var lookZ = -Math.cos(cameraYaw) * Math.cos(cameraPitch);
        camera.lookAt(
            camera.position.x + lookX,
            camera.position.y + lookY,
            camera.position.z + lookZ
        );
    } else {
        // ── Third-Person mode ─────────────────────────────────
        // Move avatar
        if (avatarObject && dir) {
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
            positionThirdPersonCamera();
        }
    }

    // Animation (only in third-person)
    if (!firstPerson && avatarMixer) {
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
