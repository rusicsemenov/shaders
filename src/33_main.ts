import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const scene = new THREE.Scene();
const gui = new GUI();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(1.5, 2, 10);
camera.lookAt(0, 2, 0);

const isMobile = /Mobi|Android/i.test(navigator.userAgent);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#app')?.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.update();

const bgGeometry = new THREE.PlaneGeometry(200, 200);

const fragmentShader = `
    #ifdef GL_ES
    precision mediump float;
    #endif
    
    uniform vec3 iResolution;
    uniform float iTime;
    
    float random (in vec2 _st) {
        return fract(sin(dot(_st.xy,
                             vec2(12.9898,78.233)))*
                             43758.5453123);
    }
    
    // Based on Morgan McGuire @morgan3d
    // https://www.shadertoy.com/view/4dS3Wd
    float noise (in vec2 _st) {
        vec2 i = floor(_st);
        vec2 f = fract(_st);
    
        // Four corners in 2D of a tile
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
    
        vec2 u = f * f * f * (3.0 - 2.0 * f);
    
        return mix(a, b, u.x) +
                (c - a)* u.y * (1.0 - u.x) +
                (d - b) * u.x * u.y;
    }
    
    #define NUM_OCTAVES ${isMobile ? 3 : 5}
    
    float fbm ( in vec2 _st) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        // Rotate to reduce axial bias
        mat2 rot = mat2(cos(0.5), sin(0.5),
                        -sin(0.5), cos(0.5));
        for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(_st);
            _st = rot * _st * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }
    
    void main() {
        vec2 st = gl_FragCoord.xy/iResolution.xy * 4.;
        // st += st * abs(sin(iTime*0.1)*3.0);
        vec3 color = vec3(0.0);
    
        vec2 q = vec2(0.);
        q.x = fbm( st + 0.02*iTime);
        q.y = fbm( st + vec2(1.0));
    
        vec2 r = vec2(0.);
        r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*iTime );
        r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*iTime);
    
        float f = fbm(st+r);
        
        color = mix(vec3(0.0745, 0.4863, 0.6471), 
                    vec3(0.0745, 0.0983, 0.1171),
                    clamp(f*f * 4.0, 0.0, 1.0));
    
        color = mix(color,
                    vec3(0.0345, 0.0203, 0.0471),
                    clamp(length(q),0.0,1.0));

        color = mix(color,
                    vec3(0.0745, 0.4863, 0.6471),
                    clamp(length(r.x),0.0,1.0));
    
        gl_FragColor = vec4((f*f*f + .3*f*f + .7*f)*color,1.);
    }
`;

const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3() },
};

uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1);
const material2 = new THREE.ShaderMaterial({
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
});

// const bgMaterial2 = new THREE.MeshLambertMaterial({ color: 0x020e3d, side: THREE.DoubleSide });
const bgMesh = new THREE.Mesh(bgGeometry, material2);
bgMesh.position.z = -10;
scene.add(bgMesh);

const loader = new GLTFLoader();

let torus: THREE.Mesh | undefined;
let action: THREE.AnimationAction | undefined;
let brows: THREE.Mesh | undefined;
let body: THREE.Mesh | undefined;
let head: THREE.Mesh | undefined;
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
            wireframe: false,
            transmission: 1,
            roughness: 0.155,
            thickness: 1.366,
            ior: 2.5,
            reflectivity: 1,
            emissiveIntensity: 0,
            emissiveColor: '#000000',
            flatShading: true,
            metalness: 0,
        },
        brows: {
            wireframe: false,
            transmission: 1,
            roughness: 0.302,
            thickness: 1.04,
            ior: 1.9515,
            reflectivity: 0.938,
            emissiveIntensity: 0.31,
            emissiveColor: '#c4bc00',
            flatShading: true,
            metalness: 0.769,
        },
        t_shirt: {
            wireframe: false,
            transmission: 1,
            roughness: 0,
            thickness: 1.04,
            ior: 2.1165,
            reflectivity: 0.938,
            emissiveIntensity: 0,
            emissiveColor: '#11053b',
            flatShading: true,
            metalness: 0.314,
        },
        floor: {
            wireframe: false,
            transmission: 1,
            roughness: 0.474,
            thickness: 1.17,
            ior: 1.158,
            reflectivity: 0.314,
            emissiveIntensity: 0.01,
            emissiveColor: '#caf0fe',
            flatShading: false,
            metalness: 0.4,
        },
    },
    directionalLight: true,
    pointLight1: true,
    pointLight2: true,
    pointLight3: true,
    circle: false,
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

let mixer: THREE.AnimationMixer | undefined;

loader.load('/onlymonster-dance.glb', (gltf: GLTF) => {
    console.log(gltf);

    torus = gltf.scene.getObjectByName('Armature') as THREE.Mesh;
    brows = gltf.scene.getObjectByName('brows') as THREE.Mesh;
    body = gltf.scene.getObjectByName('body') as THREE.Mesh;
    head = gltf.scene.getObjectByName('head') as THREE.Mesh;
    tail = gltf.scene.getObjectByName('tail') as THREE.Mesh;
    t_shirt = gltf.scene.getObjectByName('T-shirt') as THREE.Mesh;

    console.log(brows);

    if (!torus) {
        console.error('THREE.Torus not found.');
        return;
    }

    const meshGroups = [
        { label: 'Body', meshes: [body, head, tail], settings: settings.materials.body },
        { label: 'Brows', meshes: [brows], settings: settings.materials.brows },
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

    scene.add(gltf.scene);

    mixer = new THREE.AnimationMixer(gltf.scene);

    action = mixer.clipAction(gltf.animations[0]);

    action.play();
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

const reflector = new Reflector(new THREE.PlaneGeometry(50, 50), {
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
    color: 0x889999,
});
reflector.rotation.x = -Math.PI / 2;
reflector.position.set(-1, -0.01, -1);
scene.add(reflector);

const floorGeometry = new THREE.PlaneGeometry(50, 50);
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
sceneFolder.add(settings, 'circle').onChange((v: boolean) => {
    circle.visible = v;
});
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
    uniforms.iTime.value = now / 1000;

    if (mixer) {
        mixer.update(timer.getDelta());
    }

    controls.update();
    renderer.render(scene, camera);
});
