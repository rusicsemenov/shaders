import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

const vertexShader = `
    attribute vec3 position;
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

        float isPlane = 1.0 - step(-0.35, position.y);
        vType = 1.0 - isPlane;

        vec3 pos = position;

        // ── шум шара: смещает точки вдоль нормали ─────────────────────────
        vec3  sNorm  = normalize(position - vec3(0.0, 0.2, 0.0));
        float sNoise = noise(position * 4.0 + iTime * 0.4) * 0.12;
        pos += sNorm * sNoise * (1.0 - isPlane);
        // ── закомментируй три строки выше чтобы отключить шум шара ────────

        // ── шум плоскости: волны по Y ──────────────────────────────────────
        float pNoise = noise(vec3(position.xz * 3.0, iTime * 0.5)) * 0.06;
        pos.y += pNoise * isPlane;
        // ── закомментируй две строки выше чтобы отключить шум плоскости ───

        float t = iTime * 0.3;
        float rotX = pos.x * cos(t) + pos.z * sin(t);
        float rotZ = -pos.x * sin(t) + pos.z * cos(t);

        float finalX = mix(rotX, pos.x, isPlane);
        float finalZ = mix(rotZ, pos.z, isPlane);
        vDepth = finalZ;

        float cameraZ = 2.0;
        float perspW  = (cameraZ - position.z) / cameraZ;

        float nearness = (position.z + 0.9) / 1.8;
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
        float alpha = smoothstep(0.5, 0.2, dist);

        float brightness = 1.0 - vDepth * 0.4;

        vec3 sphereColor = vec3(0.2, 0.6, 1.0) * brightness;
        vec3 planeColor  = vec3(0.3, 0.9, 0.5) * brightness * 0.6;

        vec3 col = mix(planeColor, sphereColor, vType);
        gl_FragColor = vec4(col, alpha * vAlpha);
    }
`;

// ─── Sphere (golden ratio distribution) ──────────────────────────────────────

const sphereCount   = 5000;
const sphereR       = 0.5;
const sphereCenterY = 0.2;
const sphere        = new Float32Array(sphereCount * 3);

for (let i = 0; i < sphereCount; i++) {
    const phi   = Math.acos(1 - (2 * i) / sphereCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    sphere[i * 3]     = sphereR * Math.sin(phi) * Math.cos(theta);
    sphere[i * 3 + 1] = sphereR * Math.sin(phi) * Math.sin(theta) + sphereCenterY;
    sphere[i * 3 + 2] = sphereR * Math.cos(phi);
}

// ─── Plane (regular grid) ─────────────────────────────────────────────────────

const gridSize    = 60; // 60x60 = 3600 точек
const planeY      = -0.4;
const planeExtent = 0.9;
const plane       = new Float32Array(gridSize * gridSize * 3);

for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
        const idx      = (row * gridSize + col) * 3;
        plane[idx]     = (col / (gridSize - 1)) * 2 * planeExtent - planeExtent;
        plane[idx + 1] = planeY;
        plane[idx + 2] = (row / (gridSize - 1)) * 2 * planeExtent - planeExtent;
    }
}

// ─── Combine ──────────────────────────────────────────────────────────────────

const particles = new Float32Array(sphere.length + plane.length);
particles.set(sphere, 0);
particles.set(plane, sphere.length);

new ShaderCanvas('#app', { fragmentShader, vertexShader, particles });
