import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

const vertexShader = `
    attribute vec3 position;
    attribute float a_type; // 0.0 = шар, 1.0 = плоскость
    varying float vDepth;
    varying float vType;
    varying float vAlpha;

    uniform vec3 iResolution;
    uniform float iTime;

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

        float isPlane = a_type;
        vType = 1.0 - isPlane;

        vec3 pos = position;

        // ── шум шара: смещает точки вдоль нормали ─────────────────────────
        vec3  sNorm  = normalize(position - vec3(0.0, 0.2, 0.0));
        float sNoise = noise(position * 8.0 + iTime * 0.4) * 0.2;
        pos += sNorm * sNoise * (1.0 - isPlane);
        // ── закомментируй три строки выше чтобы отключить шум шара ────────

        // ── шум плоскости: волны по Y ──────────────────────────────────────
        float pNoise = noise(vec3(position.xz * 3.0, iTime * 0.01)) * 0.1;
        pos.y += sin(pos.x * 3.0 + iTime * 1.5) * isPlane * pNoise;  
        // ── закомментируй две строки выше чтобы отключить шум плоскости ───

        float t = iTime * 0.3;
        float rotX = pos.x * cos(t) + pos.z * sin(t);
        float rotZ = -pos.x * sin(t) + pos.z * cos(t);

        float finalX = mix(rotX, pos.x, isPlane);
        float finalZ = mix(rotZ, pos.z, isPlane);
        vDepth = finalZ;

        float cameraZ = 2.0;
        float perspW  = (cameraZ - position.z) / cameraZ;

        float nearnessZ = (1.5 - sin(position.z * 2.0)) / 2.0;       // 0 = дальний край, 1 = ближний
        float nearnessX = 1.0 - abs(position.x) / 5.2;    // 0 = боковые края, 1 = центр
        float nearnessY = 1.0 - abs(position.y) / 1.3;    // 0 = боковые края, 1 = центр
        float nearnessR = 1.0 - length(position.xz) / 1.4; 
        float nearness = nearnessZ * nearnessX;

        vAlpha = mix(1.0, nearness * nearness, isPlane);

        float sphereSize = 2.5 * (1.2 - finalZ * 0.4);
        float planeSize  = 3.0 * nearness;
        gl_PointSize = mix(sphereSize, planeSize, isPlane);

        gl_Position = vec4(finalX / aspectX, pos.y / aspectY, finalZ, mix(1.0, perspW, isPlane));
    }
`;

const fragmentShader = `
    precision mediump float;

    varying float vDepth;
    varying float vType;
    varying float vAlpha;

    void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.8, 0.1, dist);

        float brightness = 0.5 - vDepth * 0.4;

        vec3 sphereColor = vec3(0.2, 0.6, 1.0) * brightness * 1.2;
        vec3 planeColor  = vec3(0.3, 0.6, 1.0) * brightness;

        vec3 col = mix(planeColor, sphereColor, vType);
        gl_FragColor = vec4(col, alpha * vAlpha);
    }
`;

// ─── Sphere (golden ratio distribution) ──────────────────────────────────────

const sphereCount = 3000;
const sphereR = 0.3;
const sphereCenterY = 0.2;
const sphere = new Float32Array(sphereCount * 3);

for (let i = 0; i < sphereCount; i++) {
    const phi = Math.acos(1 - (2 * i) / sphereCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    sphere[i * 3] = sphereR * Math.sin(phi) * Math.cos(theta);
    sphere[i * 3 + 1] = sphereR * Math.sin(phi) * Math.sin(theta) + sphereCenterY;
    sphere[i * 3 + 2] = sphereR * Math.cos(phi);
}

// ─── Plane (regular grid) ─────────────────────────────────────────────────────

const gridSize = 100; // 60x60 = 3600 точек
const planeY = -0.5;
const planeExtent = 1.9;
const plane = new Float32Array(gridSize * gridSize * 3);

for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
        const idx = (row * gridSize + col) * 3;
        plane[idx] = (col / (gridSize - 1)) * 3 * planeExtent - planeExtent * 1.5;
        plane[idx + 1] = planeY - (row / gridSize) * 0.8; // slight vertical offset to prevent z-fighting
        plane[idx + 2] = (row / (gridSize - 1)) * 2 * planeExtent - planeExtent;
    }
}

// ─── Combine ──────────────────────────────────────────────────────────────────

const particles = new Float32Array(sphere.length + plane.length);
particles.set(sphere, 0);
particles.set(plane, sphere.length);

// 0.0 = шар, 1.0 = плоскость — по одному float на каждую точку
const types = new Float32Array(sphereCount + gridSize * gridSize);
types.fill(0, 0, sphereCount);
types.fill(1, sphereCount);

new ShaderCanvas('#app', {
    fragmentShader,
    vertexShader,
    particles,
    attributes: { a_type: { data: types, size: 1 } },
});
