import './style.css';
import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const N = 1000;
const RADIUS = 150;
const SPHERE_RADIUS = 3.5;

const params = {
    background: '#050508',
    transparentBg: false,
    sphereScale: 1,
    metalness: 0.9,
    roughness: 0.2,
    color: '#ffd700',
    emissive: '#000000',
    emissiveIntensity: 0,
    wireframe: false,
    colorMode: 'gold' as 'gold' | 'random',
    transitionDuration: 4,
    holdDuration: 1.5,
    rotSpeedY: 0.003,
    rotSpeedX: 0.001,
    blinkIntensity: 0.95,
};

function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Perlin noise ────────────────────────────────────────────────────────────

const perm = new Uint8Array(512);
for (let i = 0; i < 256; i++) perm[i] = i;
for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
}
for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

function fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}
function grad(h: number, x: number, y: number) {
    const u = h & 1 ? x : y,
        v = h & 2 ? -y : x;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}
function perlin(x: number, y: number): number {
    const xi = Math.floor(x) & 255,
        yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x),
        yf = y - Math.floor(y);
    const u = fade(xf),
        v = fade(yf);
    const a = perm[xi] + yi,
        b = perm[xi + 1] + yi;
    const lerp = (a: number, b: number, t: number) => a + t * (b - a);
    return lerp(
        lerp(grad(perm[a], xf, yf), grad(perm[b], xf - 1, yf), u),
        lerp(grad(perm[a + 1], xf, yf - 1), grad(perm[b + 1], xf - 1, yf - 1), u),
        v,
    );
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

function generatePerlinPlane(n: number): Float32Array {
    const pos = new Float32Array(n * 3);
    const s = RADIUS * 0.9;
    const cols = Math.round(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const amplitude = RADIUS * 0.12;
    const freq = 0.02;

    for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = -s + (col / (cols - 1)) * 2 * s;
        const y = -s + (Math.min(row, rows - 1) / (rows - 1)) * 2 * s;
        const z =
            perlin(x * freq, y * freq) * amplitude +
            perlin(x * freq * 2, y * freq * 2) * amplitude * 0.3;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
    }
    return pos;
}

function generateDNA(n: number): Float32Array {
    const pos = new Float32Array(n * 3);
    const helixR = RADIUS * 0.35;
    const height = RADIUS * 2.2;
    const turns = 3;
    const rungPts = 5; // points per rung crossbar

    const strandCount = Math.floor(n * 0.4);
    const numRungs = Math.floor((n - 2 * strandCount) / rungPts);

    let idx = 0;

    // Two backbone strands, offset by π
    for (let strand = 0; strand < 2; strand++) {
        const offset = strand * Math.PI;
        for (let i = 0; i < strandCount; i++) {
            const t = i / (strandCount - 1);
            const angle = t * turns * Math.PI * 2 + offset;
            pos[idx * 3] = helixR * Math.cos(angle);
            pos[idx * 3 + 1] = t * height - height / 2;
            pos[idx * 3 + 2] = helixR * Math.sin(angle);
            idx++;
        }
    }

    // Rungs connecting the two strands
    for (let ri = 0; ri < numRungs && idx < n; ri++) {
        const t = ri / (numRungs - 1);
        const angle = t * turns * Math.PI * 2;
        const y = t * height - height / 2;
        const x1 = helixR * Math.cos(angle),
            z1 = helixR * Math.sin(angle);
        const x2 = helixR * Math.cos(angle + Math.PI),
            z2 = helixR * Math.sin(angle + Math.PI);
        for (let j = 0; j < rungPts && idx < n; j++) {
            const lt = j / (rungPts - 1);
            pos[idx * 3] = x1 + (x2 - x1) * lt;
            pos[idx * 3 + 1] = y;
            pos[idx * 3 + 2] = z1 + (z2 - z1) * lt;
            idx++;
        }
    }

    return pos;
}

// ─── Scene ───────────────────────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 400;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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

// ─── GUI ─────────────────────────────────────────────────────────────────────

const gui = new GUI();
gui.add(params, 'transparentBg')
    .name('transparent bg')
    .onChange((v: boolean) => {
        scene.background = v ? null : new THREE.Color(params.background);
    });
