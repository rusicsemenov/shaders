import './style.css';
import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const overlay = document.createElement('div');
overlay.textContent = 'Try to change PNG image in the GUI controls';
Object.assign(overlay.style, {
    position: 'absolute',
    bottom: '0',
    right: '0',
    padding: '.5rem',
    color: 'white',
});
document.body.appendChild(overlay);

class Point {
    originX: number;
    originY: number;
    originZ: number;
    maxDelta: number;
    velocity: number;
    step: number;

    constructor(x: number, y: number, z: number, maxDelta: number) {
        this.originX = x;
        this.originY = y;
        this.originZ = z;
        this.maxDelta = maxDelta;
        this.velocity = 0;
        this.step = params.returnStep;
    }

    setVelocity(val: number) {
        this.velocity = val;
    }

    private randomDirection(time: number, index: number, delta: number): number {
        return Math.random() > 0.5
            ? (Math.sin(time * 0.001 + index / 2) / delta) * this.maxDelta
            : (Math.cos(time * 0.001 + index / 2) / delta) * this.maxDelta;
    }

    update(time: number, index: number, positions: Float32Array, delta: number): void {
        const i3 = index * 3;
        if (this.velocity > 0) {
            positions[i3] += this.randomDirection(time, index, delta);
            positions[i3 + 1] += this.randomDirection(time, index, delta);
            positions[i3 + 2] += this.randomDirection(time, index, delta);
            this.velocity -= 0.05;
            if (this.velocity < 0) this.velocity = 0;
        } else {
            positions[i3] += (this.originX - positions[i3]) * this.step;
            positions[i3 + 1] += (this.originY - positions[i3 + 1]) * this.step;
            positions[i3 + 2] += (this.originZ - positions[i3 + 2]) * this.step;
        }
    }

    setStep(val: number) {
        this.step = val;
    }
}

function makeCircleTexture(resolution = 64): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext('2d')!;
    const r = resolution / 2;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, resolution, resolution);
    return new THREE.CanvasTexture(canvas);
}

const params = {
    size: 250,
    delta: 3,
    returnStep: 0.005,
    background: '#000000',
    imgSrc: './vialan-white.png',
    colorMode: 'hsl' as 'hsl' | 'custom',
    customColor: '#ffffff',
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(params.background);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = ((window.innerHeight / window.innerWidth) * params.size) / 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.querySelector('#app')?.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.position.z = (window.innerHeight / window.innerWidth) * params.size;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-params.size, -params.size);

const MOUSE_IDLE_MS = 150;
let mouseIdleTimeout: ReturnType<typeof setTimeout> | null = null;

function disableMousePosition() {
    if (mouseIdleTimeout) {
        clearTimeout(mouseIdleTimeout);
        mouseIdleTimeout = null;
    }
    mouse.set(-params.size, -params.size);
}

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (mouseIdleTimeout) clearTimeout(mouseIdleTimeout);
    mouseIdleTimeout = setTimeout(disableMousePosition, MOUSE_IDLE_MS);
});

document.addEventListener('mouseleave', disableMousePosition);

