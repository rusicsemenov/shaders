import './style.css';
import * as THREE from 'three';

const N = 500;
const RADIUS = 150;
const SPHERE_RADIUS = 3.5;
const TRANSITION_DURATION = 4.0;
const HOLD_DURATION = 1.5;

function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Shape generators ─────────────────────────────────────────────────────────

function generateCircle(n: number): Float32Array {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2;
        const r = RADIUS + (Math.random() - 0.5) * 8;
        pos[i * 3] = Math.cos(angle) * r;
        pos[i * 3 + 1] = Math.sin(angle) * r;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return pos;
}

function generateSphere(n: number): Float32Array {
    const pos = new Float32Array(n * 3);
    const r = RADIUS * 0.8;
    for (let i = 0; i < n; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi);
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
}

function generateCube(n: number): Float32Array {
    const pos = new Float32Array(n * 3);
    const s = RADIUS * 0.7;
    for (let i = 0; i < n; i++) {
        const face = i % 6;
        const u = (Math.random() - 0.5) * 2 * s;
        const v = (Math.random() - 0.5) * 2 * s;
        switch (face) {
            case 0:
                pos[i * 3] = s;
                pos[i * 3 + 1] = u;
                pos[i * 3 + 2] = v;
                break;
            case 1:
                pos[i * 3] = -s;
                pos[i * 3 + 1] = u;
                pos[i * 3 + 2] = v;
                break;
            case 2:
                pos[i * 3] = u;
                pos[i * 3 + 1] = s;
                pos[i * 3 + 2] = v;
                break;
            case 3:
                pos[i * 3] = u;
                pos[i * 3 + 1] = -s;
                pos[i * 3 + 2] = v;
                break;
            case 4:
                pos[i * 3] = u;
                pos[i * 3 + 1] = v;
                pos[i * 3 + 2] = s;
                break;
            case 5:
                pos[i * 3] = u;
                pos[i * 3 + 1] = v;
                pos[i * 3 + 2] = -s;
                break;
        }
    }
    return pos;
}

function generateCube2(n: number): Float32Array {
    const pos = new Float32Array(n * 3);
    const s = RADIUS * 0.7;
    for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 2 * s;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 2 * s;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * s;
    }
    return pos;
}

function generateCubeGrid(n: number): Float32Array {
    const pos = new Float32Array(n * 3);
    const s = RADIUS * 0.7;
    const k = Math.round(Math.cbrt(n)); // grid divisions per axis
    const total = k * k * k;

    for (let i = 0; i < n; i++) {
        const idx = i < total ? i : total - 1; // extra points stack on last slot
        const iz = Math.floor(idx / (k * k));
        const iy = Math.floor((idx % (k * k)) / k);
        const ix = idx % k;
        pos[i * 3] = -s + (ix / (k - 1)) * 2 * s;
        pos[i * 3 + 1] = -s + (iy / (k - 1)) * 2 * s;
        pos[i * 3 + 2] = -s + (iz / (k - 1)) * 2 * s;
    }
    return pos;
}

function generateHelix(n: number): Float32Array {
    const pos = new Float32Array(n * 3);
    const r = RADIUS * 0.5;
    const height = RADIUS * 2.0;
    const turns = 5;
    for (let i = 0; i < n; i++) {
        const t = i / n;
        const angle = t * turns * Math.PI * 2;
        const strand = (i % 2) * Math.PI;
        pos[i * 3] = Math.cos(angle + strand) * r;
        pos[i * 3 + 1] = t * height - height / 2;
        pos[i * 3 + 2] = Math.sin(angle + strand) * r;
    }
    return pos;
}

// ─── Scene ───────────────────────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 400;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.querySelector('#app')?.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Lighting ─────────────────────────────────────────────────────────────────

scene.add(new THREE.AmbientLight(0x111133, 2));

const light1 = new THREE.PointLight(0x4466ff, 1200, 700);
light1.position.set(200, 100, 250);
scene.add(light1);

const light2 = new THREE.PointLight(0xff3366, 1200, 700);
light2.position.set(-200, -100, 150);
scene.add(light2);

