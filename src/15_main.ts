import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

/**
 * https://business.tango.me/video/about-milestones-bg.mp4
 * https://business.tango.me/video/careers-dna-bg.mp4
 */

const scene = new THREE.Scene();
const gui = new GUI();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(-2, 0, 4);
camera.lookAt(-2, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.querySelector('#app')?.appendChild(renderer.domElement);

let aspect: number = 1.9;
let bgMaterial: THREE.MeshBasicMaterial | null = null;
const loader = new THREE.TextureLoader();
loader.load('bg.jpg', (texture) => {
    aspect = texture.image.width / texture.image.height;
    const bgPlate = new THREE.PlaneGeometry(20, 20 / aspect);

    texture.colorSpace = THREE.SRGBColorSpace;
    scene.environment = texture;

    bgMaterial = new THREE.MeshBasicMaterial({ map: texture });
    bgMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.fragmentShader =
            'uniform float uTime;\n' +
            shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
        #ifdef USE_MAP
        vec2 uv = vMapUv;
        float wave = sin((vMapUv.x + vMapUv.y) * 2.0 + uTime) * 0.03
                   + sin(vMapUv.x * 2.0 + uTime * 1.5) * 0.01
                   + sin(vMapUv.y * 1.0 + uTime * 0.7) * 0.015;
        uv.x += wave;
        uv.y += wave;
        vec4 sampledDiffuseColor = texture2D(map, uv);
        diffuseColor *= sampledDiffuseColor;
        #endif
        `,
            );
        bgMaterial!.userData.shader = shader;
    };
    const bgMesh = new THREE.Mesh(bgPlate, bgMaterial);
    bgMesh.position.z = -3;
    scene.add(bgMesh);
});

const settings = {
    wireframe: false,
    transmission: 1,
    roughness: 0.409,
    thickness: 0.106,
    ior: 1.0425,
    reflectivity: 0.053,
    emissiveIntensity: 0,
    emissiveColor: '#caf0fe',
    flatShading: false,
    metalness: 0,
};

const stored = localStorage.getItem('shaderSettings');
if (stored) {
    try {
        Object.assign(settings, JSON.parse(stored));
    } catch {}
}
gui.onChange(() => localStorage.setItem('shaderSettings', JSON.stringify(settings)));

const wavePlate = new THREE.PlaneGeometry(20, 20 / aspect, 100, 100);
const waveMaterial = new THREE.MeshPhysicalMaterial({
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
const waveMesh = new THREE.Mesh(wavePlate, waveMaterial);
waveMesh.position.z = 1;
waveMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };

    shader.vertexShader =
        'uniform float uTime;\n' +
        shader.vertexShader
            .replace(
                '#include <beginnormal_vertex>',
                `
      #include <beginnormal_vertex>
      float dzdx = cos((position.x + position.y) * 2.0 + uTime) * 0.3 * 2.0
                 + cos(position.x * 2.0 + uTime * 1.5) * 0.1 * 5.0;
      float dzdy = cos((position.x + position.y) * 2.0 + uTime) * 0.3 * 2.0
                 + cos(position.y * 1.0 + uTime * 0.7) * 0.15 * 3.0;
      vec3 tangentX = normalize(vec3(1.0, 0.0, dzdx));
      vec3 tangentY = normalize(vec3(0.0, 1.0, dzdy));
      objectNormal = normalize(cross(tangentY, tangentX));
      `,
            )
            .replace(
                '#include <begin_vertex>',
                `
      #include <begin_vertex>
      float waveZ = sin((position.x + position.y) * 2.0 + uTime) * 0.3
                  + sin(position.x * 2.0 + uTime * 1.5) * 0.1
                  + sin(position.y * 1.0 + uTime * 0.7) * 0.15;
      transformed.z += waveZ;
      `,
            );

    waveMaterial.userData.shader = shader;
};

scene.add(waveMesh);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(1.5, 1, 4);
scene.add(directionalLight);

const pointerLight = new THREE.PointLight(0xfaed00, 2.5);
pointerLight.position.set(-5, -5, 5);
scene.add(pointerLight);

const pointerLight2 = new THREE.PointLight(0xffffff, 2.5);
pointerLight2.position.set(1, 4, 6);
scene.add(pointerLight2);

const pointerLight3 = new THREE.PointLight(0xffffff, 10.5);
pointerLight3.position.set(-1, -2, 3);
scene.add(pointerLight3);

const matFolder = gui.addFolder('Material');
matFolder.add(settings, 'transmission', 0, 1).onChange((v: number) => {
    waveMaterial.transmission = v;
});
matFolder.add(settings, 'roughness', 0, 1).onChange((v: number) => {
    waveMaterial.roughness = v;
});
matFolder.add(settings, 'thickness', 0, 2).onChange((v: number) => {
    waveMaterial.thickness = v;
});
matFolder.add(settings, 'ior', 1, 2.5).onChange((v: number) => {
    waveMaterial.ior = v;
});
matFolder.add(settings, 'reflectivity', 0, 1).onChange((v: number) => {
    waveMaterial.reflectivity = v;
});
matFolder.add(settings, 'emissiveIntensity', 0, 2).onChange((v: number) => {
    waveMaterial.emissiveIntensity = v;
});
matFolder.add(settings, 'metalness', 0, 1).onChange((v: number) => {
    waveMaterial.metalness = v;
});
matFolder.add(settings, 'wireframe').onChange((v: boolean) => {
    waveMaterial.wireframe = v;
});
matFolder.add(settings, 'flatShading').onChange((v: boolean) => {
    waveMaterial.flatShading = v;
    waveMaterial.needsUpdate = true;
});
matFolder.addColor(settings, 'emissiveColor').onChange((v: string) => {
    waveMaterial.emissive.set(v);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
    const now = performance.now();

    if (waveMaterial.userData.shader) {
        waveMaterial.userData.shader.uniforms.uTime.value = now / 1000;
    }
    if (bgMaterial?.userData.shader) {
        bgMaterial.userData.shader.uniforms.uTime.value = now / 1000;
    }
    renderer.render(scene, camera);
});
