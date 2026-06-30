import './style.css';
import * as THREE from 'three';

const size = 500;
const delta = 10;
const finger = size / delta;

class Point {
    originX: number;
    originY: number;
    originZ: number;
    maxDelta: number;
    velocity: number;
    step: number;
    newX: number;
    newY: number;
    newZ: number;

    constructor(x: number, y: number, z: number, maxDelta: number) {
        this.originX = x;
        this.originY = y;
        this.originZ = z;
        this.maxDelta = maxDelta;
        this.velocity = 0;
        this.step = 0.1;
        this.newX = this.newY = this.newZ = 0;
    }

    setVelocity(val: number) {
        this.velocity = val;
    }

    private randomDirection(time: number, index: number): number {
        return Math.random() > 0.5
            ? (Math.sin(time * 0.01 + index / 2) / delta) * this.maxDelta
            : (Math.cos(time * 0.01 + index / 2) / delta) * this.maxDelta;
    }

    update(time: number, index: number, posNow: THREE.Vector3) {
        if (this.velocity > 0) {
            this.newX = this.randomDirection(time, index);
            this.newY = this.randomDirection(time, index);
            this.newZ = this.randomDirection(time, index);
            this.velocity -= 0.05;
            if (this.velocity < 0) this.velocity = 0;
        } else {
            this.newX = (this.originX - posNow.x) * this.step;
            this.newY = (this.originY - posNow.y) * this.step;
            this.newZ = (this.originZ - posNow.z) * this.step;
        }
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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x303030);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = (window.innerHeight / window.innerWidth) * size;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.querySelector('#app')?.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.position.z = (window.innerHeight / window.innerWidth) * size;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const raycaster = new THREE.Raycaster();
raycaster.params.Points!.threshold = finger / 2;
const mouse = new THREE.Vector2(-size, -size);

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('touchmove', (e) => {
    mouse.x = (e.changedTouches[0].clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.changedTouches[0].clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('touchend', () => {
    mouse.set(-size, -size);
});

document.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.1;
}, { passive: false });

// ─── Load image → extract pixel positions ────────────────────────────────────

const offscreen = document.createElement('canvas');
offscreen.width = size;
offscreen.height = size;
const ctx = offscreen.getContext('2d')!;

const img = new Image();
img.src = '/vialan-white.png';
img.onload = () => {
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const imageCoords: [number, number][] = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const alpha = data[(size * y + x) * 4 + 3];
            if (alpha > 0) {
                imageCoords.push([x - size / 2 + 10, size / 2 - y + 10]);
            }
        }
    }

    const count = imageCoords.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const points: Point[] = [];

    for (let i = 0; i < count; i++) {
        const [px, py] = imageCoords[i];
        const pz = Math.sin(i / 10) * delta;

        positions[i * 3]     = px;
        positions[i * 3 + 1] = py;
        positions[i * 3 + 2] = pz;

        const hue = (i * 10 + 100) % 360;
        const color = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
        colors[i * 3]     = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        points.push(new Point(px, py, pz, finger));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        vertexColors: true,
        map: makeCircleTexture(),
        alphaTest: 0.05,
        transparent: true,
        size: 2,
        sizeAttenuation: false,
    });

    const pointField = new THREE.Points(geometry, material);
    scene.add(pointField);

    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const posNow = new THREE.Vector3();

    const maxRotX = 1;
    const maxRotY = 1;
    let deltaRotX = 0.002;
    let deltaRotY = 0.001;

    renderer.setAnimationLoop((time) => {
        if (pointField.rotation.x > maxRotX || pointField.rotation.x < -maxRotX) deltaRotX = -deltaRotX;
        if (pointField.rotation.y > maxRotY || pointField.rotation.y < -maxRotY) deltaRotY = -deltaRotY;

        pointField.rotation.x += deltaRotX;
        pointField.rotation.y += deltaRotY;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(pointField);
        for (const hit of intersects) {
            points[hit.index!].setVelocity(1);
        }

        for (let i = 0; i < count; i++) {
            posNow.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            points[i].update(time, i, posNow);

            positions[i * 3]     += points[i].newX;
            positions[i * 3 + 1] += points[i].newY;
            positions[i * 3 + 2] += points[i].newZ;
        }

        posAttr.needsUpdate = true;
        renderer.render(scene, camera);
    });
};
