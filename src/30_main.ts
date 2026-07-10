import './style.css';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { ShaderCanvas } from './ShaderCanvas';

// https://newxel.com

const documentElement = document.documentElement;

const params = {
    background: '#ffffff',
    lineColor: '#2929d9',
    hoverColor: '#2626ed',
};

const overlay = document.createElement('div');
overlay.innerText = 'Give your site a living background';
overlay.classList.add('overlay');
overlay.style.color = 'var(--lineColor)';
overlay.style.textAlign = 'center';
overlay.style.lineHeight = '1.2';
overlay.style.letterSpacing = '3px';
overlay.style.maxWidth = '1600px';
overlay.style.margin = '0 auto';
document.body.appendChild(overlay);

documentElement.style.setProperty('--bg', params.background);
documentElement.style.setProperty('--lineColor', params.lineColor);

function hexToVec3(hex: string): number[] {
    const n = Number.parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const fragmentShader = /*language=GLSL*/ `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;

    uniform vec3 iResolution;
    uniform float iTime;
    uniform float iSpeed;
    uniform float iCellSize;
    uniform float iCameraHeight;
    uniform float iTilt;
    uniform float iLineWidth;
    uniform float iFadeRate;
    uniform vec3 iLineColor;
    uniform vec3 iBaseColor;
    uniform vec2 iMouse;
    uniform vec3 iHoverColor;

//    vec3 edgeColor = vec3(0.161, 0.161, 0.851);
    vec3 edgeColor = iLineColor;
    vec3 baseColor = iBaseColor;

    void main() {
        vec2 uv = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
        uv.x *= iResolution.x / iResolution.y;

        // ── camera basis: flying forward, pitched down toward the floor ────
        vec3 forward = normalize(vec3(0.0, -iTilt, 1.0));
        vec3 right   = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
        vec3 up      = cross(forward, right);
        vec3 rd      = normalize(forward + uv.x * right + uv.y * up);
        vec3 camPos  = vec3(0.0, iCameraHeight, 0.0);

        // ── mouse ray: which grid cell is the cursor hovering? ──────────────
        vec3 mouseRd = normalize(forward + iMouse.x * right + iMouse.y * up);
        vec2 hoveredCell = vec2(1e6);
        if (mouseRd.y < -0.01) {
            float mt = -camPos.y / mouseRd.y;
            vec3 mouseHit = camPos + mouseRd * mt;
            vec2 mouseCoord = mouseHit.xz / iCellSize;
            mouseCoord.y += iTime * iSpeed / iCellSize;
            hoveredCell = floor(mouseCoord);
        }

        // ── corner gradient: white center fading to edgeColor at the edges ──
        vec2 orUV = uv + 1.0;
        float g = clamp((1.0 - orUV.y) + (1.0 - orUV.x), 0.0, 1.0);
        vec3 col = mix(baseColor, edgeColor, g * 0.1);

        // ── ray / floor-plane (y = 0) intersection ──────────────────────────
        if (rd.y < -0.01) {
            float t = -camPos.y / rd.y;
            vec3 hit = camPos + rd * t;

            vec2 coord = hit.xz / iCellSize;
            coord.y += iTime * iSpeed / iCellSize;

            vec2 distToLine = abs(fract(coord - 0.5) - 0.5);
            vec2 aa = fwidth(coord) * iLineWidth;
            vec2 lineAA = smoothstep(vec2(0.0), aa, distToLine);
            float gridLine = 1.0 - min(lineAA.x, lineAA.y);

            vec2 cell = floor(coord);
            float isHovered = step(abs(cell.x - hoveredCell.x) + abs(cell.y - hoveredCell.y), 0.5);

            float fade = exp(-t * iFadeRate);
            vec3 floorCol = mix(col, iLineColor, gridLine);
            floorCol = mix(floorCol, iHoverColor, isHovered);
            col = mix(col, floorCol, fade);
        }

        gl_FragColor = vec4(col, 1.0);
    }
`;

const uniforms = {
    iSpeed: { value: 0.4 },
    iCellSize: { value: 1.0 },
    iCameraHeight: { value: 0.6 },
    iTilt: { value: 0.02 },
    iLineWidth: { value: 1.0 },
    iFadeRate: { value: 0.2 },
    iLineColor: { value: hexToVec3(params.lineColor) },
    iBaseColor: { value: hexToVec3(params.background) },
    iMouse: { value: [1e6, 1e6] },
    iHoverColor: { value: hexToVec3(params.hoverColor) },
};

window.addEventListener('mousemove', (e) => {
    uniforms.iMouse.value = [
        (2 * e.clientX - window.innerWidth) / window.innerHeight,
        (window.innerHeight - 2 * e.clientY) / window.innerHeight,
    ];
});
window.addEventListener('mouseleave', () => {
    uniforms.iMouse.value = [1e6, 1e6];
});

try {
    new ShaderCanvas('#app', { fragmentShader, uniforms });
} catch (_error) {
    console.log('WebGL не поддерживается в этом браузере', _error);
}

// ─── GUI ──────────────────────────────────────────────────────────────────────

const gui = new GUI();
gui.addColor(params, 'background').onChange((v: string) => {
    documentElement.style.setProperty('--bg', v);
    uniforms.iBaseColor.value = hexToVec3(v);
});
gui.addColor(params, 'lineColor')
    .name('line color')
    .onChange((v: string) => {
        documentElement.style.setProperty('--lineColor', v);
        uniforms.iLineColor.value = hexToVec3(v);
    });
gui.addColor(params, 'hoverColor')
    .name('hover color')
    .onChange((v: string) => {
        uniforms.iHoverColor.value = hexToVec3(v);
    });
gui.add(uniforms.iSpeed, 'value', 0.1, 5, 0.1).name('speed');
gui.add(uniforms.iCellSize, 'value', 0.5, 5, 0.05).name('cell size');
gui.add(uniforms.iCameraHeight, 'value', 0.1, 3, 0.05).name('camera height');
gui.add(uniforms.iTilt, 'value', 0, 1, 0.01).name('tilt');
gui.add(uniforms.iLineWidth, 'value', 1, 4, 0.05).name('line width');
gui.add(uniforms.iFadeRate, 'value', 0.1, 0.3, 0.005).name('fade rate');
gui.close();
