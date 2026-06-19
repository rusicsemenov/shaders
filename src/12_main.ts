import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

const documentElement = document.documentElement;
documentElement.style.setProperty('--bg', `#08060d`);

const vertexShader = `
    attribute vec3 position;
    attribute float a_type;
    varying float vType;
    varying float vAlpha;
    varying float vScrolledZ;

    uniform vec3 iResolution;
    uniform float iTime;

    void main() {
        float zFar    = -18.0;
        float zNear   = -0.5;
        float depth   = zNear - zFar;
        float speed   = 3.0;
        float cameraZ = 5.0;

        float scrolledZ = zFar + mod(position.z - zFar + iTime * speed, depth);

        // Cylindrical bend: compresses X at edges
        float kx = 0.16;
        float bentX = sin(position.x * kx) / kx;

        // Y curvature: top edges droop down, bottom edges lift up
        float bendSign = (a_type < 0.5) ? -1.0 : 1.0;
        float bentY = position.y + position.x * position.x * 0.045 * bendSign;

        vec3 pos = vec3(bentX, bentY, scrolledZ);

        vType      = a_type;
        vScrolledZ = scrolledZ;

        float dist   = cameraZ - scrolledZ;
        float perspW = dist / cameraZ;
        float aspect = iResolution.x / iResolution.y;

        // 0 = far (horizon), 1 = near (camera)
        float t = (scrolledZ - zFar) / depth;

        float fadeFar  = clamp(t * 5.0, 0.0, 1.0);
        float fadeNear = clamp((1.0 - t) * 12.0, 0.0, 1.0);
        float screenX  = pos.x / perspW / aspect;
        float screenY  = pos.y / perspW;
        float fadeX    = smoothstep(1.0, 0.6, abs(screenX));
        vAlpha = fadeFar * fadeNear * fadeX;

        gl_PointSize = clamp(7.0 / perspW, 1.0, 10.0);

        float angle = iTime * -0.3;
        // float angle = sin(iTime * 0.3) * 0.2;
        mat2 rot = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
        vec2 rotated = rot * vec2(screenX, screenY);

        float ndcZ = 2.0 * t - 1.0;
        gl_Position = vec4(rotated, ndcZ, 1.0);
    }
`;

const fragmentShader = `
    precision mediump float;

    varying float vType;
    varying float vAlpha;
    varying float vScrolledZ;

    void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.1, dist);

        float nearnessZ = clamp(-vScrolledZ / 18.0, 0.0, 1.0);
        float brightness = 1.0 - nearnessZ * 0.6;

        vec3 topColor    = vec3(0.2, 0.6, 1.0) * brightness * 2.0;
        vec3 bottomColor = vec3(0.5, 0.3, 1.0) * brightness * 2.0;

        vec3 col = mix(topColor, bottomColor, vType);
        gl_FragColor = vec4(col, alpha * vAlpha);
    }
`;

// Two horizontal planes: top at Y=+planeHeight, bottom at Y=-planeHeight
// Both extend from zNear to zFar along Z (depth)
const rowsCount = 30; // Z resolution
const columnCount = 60; // X resolution
const planeWidth = 9.0; // total X span (-2.5 to +2.5)
const planeHeight = 1.2; // camera sits between planes at Y=0
const zNear = -0.5;
const zFar = -18.0;

const topPlane = new Float32Array(rowsCount * columnCount * 3);
for (let row = 0; row < rowsCount; row++) {
    for (let col = 0; col < columnCount; col++) {
        const idx = (row * columnCount + col) * 3;
        topPlane[idx] = (col / (columnCount - 1)) * planeWidth - planeWidth / 2;
        topPlane[idx + 1] = planeHeight;
        topPlane[idx + 2] = zNear + (row / (rowsCount - 1)) * (zFar - zNear);
    }
}

const bottomPlane = new Float32Array(rowsCount * columnCount * 3);
for (let row = 0; row < rowsCount; row++) {
    for (let col = 0; col < columnCount; col++) {
        const idx = (row * columnCount + col) * 3;
        bottomPlane[idx] = (col / (columnCount - 1)) * planeWidth - planeWidth / 2;
        bottomPlane[idx + 1] = -planeHeight;
        bottomPlane[idx + 2] = zNear + (row / (rowsCount - 1)) * (zFar - zNear);
    }
}

const particles = new Float32Array(topPlane.length + bottomPlane.length);
particles.set(topPlane, 0);
particles.set(bottomPlane, topPlane.length);

const pointCount = rowsCount * columnCount;
const types = new Float32Array(pointCount * 2);
types.fill(0, 0, pointCount);
types.fill(1, pointCount);

try {
    new ShaderCanvas('#app', {
        fragmentShader,
        vertexShader,
        particles,
        attributes: { a_type: { data: types, size: 1 } },
    });
} catch (_error) {
    console.log('WebGL not supported', _error);
}
