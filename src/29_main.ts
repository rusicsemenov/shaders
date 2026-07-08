import './style.css';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { ShaderCanvas } from './ShaderCanvas';

const documentElement = document.documentElement;

const params = {
    background: '#08060d',
    gridSize: 300,
    pointDistance: 6.5,
};

documentElement.style.setProperty('--bg', params.background);

const overlay = document.createElement('div');
overlay.innerText = 'Give your site a living background';
overlay.classList.add('overlay');
overlay.style.color = 'white';
overlay.style.textAlign = 'center';
overlay.style.lineHeight = '1.2';
overlay.style.letterSpacing = '3px';
overlay.style.maxWidth = '1600px';
overlay.style.margin = '0 auto';
document.body.appendChild(overlay);

const vertexShader = `
    attribute vec3 position;
    varying float vDepth;
    varying float vAlpha;

    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec3 iCameraPos;

    // ── Value noise (Perlin-like) ──────────────────────────────────────────
    float hash(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
    }
    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(hash(i), hash(i+vec3(1,0,0)), u.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), u.x), u.y),
            mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), u.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), u.x), u.y),
            u.z
        );
    }
    // ──────────────────────────────────────────────────────────────────────

    void main() {
        float aspectX = max(iResolution.x / iResolution.y, 1.0);
        float aspectY = max(iResolution.y / iResolution.x, 1.0);

        vec3 pos = position;

        // ── plane noise: waves along Y ────────────────────────────────────
        float pNoise = noise(vec3(position.xz * 3.0, iTime * 0.01)) * 0.1;
        pos.y += sin(pos.x * 3.0 + iTime * 1.5) * pNoise;
        // ── comment out the two lines above to disable plane noise ─────────

        // ── lookAt(0,0,0): rotate world-space position into camera space ──
        vec3 camForward = normalize(-iCameraPos);
        vec3 camRight   = normalize(cross(vec3(0.0, 1.0, 0.0), camForward));
        vec3 camUp      = cross(camForward, camRight);
        vec3 viewPos    = vec3(dot(pos, camRight), dot(pos, camUp), dot(pos, camForward));

        vDepth = viewPos.z;

        float cameraZ = 2.0;
        float perspW  = (cameraZ - viewPos.z) / cameraZ;

        float nearnessZ = (1.5 - sin(viewPos.z * 2.0)) / 2.0;       // 0 = far edge, 1 = near edge
        float nearnessX = 1.0 - abs(viewPos.x) / 5.2;    // 0 = side edges, 1 = center
        float nearness = nearnessZ * nearnessX;

        vAlpha = nearness * nearness;

        gl_PointSize = 3.0 * nearness;

        gl_Position = vec4(viewPos.x / aspectX, viewPos.y / aspectY, viewPos.z, perspW);
    }
`;

const fragmentShader = `
    precision mediump float;

    varying float vDepth;
    varying float vAlpha;

    void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.8, 0.1, dist);

        float brightness = 0.5 - vDepth * 0.4;
        vec3 col = vec3(0.3, 0.6, 1.0) * brightness;

        gl_FragColor = vec4(col, 1.0);
    }
`;

// ─── Plane (regular grid) ─────────────────────────────────────────────────────

const planeY = 0.0;

function buildPlane(gridSize: number): Float32Array {
    const plane = new Float32Array(gridSize * gridSize * 3);
    const planeExtent = params.pointDistance;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const idx = (row * gridSize + col) * 3;
            plane[idx] = (col / (gridSize - 1)) * planeExtent - planeExtent * 0.5;
            plane[idx + 1] = planeY - (row / gridSize) * 1.5;
            plane[idx + 2] =
                (row / (gridSize - 1)) * 5 * planeExtent - (planeExtent * col) / gridSize;
        }
    }

    return plane;
}

// ─── (Re)create the canvas ────────────────────────────────────────────────────

let canvas: ShaderCanvas | null = null;

function rebuild(): void {
    const particles = buildPlane(params.gridSize);

    canvas?.destroy();
    try {
        canvas = new ShaderCanvas('#app', {
            fragmentShader,
            vertexShader,
            particles,
            uniforms: { iCameraPos: { value: [3.0, 4.0, 10.0] } },
        });
    } catch (_error) {
        console.log('WebGL не поддерживается в этом браузере', _error);
    }
}

rebuild();

// ─── GUI ──────────────────────────────────────────────────────────────────────

const gui = new GUI();
gui.addColor(params, 'background').onChange((v: string) => {
    documentElement.style.setProperty('--bg', v);
});
gui.add(params, 'gridSize', 2, 500, 1).name('grid size').onFinishChange(rebuild);
gui.add(params, 'pointDistance', 0.1, 10, 0.1).name('point distance').onFinishChange(rebuild);
gui.close();
