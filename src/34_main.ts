import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// https://onlymonster.ai

const scene = new THREE.Scene();
const gui = new GUI();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 5);
camera.lookAt(0, 2.5, 0);

const isMobile = /Mobi|Android/i.test(navigator.userAgent);

const mouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (event.clientY / window.innerHeight) * 2 - 1;
});

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#app')?.appendChild(renderer.domElement);

const loader = new GLTFLoader();

let body: THREE.Mesh | undefined;
let head: THREE.Mesh | undefined;
let headBaseRotation: THREE.Euler | undefined;
let tail: THREE.Mesh | undefined;
let t_shirt: THREE.Mesh | undefined;

const materialDefaults = {
    wireframe: false,
    transmission: 1,
    roughness: 0,
    thickness: 1.04,
    ior: 1.9095,
    reflectivity: 0.938,
    emissiveIntensity: 0.548,
    emissiveColor: '#11053b',
    flatShading: false,
    metalness: 0.323,
};

const settings = {
    materials: {
        body: {
            wireframe: true,
            transmission: 0,
            roughness: 0.425,
            thickness: 0.358,
            ior: 1.656,
            reflectivity: 0.228,
            emissiveIntensity: 0.556,
            emissiveColor: '#5c0700',
            flatShading: false,
            metalness: 0,
        },
        t_shirt: {
            wireframe: false,
            transmission: 0.806,
            roughness: 0.241,
            thickness: 1.244,
            ior: 1.509,
            reflectivity: 0.978,
            emissiveIntensity: 0,
            emissiveColor: '#5c0700',
            flatShading: false,
            metalness: 0,
        },
        floor: {
            wireframe: false,
            transmission: 0.608,
            roughness: 0.474,
            thickness: 1.17,
            ior: 1.5645,
            reflectivity: 0,
            emissiveIntensity: 1.046,
            emissiveColor: '#371a94',
            flatShading: false,
            metalness: 0.351,
        },
    },
    directionalLight: true,
    pointLight1: true,
    pointLight2: true,
    pointLight3: true,
    floor: false,
};

const stored = localStorage.getItem('shaderSettings');
if (stored) {
    try {
        const parsed = JSON.parse(stored);
        const materialKeys = Object.keys(settings.materials) as (keyof typeof settings.materials)[];
        Object.assign(settings, parsed);
        materialKeys.forEach((key) => {
            settings.materials[key] = { ...materialDefaults, ...parsed.materials?.[key] };
        });
    } catch {}
}

gui.onChange(() => localStorage.setItem('shaderSettings', JSON.stringify(settings)));

function applyMaterialGroup(
    label: string,
    meshes: (THREE.Mesh | undefined)[],
    matSettings: typeof materialDefaults,
) {
    const mat = new THREE.MeshPhysicalMaterial({
        transmission: matSettings.transmission,
        roughness: matSettings.roughness,
        thickness: matSettings.thickness,
        ior: matSettings.ior,
        reflectivity: matSettings.reflectivity,
        emissive: new THREE.Color(matSettings.emissiveColor),
        emissiveIntensity: matSettings.emissiveIntensity,
        metalness: matSettings.metalness,
        wireframe: matSettings.wireframe,
        flatShading: matSettings.flatShading,
    });

    meshes.forEach((mesh) => {
        if (mesh) mesh.material = mat;
    });

    const folder = gui.addFolder(label);
    folder.add(matSettings, 'transmission', 0, 1).onChange((v: number) => {
        mat.transmission = v;
    });
    folder.add(matSettings, 'roughness', 0, 1).onChange((v: number) => {
        mat.roughness = v;
    });
    folder.add(matSettings, 'thickness', 0, 2).onChange((v: number) => {
        mat.thickness = v;
    });
    folder.add(matSettings, 'ior', 1, 2.5).onChange((v: number) => {
        mat.ior = v;
    });
    folder.add(matSettings, 'reflectivity', 0, 1).onChange((v: number) => {
        mat.reflectivity = v;
    });
    folder.add(matSettings, 'emissiveIntensity', 0, 2).onChange((v: number) => {
        mat.emissiveIntensity = v;
    });
    folder.add(matSettings, 'metalness', 0, 1).onChange((v: number) => {
        mat.metalness = v;
    });
    folder.add(matSettings, 'wireframe').onChange((v: boolean) => {
        mat.wireframe = v;
    });
    folder.add(matSettings, 'flatShading').onChange((v: boolean) => {
        mat.flatShading = v;
        mat.needsUpdate = true;
    });
    folder.addColor(matSettings, 'emissiveColor').onChange((v: string) => {
        mat.emissive.set(v);
    });

    return mat;
}

