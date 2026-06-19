import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0c0c);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.querySelector('#app')?.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(16, 10, 400, 250);

const material = new THREE.MeshStandardMaterial({
    color: 0xb2b2b2,
    metalness: 0.05,
    roughness: 0.3,
});

const uniforms = {
    uTime: { value: 0 },
    // большая синусоида — только как модулятор фазы, не добавляет высоту напрямую
    uBigFX: { value: 0.35 }, // частота по X
    uBigFY: { value: 0.25 }, // частота по Y
    uBigSpd: { value: 0.18 }, // скорость
    uBigMod: { value: 4.5 }, // сила изгиба мелких волн
    // мелкие рябь-волны поверх
    uW1Amp: { value: 0.12 },
    uW1FX: { value: 4.5 },
    uW1Spd: { value: 0.5 },
    uW2Amp: { value: 0.08 },
    uW2FX: { value: 6.5 },
    uW2Spd: { value: 0.35 },
    uW3Amp: { value: 0.06 },
    uW3FX: { value: 3.2 },
    uW3FY: { value: 0.5 },
    uW3Spd: { value: 0.6 },
};

material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader =
        `uniform float uTime;
uniform float uBigFX, uBigFY, uBigSpd, uBigMod;
uniform float uW1Amp, uW1FX, uW1Spd;
uniform float uW2Amp, uW2FX, uW2Spd;
uniform float uW3Amp, uW3FX, uW3FY, uW3Spd;

float waveFn(float px, float py) {
    // большая волна изгибает фазу мелких, не добавляя высоту сама
    float bigPhase = sin(px * uBigFX + py * uBigFY + uTime * uBigSpd) * uBigMod;

    return uW1Amp * sin(px * uW1FX + bigPhase            + uTime * uW1Spd)
         + uW2Amp * sin(px * uW2FX + bigPhase * 1.4      + uTime * uW2Spd)
         + uW3Amp * sin(px * uW3FX + bigPhase * 0.8
                      + py * uW3FY                       + uTime * uW3Spd);
}

// нормали через конечные разности — проще поддерживать при сложной формуле
vec3 waveNormal(float px, float py) {
    float eps = 0.05;
    float h0 = waveFn(px,       py      );
    float hx = waveFn(px + eps, py      );
    float hy = waveFn(px,       py + eps);
    return normalize(vec3(-(hx - h0) / eps, -(hy - h0) / eps, 1.0));
}
` +
        shader.vertexShader
            .replace(
                '#include <beginnormal_vertex>',
                `#include <beginnormal_vertex>
                objectNormal = waveNormal(position.x, position.y);`,
            )
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                transformed.z += waveFn(position.x, position.y);`,
            );
};

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const key = new THREE.DirectionalLight(0xffffff, 5.0);
key.position.set(2, 4, 6);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 2.0);
fill.position.set(-3, -2, 4);
scene.add(fill);

const gui = new GUI();

const big = gui.addFolder('Big wave (phase modulator)');
big.add(uniforms.uBigFX, 'value', 0, 2, 0.01).name('freq X');
big.add(uniforms.uBigFY, 'value', 0, 2, 0.01).name('freq Y');
big.add(uniforms.uBigSpd, 'value', 0, 1, 0.01).name('speed');
big.add(uniforms.uBigMod, 'value', 0, 12, 0.01).name('bend strength');

const ripple = gui.addFolder('Ripples');
ripple.add(uniforms.uW1Amp, 'value', 0, 0.5, 0.01).name('w1 amp');
ripple.add(uniforms.uW1FX, 'value', 0, 15, 0.01).name('w1 freq X');
ripple.add(uniforms.uW1Spd, 'value', 0, 2, 0.01).name('w1 speed');
ripple.add(uniforms.uW2Amp, 'value', 0, 0.5, 0.01).name('w2 amp');
ripple.add(uniforms.uW2FX, 'value', 0, 15, 0.01).name('w2 freq X');
ripple.add(uniforms.uW2Spd, 'value', 0, 2, 0.01).name('w2 speed');
ripple.add(uniforms.uW3Amp, 'value', 0, 0.5, 0.01).name('w3 amp');
ripple.add(uniforms.uW3FX, 'value', 0, 15, 0.01).name('w3 freq X');
ripple.add(uniforms.uW3FY, 'value', 0, 5, 0.01).name('w3 freq Y');
ripple.add(uniforms.uW3Spd, 'value', 0, 2, 0.01).name('w3 speed');

const matFolder = gui.addFolder('Material');
matFolder.add(material, 'metalness', 0, 1, 0.01);
matFolder.add(material, 'roughness', 0, 1, 0.01);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
    uniforms.uTime.value = performance.now() / 1000;
    renderer.render(scene, camera);
});