gui.addColor(params, 'background').onChange((v: string) => {
    if (!params.transparentBg) (scene.background as THREE.Color).set(v);
});
gui.add(params, 'sphereScale', 0.1, 3, 0.05).name('sphere size');
gui.add(params, 'transitionDuration', 0.5, 10, 0.5).name('transition (s)');
gui.add(params, 'holdDuration', 0, 5, 0.5).name('hold (s)');
gui.add(params, 'rotSpeedY', 0, 0.02, 0.001).name('rotation Y');
gui.add(params, 'rotSpeedX', 0, 0.02, 0.001).name('rotation X');
gui.add(params, 'blinkIntensity', 0, 1, 0.05).name('blink');

const matFolder = gui.addFolder('Material');
matFolder.addColor(params, 'color').onChange((v: string) => sphereMat.color.set(v));
matFolder.add(params, 'metalness', 0, 1, 0.01).onChange((v: number) => (sphereMat.metalness = v));
matFolder.add(params, 'roughness', 0, 1, 0.01).onChange((v: number) => (sphereMat.roughness = v));
matFolder.addColor(params, 'emissive').onChange((v: string) => sphereMat.emissive.set(v));
matFolder
    .add(params, 'emissiveIntensity', 0, 5, 0.05)
    .onChange((v: number) => (sphereMat.emissiveIntensity = v));
matFolder.add(params, 'wireframe').onChange((v: boolean) => (sphereMat.wireframe = v));
matFolder
    .add(params, 'colorMode', ['gold', 'random'])
    .name('color mode')
    .onChange((v: string) => {
        baseColors.set(v === 'gold' ? goldColors : randomColors);
    });

// ─── Instanced metallic spheres ───────────────────────────────────────────────

const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 8, 6);
const sphereMat = new THREE.MeshStandardMaterial({
    metalness: 0.9,
    roughness: 0.2,
    color: 0xffd700,
});

const mesh = new THREE.InstancedMesh(sphereGeo, sphereMat, N);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(mesh);

// Per-instance base colors and blink parameters
const baseColors = new Float32Array(N * 3);
const goldColors = new Float32Array(N * 3);
const randomColors = new Float32Array(N * 3);
const blinkPhases = new Float32Array(N);
const blinkSpeeds = new Float32Array(N);

const tempColor = new THREE.Color();
for (let i = 0; i < N; i++) {
    const hue = (38 + (i % 13)) / 360;
    const lightness = 0.45 + (i % 7) * 0.03;
    tempColor.setHSL(hue, 1, lightness);
    goldColors[i * 3] = tempColor.r;
    goldColors[i * 3 + 1] = tempColor.g;
    goldColors[i * 3 + 2] = tempColor.b;

    tempColor.setHSL(i / N, 1, 0.6);
    randomColors[i * 3] = tempColor.r;
    randomColors[i * 3 + 1] = tempColor.g;
    randomColors[i * 3 + 2] = tempColor.b;

    blinkPhases[i] = Math.random() * Math.PI * 2;
    blinkSpeeds[i] = 0.5 + Math.random() * 3;
}

baseColors.set(goldColors);

// ─── Morph state ─────────────────────────────────────────────────────────────

const positions = new Float32Array(N * 3);
const shapeGenerators = [
    generateCircle,
    generateCube,
    generateSphere,
    generateCube2,
    generatePerlinPlane,
    generateCubeGrid,
    generateDNA,
];
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

    mesh.rotation.y += params.rotSpeedY;
    mesh.rotation.x += params.rotSpeedX;

    if (holding) {
        holdTimer += dt;
        if (holdTimer >= params.holdDuration) {
            fromPos = toPos;
            toPos = shapeGenerators[nextIdx](N);
            nextIdx = (nextIdx + 1) % shapeGenerators.length;
            progress = 0;
            holding = false;
            holdTimer = 0;
        }
    } else {
        progress = Math.min(1, progress + dt / params.transitionDuration);
        const morphT = easeInOut(progress);
        for (let i = 0; i < N * 3; i++) {
            positions[i] = fromPos[i] + (toPos[i] - fromPos[i]) * morphT;
        }
        if (progress >= 1) holding = true;
    }

    for (let i = 0; i < N; i++) {
        posVec.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        scaleVec.setScalar(params.sphereScale);
        matrix.compose(posVec, quat, scaleVec);
        mesh.setMatrixAt(i, matrix);

        const blink = Math.pow(Math.max(0, Math.sin(t * blinkSpeeds[i] + blinkPhases[i])), 4);
        blinkColor.setRGB(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
        blinkColor.lerp(white, blink * params.blinkIntensity);
        mesh.setColorAt(i, blinkColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    renderer.render(scene, camera);
});