const light3 = new THREE.PointLight(0xffffff, 600, 600);
light3.position.set(0, 250, -150);
scene.add(light3);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 2);
dirLight1.position.set(1, 1, 1);
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0xaabbff, 1.5);
dirLight2.position.set(-1, -0.5, -1);
scene.add(dirLight2);

// ─── Instanced metallic spheres ───────────────────────────────────────────────

const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 8, 6);
const sphereMat = new THREE.MeshStandardMaterial({
    metalness: 0.9,
    roughness: 0.2,
    color: 0xffd700,
    // wireframe: true,
    // emissive: 0xffffff,
    // emissiveIntensity: 0.5,
});

const mesh = new THREE.InstancedMesh(sphereGeo, sphereMat, N);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(mesh);

// Per-instance base colors and blink parameters
const baseColors = new Float32Array(N * 3);
const blinkPhases = new Float32Array(N);
const blinkSpeeds = new Float32Array(N);

const tempColor = new THREE.Color();
for (let i = 0; i < N; i++) {
    // Hue 38–50 = deep gold to bright yellow-gold, slight per-sphere variation
    const hue = (38 + (i % 13)) / 360;
    const lightness = 0.45 + (i % 7) * 0.03;
    tempColor.setHSL(hue, 1.0, lightness);
    baseColors[i * 3] = tempColor.r;
    baseColors[i * 3 + 1] = tempColor.g;
    baseColors[i * 3 + 2] = tempColor.b;
    blinkPhases[i] = Math.random() * Math.PI * 2;
    blinkSpeeds[i] = 0.5 + Math.random() * 3.0;
}

// ─── Morph state ─────────────────────────────────────────────────────────────

const positions = new Float32Array(N * 3);
const shapeGenerators = [generateCircle, generateSphere, generateCube, generateCube2, generateCubeGrid, generateHelix];
let fromPos = shapeGenerators[0](N);
let toPos = shapeGenerators[1](N);
let nextIdx = 2;
let progress = 0;
let holding = false;
let holdTimer = 0;
let lastTime = -1;

positions.set(fromPos);

// ─── Scratch objects (reused every frame to avoid allocation) ─────────────────

const matrix = new THREE.Matrix4();
const posVec = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scaleVec = new THREE.Vector3(1, 1, 1);
const blinkColor = new THREE.Color();
const white = new THREE.Color(1, 0.95, 0.6); // warm gold highlight

// ─── Animation loop ───────────────────────────────────────────────────────────

renderer.setAnimationLoop((time) => {
    const dt = lastTime < 0 ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    const t = time / 1000;

    // Slow orbit of the lights for dynamic reflections
    light1.position.set(Math.cos(t * 0.3) * 300, Math.sin(t * 0.2) * 200, 250);
    light2.position.set(Math.cos(t * 0.3 + Math.PI) * 300, Math.sin(t * 0.25) * 200, 150);

    mesh.rotation.y += 0.003;
    mesh.rotation.x += 0.001;

    if (holding) {
        holdTimer += dt;
        if (holdTimer >= HOLD_DURATION) {
            fromPos = toPos;
            toPos = shapeGenerators[nextIdx](N);
            nextIdx = (nextIdx + 1) % shapeGenerators.length;
            progress = 0;
            holding = false;
            holdTimer = 0;
        }
    } else {
        progress = Math.min(1, progress + dt / TRANSITION_DURATION);
        const morphT = easeInOut(progress);
        for (let i = 0; i < N * 3; i++) {
            positions[i] = fromPos[i] + (toPos[i] - fromPos[i]) * morphT;
        }
        if (progress >= 1) holding = true;
    }

    for (let i = 0; i < N; i++) {
        posVec.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        matrix.compose(posVec, quat, scaleVec);
        mesh.setMatrixAt(i, matrix);

        // Sharp blink: pow(4) keeps it dark most of the time, flashes briefly to white
        const blink = Math.pow(Math.max(0, Math.sin(t * blinkSpeeds[i] + blinkPhases[i])), 4);
        blinkColor.setRGB(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
        blinkColor.lerp(white, blink * 0.95);
        mesh.setColorAt(i, blinkColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;

    renderer.render(scene, camera);
});
