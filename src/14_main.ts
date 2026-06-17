import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const scene = new THREE.Scene();
const gui = new GUI();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(1.5, 1, 4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.querySelector('#app')?.appendChild(renderer.domElement);

const bgGeometry = new THREE.PlaneGeometry(200, 200);
const bgMaterial2 = new THREE.MeshLambertMaterial({ color: 0x020e3d });
const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial2);
bgMesh.position.z = -3;
scene.add(bgMesh);

const loader = new GLTFLoader();

let torus: THREE.Mesh | undefined;

const settings = {
    wireframe: true,
    transmission: 0,
    roughness: 0,
    thickness: 0.818,
    ior: 1.0605,
    reflectivity: 0,
    emissiveIntensity: 0.352,
    emissiveColor: '#172a78',
    flatShading: true,
    metalness: 0,
    directionalLight: true,
    pointLight1: true,
    pointLight2: true,
    pointLight3: true,
    circle: false,
};

const stored = localStorage.getItem('shaderSettings');
if (stored) {
    try {
        Object.assign(settings, JSON.parse(stored));
    } catch {}
}

gui.onChange(() => localStorage.setItem('shaderSettings', JSON.stringify(settings)));

loader.load('/torusHQ.glb', (gltf: GLTF) => {
    torus = gltf.scene.getObjectByName('Torus-v2') as THREE.Mesh;
    if (!torus) {
        console.error('THREE.Torus not found.');
        return;
    }

    const mat = new THREE.MeshPhysicalMaterial({
        transmission: settings.transmission,
        roughness: settings.roughness,
        thickness: settings.thickness,
        ior: settings.ior,
        reflectivity: settings.reflectivity,
        emissive: new THREE.Color(settings.emissiveColor),
        emissiveIntensity: settings.emissiveIntensity,
        metalness: settings.metalness,
        wireframe: settings.wireframe,
        flatShading: settings.flatShading,
    });
    torus.material = mat;

    const matFolder = gui.addFolder('Material');
    matFolder.add(settings, 'transmission', 0, 1).onChange((v: number) => {
        mat.transmission = v;
    });
    matFolder.add(settings, 'roughness', 0, 1).onChange((v: number) => {
        mat.roughness = v;
    });
    matFolder.add(settings, 'thickness', 0, 2).onChange((v: number) => {
        mat.thickness = v;
    });
    matFolder.add(settings, 'ior', 1, 2.5).onChange((v: number) => {
        mat.ior = v;
    });
    matFolder.add(settings, 'reflectivity', 0, 1).onChange((v: number) => {
        mat.reflectivity = v;
    });
    matFolder.add(settings, 'emissiveIntensity', 0, 2).onChange((v: number) => {
        mat.emissiveIntensity = v;
    });
    matFolder.add(settings, 'metalness', 0, 1).onChange((v: number) => {
        mat.metalness = v;
    });
    matFolder.add(settings, 'wireframe').onChange((v: boolean) => {
        mat.wireframe = v;
    });
    matFolder.add(settings, 'flatShading').onChange((v: boolean) => {
        mat.flatShading = v;
        mat.needsUpdate = true;
    });
    matFolder.addColor(settings, 'emissiveColor').onChange((v: string) => {
        mat.emissive.set(v);
    });

    scene.add(gltf.scene);
});

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(1.5, 1, 4);
directionalLight.visible = settings.directionalLight;
scene.add(directionalLight);

const pointerLight = new THREE.PointLight(0xfaed00, 2.5);
pointerLight.position.set(-5, -5, 3);
pointerLight.visible = settings.pointLight1;
scene.add(pointerLight);

const pointerLight2 = new THREE.PointLight(0xffffff, 2.5);
pointerLight2.position.set(1, 4, 3);
pointerLight2.visible = settings.pointLight2;
scene.add(pointerLight2);

const pointerLight3 = new THREE.PointLight(0xffffff, 10.5);
pointerLight3.position.set(-1, -2, 1);
pointerLight3.visible = settings.pointLight3;
scene.add(pointerLight3);

const geometry = new THREE.CircleGeometry(0.5, 1);
const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
const circle = new THREE.Mesh(geometry, material);
circle.visible = settings.circle;
scene.add(circle);

const lightsFolder = gui.addFolder('Lights');
lightsFolder.add(settings, 'directionalLight').onChange((v: boolean) => {
    directionalLight.visible = v;
});
lightsFolder.add(settings, 'pointLight1').onChange((v: boolean) => {
    pointerLight.visible = v;
});
lightsFolder.add(settings, 'pointLight2').onChange((v: boolean) => {
    pointerLight2.visible = v;
});
lightsFolder.add(settings, 'pointLight3').onChange((v: boolean) => {
    pointerLight3.visible = v;
});

const sceneFolder = gui.addFolder('Scene');
sceneFolder.add(settings, 'circle').onChange((v: boolean) => {
    circle.visible = v;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const rotateDuration = 10000;
const pauseDuration = 2000;
const cycleDuration = rotateDuration + pauseDuration;

let cycleStartX = 0;
let cycleStartY = 0;
let lastCycle = -1;

renderer.setAnimationLoop(() => {
    const now = performance.now();
    const phase = now % cycleDuration;
    const cycleIndex = Math.floor(now / cycleDuration);

    if (torus) {
        if (cycleIndex !== lastCycle) {
            cycleStartX = (Math.random() - 0.5) * Math.PI * 2;
            cycleStartY = (Math.random() - 0.5) * Math.PI * 2;
            lastCycle = cycleIndex;
        }

        if (phase < rotateDuration) {
            const t = phase / rotateDuration;
            const eased = (1 - Math.cos(t * Math.PI)) / 2;
            torus.rotation.z = Math.PI * 2 * eased;

            const tXY = Math.min(phase / (rotateDuration * 0.6), 1);
            const swing = Math.sin(tXY * Math.PI);
            torus.rotation.x = cycleStartX * swing;
            torus.rotation.y = cycleStartY * swing;
        } else {
            torus.rotation.z = Math.PI * 6;
        }
    }

    renderer.render(scene, camera);
});
