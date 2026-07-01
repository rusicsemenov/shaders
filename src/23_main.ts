import './style.css';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// https://www.globallogic.com

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xffffff);
scene.fog = new THREE.Fog(0xffffff, 2.5, 4.5);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(-1, -4, 2);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#app')?.appendChild(renderer.domElement);

const overlay = document.createElement('div');
overlay.textContent = 'Engineering Impact';
overlay.classList.add('overlay');
document.body.appendChild(overlay);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

function createGGeometry(): THREE.BufferGeometry {
    const depth = 0.022;
    const S = 16; // segments

    const hArm = new THREE.BoxGeometry(2, 0.4, depth, S, 4, 1);
    hArm.translate(-1, 0.2, depth / 2);

    const vArm = new THREE.BoxGeometry(0.4, 1.6, depth, 4, S, 1);
    vArm.translate(-1.8, -0.8, depth / 2);

    return mergeGeometries([hArm, vArm]);
}

const cardGeo = createGGeometry();

function createCardMaterial(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        roughness: 0.8,
        metalness: 1,
        // wireframe: true,
        // emissive: 0x000000,
        // emissiveIntensity: 1,
    });
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uBend = { value: 0 };
        shader.vertexShader = 'uniform float uBend;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            // diagonal bend: decompose XY into spine direction d and perpendicular p
            vec2 d = normalize(vec2(-1.0, 1.0));
            vec2 p = vec2(-d.y, d.x);
            float s = max(0.0, dot(position.xy, d));
            float perp = dot(position.xy, p);
            float theta = (s / 2.0) * uBend;
            float R_sin   = abs(uBend) > 0.0001 ? 2.0 * sin(theta) / uBend : s;
            float R_1mCos = abs(uBend) > 0.0001 ? 2.0 * (1.0 - cos(theta)) / uBend : 0.0;
            transformed.xy = R_sin * d + perp * p;
            transformed.z += R_1mCos;
            `,
        );
        mat.userData.shader = shader;
    };
    return mat;
}

interface CardData {
    mesh: THREE.Mesh;
    mat: THREE.MeshStandardMaterial;
}

function createStack(count: number): { group: THREE.Group; cards: CardData[] } {
    const group = new THREE.Group();
    const cards: CardData[] = [];

    for (let i = 0; i < count; i++) {
        const mat = createCardMaterial();
        const mesh = new THREE.Mesh(cardGeo, mat);
        mesh.position.z = i * 0.03;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        cards.push({ mesh, mat });
    }
    return { group, cards };
}

const { group: leftGroup, cards: leftCards } = createStack(12);
leftGroup.rotateZ((-2 * Math.PI) / 3 - Math.PI * 0.08);
leftGroup.position.set(-1.73, -1.3, 0);
scene.add(leftGroup);

const { group: rightGroup, cards: rightCards } = createStack(12);
rightGroup.scale.x = -1; // mirror horizontally
rightGroup.rotateZ((2 * Math.PI) / 3 + Math.PI * 0.08);
rightGroup.position.set(1.73, -1.3, 0);
scene.add(rightGroup);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.3);
directionalLight.position.set(0, -2, 10);
directionalLight.castShadow = true;
directionalLight.shadow.normalBias = 0.005;
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.3);
directionalLight2.position.set(0, -20, -10);
directionalLight2.shadow.bias = -0.0001;
directionalLight2.shadow.normalBias = 0.005;
scene.add(directionalLight2);

const orangeLight = new THREE.PointLight(0xff6600, 10.5, 2.3);
orangeLight.position.set(0, 0.1, 1.6);
scene.add(orangeLight);

const orangeLight2 = new THREE.PointLight(0xff0000, 10.5, 0.9);
orangeLight2.position.set(0, -0.3, 0.5);
scene.add(orangeLight2);

const orangeLight3 = new THREE.PointLight(0xffffff, 2.5);
orangeLight3.position.set(0, 0, -1);
scene.add(orangeLight3);

const orangeLight4 = new THREE.PointLight(0xff0000, 10.5, 0.9);
orangeLight4.position.set(1, -1.3, -0.5);
scene.add(orangeLight4);

function setBend(card: CardData, value: number) {
    if (card.mat.userData.shader) {
        card.mat.userData.shader.uniforms.uBend.value = value;
    }
}

const params = {
    background: '#ffffff',
    fog: '#ffffff',
    textColor: '#111111',
    color: '#ffffff',
    transparent: true,
    roughness: 0.8,
    metalness: 1.0,
    wireframe: false,
    emissive: '#000000',
    emissiveIntensity: 1.0,
    baseSpeed: 0.3,
    speedAmp: 0.2,
    radius: 3.2,
};

const allCards = () => [...leftCards, ...rightCards];

const gui = new GUI();
gui.close();
gui.addColor(params, 'background').onChange(() => {
    (scene.background as THREE.Color).set(params.background);
});
gui.addColor(params, 'fog').onChange(() => {
    (scene.fog as THREE.Fog).color.set(params.fog);
});
gui.addColor(params, 'textColor').onChange(() => {
    overlay.style.color = params.textColor;
});
const matFolder = gui.addFolder('Material');
matFolder.addColor(params, 'color').onChange(() => {
    allCards().forEach((c) => c.mat.color.set(params.color));
});
matFolder.add(params, 'transparent').onChange(() => {
    allCards().forEach((c) => {
        c.mat.transparent = params.transparent;
        c.mat.needsUpdate = true;
    });
});
matFolder.add(params, 'roughness', 0, 1, 0.01).onChange(() => {
    allCards().forEach((c) => {
        c.mat.roughness = params.roughness;
    });
});
matFolder.add(params, 'metalness', 0, 1, 0.01).onChange(() => {
    allCards().forEach((c) => {
        c.mat.metalness = params.metalness;
    });
});
matFolder.add(params, 'wireframe').onChange(() => {
    allCards().forEach((c) => {
        c.mat.wireframe = params.wireframe;
    });
});
matFolder.addColor(params, 'emissive').onChange(() => {
    allCards().forEach((c) => c.mat.emissive.set(params.emissive));
});
matFolder.add(params, 'emissiveIntensity', 0, 5, 0.01).onChange(() => {
    allCards().forEach((c) => {
        c.mat.emissiveIntensity = params.emissiveIntensity;
    });
});
const camFolder = gui.addFolder('Camera');
camFolder.add(params, 'baseSpeed', 0, 1, 0.01);
camFolder.add(params, 'speedAmp', 0, 0.5, 0.01);
camFolder.add(params, 'radius', 1, 8, 0.1);

let cameraAzimuth = Math.atan2(-1, -1);
let lastT = 0;

function animate(time: number) {
    const t = time / 1000;
    const dt = t - lastT;
    lastT = t;

    const angularSpeed =
        params.baseSpeed + params.speedAmp * Math.sin(t * 0.4) + 0.08 * Math.sin(t * 1.1 + 1.2);
    cameraAzimuth += angularSpeed * dt;

    const polar = 2.3 + 0.25 * Math.sin(t * 0.37);
    const radius = params.radius;
    camera.position.x = radius * Math.sin(polar) * Math.sin(cameraAzimuth);
    camera.position.y = radius * Math.cos(polar);
    camera.position.z = radius * Math.sin(polar) * Math.cos(cameraAzimuth);
    camera.lookAt(0, 0, 0);

    const maxSin = Math.sin(t);

    const staticCount = 0;
    const bendable = leftCards.length - staticCount;

    for (let i = staticCount; i < leftCards.length; i++) {
        const pos = i - staticCount;
        const factor = maxSin >= 0 ? (pos + 1) / bendable : (bendable - pos) / bendable;
        setBend(leftCards[i], maxSin * factor * 1.1);
        setBend(rightCards[i], maxSin * factor * 1.1);
    }

    renderer.render(scene, camera);
}
