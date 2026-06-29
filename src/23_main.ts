import './style.css';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xffffff);
scene.fog = new THREE.Fog(0xffffff, 3, 4);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, -3, 1);
// camera.position.set(0, -10, 1);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.querySelector('#app')?.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

function createGGeometry(): THREE.BufferGeometry {
    const depth = 0.03;
    const S = 16; // segments

    const hArm = new THREE.BoxGeometry(2, 0.4, depth, S, 4, 1);
    hArm.translate(-1, 0.2, depth / 2);

    const vArm = new THREE.BoxGeometry(0.4, 1.6, depth, 4, S, 1);
    vArm.translate(-1.8, -0.8, depth / 2);

    return mergeGeometries([hArm, vArm]);
}

const cardGeo = createGGeometry();

function createCardMaterial(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
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
        mesh.position.z = i * 0.04;
        group.add(mesh);
        cards.push({ mesh, mat });
    }
    return { group, cards };
}

const { group: leftGroup, cards: leftCards } = createStack(12);
leftGroup.rotateZ((-2 * Math.PI) / 3 - Math.PI * 0.08);
leftGroup.position.set(-1.8, -1.3, 0);
scene.add(leftGroup);

const { group: rightGroup, cards: rightCards } = createStack(12);
rightGroup.scale.x = -1.0; // mirror horizontally
rightGroup.rotateZ((2 * Math.PI) / 3 + Math.PI * 0.08);
rightGroup.position.set(1.8, -1.3, 0);
scene.add(rightGroup);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.3);
directionalLight.position.set(0, 2, 3);
scene.add(directionalLight);

const orangeLight = new THREE.PointLight(0xff6600, 2.5, 2.6);
orangeLight.position.set(0, -0.8, 1.8);
scene.add(orangeLight);

const orangeLight2 = new THREE.PointLight(0xff0000, 0.5, 1.9);
orangeLight2.position.set(0, -0.2, 0.5);
scene.add(orangeLight2);

function setBend(card: CardData, value: number) {
    if (card.mat.userData.shader) {
        card.mat.userData.shader.uniforms.uBend.value = value;
    }
}

function animate(time: number) {
    const t = time / 1000;

    const maxSin = Math.max(Math.sin(t), 0);

    setBend(leftCards.at(-1)!, maxSin * 0.9);
    setBend(leftCards.at(-2)!, maxSin * 0.6);
    setBend(leftCards.at(-3)!, maxSin * 0.3);

    setBend(rightCards.at(-1)!, maxSin * 0.9);
    setBend(rightCards.at(-2)!, maxSin * 0.6);
    setBend(rightCards.at(-3)!, maxSin * 0.3);

    renderer.render(scene, camera);
}
