import './style.css';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(-5, 0, 5);
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

// Г-shape: horizontal arm x=-2..0 y=0..0.4, vertical arm x=-2..-1.6 y=-1.6..0
// Two BoxGeometries with interior subdivisions merged into one
function createGGeometry(): THREE.BufferGeometry {
    const depth = 0.08;
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
            // circular-arc bend in XZ plane: horizontal arm curves from lying flat to pointing up
            float s = max(0.0, -position.x);
            float theta = (s / 2.0) * uBend;
            float R_sin   = abs(uBend) > 0.0001 ? 2.0 * sin(theta) / uBend : s;
            float R_1mCos = abs(uBend) > 0.0001 ? 2.0 * (1.0 - cos(theta)) / uBend : 0.0;
            transformed.x = -R_sin;
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
        mesh.position.z = i * 0.06;
        group.add(mesh);
        cards.push({ mesh, mat });
    }
    return { group, cards };
}

const { group: leftGroup, cards: leftCards } = createStack(1);
scene.add(leftGroup);

const { group: rightGroup, cards: rightCards } = createStack(12);
rightGroup.scale.x = -1.0; // mirror horizontally
rightGroup.position.x = 0.5;
// scene.add(rightGroup);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(0, 5, 5);
scene.add(directionalLight);

const orangeLight = new THREE.PointLight(0xff6600, 3, 6);
orangeLight.position.set(0, 0, 1);
scene.add(orangeLight);

function setBend(card: CardData, value: number) {
    if (card.mat.userData.shader) {
        card.mat.userData.shader.uniforms.uBend.value = value;
    }
}

function animate(time: number) {
    const t = time / 1000;

    setBend(leftCards.at(-1)!, Math.sin(t) * 0.8);
    // setBend(leftCards.at(-2)!, Math.sin(t) * 0.3);
    // setBend(rightCards.at(-1)!, Math.sin(t) * 0.6);
    // setBend(rightCards.at(-2)!, Math.sin(t) * 0.3);

    renderer.render(scene, camera);
}
