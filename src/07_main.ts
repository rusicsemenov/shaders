import './style.css';
import * as THREE from 'three';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, -3, 4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.querySelector('#app')?.appendChild(renderer.domElement);

// const geometry = new THREE.PlaneGeometry(20, 20, 2000, 2000);
const geometry = new THREE.SphereGeometry(2, 5, 2000);

const vertexShader = `
    uniform float iTime;
    uniform float amplitude;

    varying float vDisplace;

    #define N 10.0
    #define k 2.0

    void main() {
        float angle  = atan(position.y, position.x);
        float radius = length(position.xy);

        float d = sin((angle + radius * sin(k * iTime * 0.05) * 2.0) * N);
        vDisplace = d;

        vec3 displaced = position + normal * d * amplitude;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
`;

const fragmentShader = `
    uniform float iTime;

    varying float vDisplace;

    vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263, 0.416, 0.557);
        return a + b * cos(6.28318 * (c * t + d));
    }

    void main() {
        float t = vDisplace * 0.15 + 0.5;
        vec3 col = palette(t + iTime * 0.2);
        gl_FragColor = vec4(col, 1.0);
    }
`;

const uniforms = {
    iTime: { value: 0 },
    amplitude: { value: 0.25 },
};

const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
});

scene.add(new THREE.Mesh(geometry, material));

const timer = new THREE.Timer();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
    timer.update();
    uniforms.iTime.value = timer.getElapsed();
    renderer.render(scene, camera);
});