window.addEventListener('touchmove', (e) => {
    mouse.x = (e.changedTouches[0].clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.changedTouches[0].clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('touchend', disableMousePosition);

document.addEventListener(
    'wheel',
    (e) => {
        e.preventDefault();
        camera.position.z += e.deltaY * 0.1;
    },
    { passive: false },
);

// ─── Particle system state ────────────────────────────────────────────────────

let pointField: THREE.Points | null = null;
let points: Point[] = [];
let positions: Float32Array = new Float32Array(0);
let colorsArray: Float32Array = new Float32Array(0);
let material: THREE.PointsMaterial | null = null;
let count = 0;

let loadedImg: HTMLImageElement | null = null;

function buildParticles() {
    if (!loadedImg) return;

    if (pointField) {
        scene.remove(pointField);
        pointField.geometry.dispose();
        material?.dispose();
        pointField = null;
        material = null;
    }

    const s = params.size;
    const d = params.delta;
    const finger = s / d;

    const offscreen = document.createElement('canvas');
    offscreen.width = s;
    offscreen.height = s;
    const ctx = offscreen.getContext('2d')!;
    ctx.drawImage(loadedImg, 0, 0, s, s);
    const { data } = ctx.getImageData(0, 0, s, s);

    const imageCoords: [number, number][] = [];
    for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
            const alpha = data[(s * y + x) * 4 + 3];
            if (alpha > 0) {
                imageCoords.push([x - s / 2 + 10, s / 2 - y + 10]);
            }
        }
    }

    count = imageCoords.length;
    positions = new Float32Array(count * 3);
    colorsArray = new Float32Array(count * 3);
    points = [];

    for (let i = 0; i < count; i++) {
        const [px, py] = imageCoords[i];
        const pz = Math.sin(i / 10) * d;

        positions[i * 3] = px;
        positions[i * 3 + 1] = py;
        positions[i * 3 + 2] = pz;

        points.push(new Point(px, py, pz, finger));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

    material = new THREE.PointsMaterial({
        vertexColors: true,
        map: makeCircleTexture(),
        alphaTest: 0.05,
        transparent: true,
        size: 5,
        sizeAttenuation: false,
    });

    pointField = new THREE.Points(geometry, material);
    scene.add(pointField);

    // raycaster.params.Points!.threshold = finger / 2;
    raycaster.params.Points!.threshold = 15;
    updateColors();
}

function updateColors() {
    if (!pointField) return;
    const solid = new THREE.Color(params.customColor);
    for (let i = 0; i < count; i++) {
        const color =
            params.colorMode === 'hsl'
                ? new THREE.Color(`hsl(${(i * 10 + 100) % 360}, 100%, 50%)`)
                : solid;
        colorsArray[i * 3] = color.r;
        colorsArray[i * 3 + 1] = color.g;
        colorsArray[i * 3 + 2] = color.b;
    }
    (pointField.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
}

// ─── Load image ───────────────────────────────────────────────────────────────

const img = new Image();
img.src = params.imgSrc;
img.onload = () => {
    loadedImg = img;
    buildParticles();

    const maxRotX = 1;
    const maxRotY = 1;
    let deltaRotX = 0.002;
    let deltaRotY = 0.001;

    renderer.setAnimationLoop((time) => {
        if (!pointField) return;

        if (pointField.rotation.x > maxRotX || pointField.rotation.x < -maxRotX)
            deltaRotX = -deltaRotX;
        if (pointField.rotation.y > maxRotY || pointField.rotation.y < -maxRotY)
            deltaRotY = -deltaRotY;

        pointField.rotation.x += deltaRotX;
        pointField.rotation.y += deltaRotY;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(pointField);
        for (const hit of intersects) {
            points[hit.index!].setVelocity(1);
        }

        for (let i = 0; i < count; i++) {
            points[i].update(time, i, positions, params.delta);
        }

        (pointField.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        renderer.render(scene, camera);
    });
};

// ─── GUI ──────────────────────────────────────────────────────────────────────

const gui = new GUI();
gui.close();
gui.addColor(params, 'background').onChange(() => {
    (scene.background as THREE.Color).set(params.background);
});
gui.add(params, 'size', 50, 500, 10).onFinishChange(buildParticles);
gui.add(params, 'delta', 1, 20, 0.5).onFinishChange(buildParticles);
gui.add(params, 'returnStep', 0.001, 0.1, 0.001)
    .name('return speed')
    .onChange(() => {
        points.forEach((p) => p.setStep(params.returnStep));
    });
const colorFolder = gui.addFolder('Color');
colorFolder.add(params, 'colorMode', ['hsl', 'custom']).name('mode').onChange(updateColors);
colorFolder.addColor(params, 'customColor').name('custom color').onChange(updateColors);
gui.add(params, 'imgSrc')
    .name('image URL')
    .onFinishChange((val: string) => {
        const newImg = new Image();
        newImg.crossOrigin = 'anonymous';
        newImg.onload = () => {
            loadedImg = newImg;
            buildParticles();
        };
        newImg.src = val;
    });