// torusHQ.glb | onlymonster-dance.glb | onlymonster.glb

loader.load('./onlymonster.glb', (gltf: GLTF) => {
    head = gltf.scene.getObjectByName('head') as THREE.Mesh;
    body = gltf.scene.getObjectByName('body') as THREE.Mesh;
    tail = gltf.scene.getObjectByName('tail') as THREE.Mesh;
    t_shirt = gltf.scene.getObjectByName('T-shirt') as THREE.Mesh;

    if (!head) {
        console.error('head mesh not found.');
        return;
    }

    if (head) {
        headBaseRotation = head.rotation.clone();
    }

    const meshGroups = [
        { label: 'Body', meshes: [body, head, tail], settings: settings.materials.body },
        { label: 'T-shirt', meshes: [t_shirt], settings: settings.materials.t_shirt },
    ];

    meshGroups.forEach(({ label, meshes, settings: matSettings }) => {
        applyMaterialGroup(label, meshes, matSettings);
    });

    gltf.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true;
        }
    });

    gltf.scene.position.set(0, 2.2, 0);

    scene.add(gltf.scene);
});

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(1.5, 1, 4);
directionalLight.visible = settings.directionalLight;
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 20;
directionalLight.shadow.camera.left = -5;
directionalLight.shadow.camera.right = 5;
directionalLight.shadow.camera.top = 5;
directionalLight.shadow.camera.bottom = -5;
scene.add(directionalLight);

const pointerLightsGroup = new THREE.Group();
scene.add(pointerLightsGroup);

const pointerLight = new THREE.PointLight(0xfaed00, 2.5);
pointerLight.position.set(-5, -5, 3);
pointerLight.visible = settings.pointLight1;
pointerLightsGroup.add(pointerLight);

const pointerLight2 = new THREE.PointLight(0xffffff, 2.5);
pointerLight2.position.set(1, 4, 3);
pointerLight2.visible = settings.pointLight2;
pointerLightsGroup.add(pointerLight2);

const pointerLight3 = new THREE.PointLight(0xffffff, 10.5);
pointerLight3.position.set(-1, -2, 1);
pointerLight3.visible = settings.pointLight3;
pointerLightsGroup.add(pointerLight3);

const floorGeometry = new THREE.PlaneGeometry(20, 20);

const floor = new THREE.Mesh(floorGeometry);
floor.rotation.x = -Math.PI / 2;
floor.visible = settings.floor;
floor.receiveShadow = true;
floor.position.set(-1, 0, -1);
scene.add(floor);

applyMaterialGroup('Floor', [floor], settings.materials.floor);

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
sceneFolder.add(settings, 'floor').onChange((v: boolean) => {
    floor.visible = v;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
gui.close();

renderer.setAnimationLoop((now: number) => {
    timer.update(now);

    pointerLightsGroup.rotation.y += timer.getDelta() * 0.5;

    if (head && headBaseRotation) {
        const maxYaw = -0.3;
        const maxPitch = -0.3;
        const maxRoll = -0.95;
        const targetY = headBaseRotation.y + mouse.x * maxYaw;
        const targetX = headBaseRotation.x - mouse.y * maxPitch;
        const targetZ = headBaseRotation.z + mouse.x * maxRoll;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetY, 0.1);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetX, 0.1);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetZ, 0.1);
    }

    renderer.render(scene, camera);
});
