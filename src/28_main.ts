import './style.css';
import { ShaderCanvas } from './ShaderCanvas';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const overlay = document.createElement('div');

overlay.innerText = 'Give your site a living background';
overlay.classList.add('overlay');
overlay.style.color = 'white';
overlay.style.textAlign = 'center';
overlay.style.lineHeight = '1.2';
overlay.style.letterSpacing = '1.2px';
overlay.style.maxWidth = '1600px';
overlay.style.margin = '0 auto';
document.body.appendChild(overlay);

function hexToRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const params = {
    strandMax: 200,
    strandCount: 100,
    bokehMax: 8,
    dynamicColor: false,
    rodColor: '#4080f2',
    background: '#0d121c',
    fadeStart: 1.8,
    fadeEnd: 2.9,
    rodWidth: 0.031,
    scatterRadius: 1.67,
    zoom: 0.92,
    panX: 0.65,
    panY: 0.24,
    fresnelIntensity: 0.82,
    specularIntensity: 3.0,
};

// STRAND_MAX / BOKEH_MAX are GLSL compile-time loop bounds (GLSL ES 1.00
// requires constant loop bounds), so changing them rebuilds the shader.
// STRAND_COUNT just breaks the loop early via a uniform, same as the rope
// shader's uRopeCount — no rebuild needed for that one.
function buildFragmentShader(strandMax: number, bokehMax: number): string {
    return /*language=GLSL*/ `
    precision highp float;
    uniform vec3 iResolution;
    uniform float iTime;
    uniform float uStrandCount;
    uniform float uDynamicColor; // > 0.5 = per-rod animated hue, otherwise uRodColor is used
    uniform vec3 uRodColor;
    uniform vec3 uBgColor;
    uniform float uFadeStart;
    uniform float uFadeEnd;
    uniform float uRodWidth;
    uniform float uScatterRadius;
    uniform float uZoom;
    uniform vec2 uPan;
    uniform float uFresnelIntensity;
    uniform float uSpecularIntensity;

    const int STRAND_MAX = ${strandMax};
    const int BOKEH_MAX = ${bokehMax};
    const int GLINT_MAX = 2;

    float hash11(float n) {
        return fract(sin(n) * 43758.5453123);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
        return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec2 p = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
        p.x *= iResolution.x / iResolution.y;

        // Camera: zoom > 1 moves in, uPan shifts the view (in world-space units)
        p = p / uZoom + uPan;

        // --- Background: faint blue haze near center, dark toward edges ---
        vec3 bgCenter = uBgColor;
        vec3 bgEdge   = uBgColor * 0.16;
        float distFromCenter = length(p);
        vec3 col = mix(bgCenter, bgEdge, smoothstep(0.0, 1.4, distFromCenter));

        // --- Pseudo lights: soft drifting bokeh blobs behind the strand ---
        for (int i = 0; i < BOKEH_MAX; i++) {
            float fi = float(i);
            float hx = hash11(fi * 12.9898);
            float hy = hash11(fi * 78.233 + 4.0);
            float hs = hash11(fi * 45.164 + 8.0);
            float hp = hash11(fi * 33.71 + 15.0);

            vec2 basePos = vec2((hx - 0.5) * 3.4, (hy - 0.5) * 2.6);
            float drift = sin(iTime * 0.06 + hp * 6.283) * 0.08;
            vec2 pos = basePos + vec2(drift, drift * 0.5);

            float radius = mix(0.09, 0.24, hs);
            float d = length(p - pos);
            float blob = exp(-(d * d) / (radius * radius));

            // Mostly blue/teal, with warm pink/magenta accents thrown in
            vec3 blobColor = mod(fi, 3.0) < 0.5 ? vec3(0.95, 0.35, 0.55) : vec3(0.2, 0.55, 0.95);
            col += blobColor * blob * 0.3;
        }

        // --- Fiberglass strand(s) ---
        float rodWidth     = uRodWidth;
        float scatterRadius = uScatterRadius; // how far tips spread out around the center
        vec2  origin = vec2(-0.5, -2.1); // shared base point, off the bottom edge

        for (int s = 0; s < STRAND_MAX; s++) {
            if (float(s) >= uStrandCount) break;

            float fs = float(s);
            float angle = hash11(fs * 17.13 + 50.0) * 6.28318;
            float rad   = sqrt(hash11(fs * 9.71 + 60.0)) * scatterRadius; // sqrt keeps density uniform across the disc
            vec2 tip  = vec2(cos(angle), sin(angle)) * rad; // scattered within a circle around center
            vec2 base = origin;                              // all strands fan from one point

            vec2 segDir = tip - base;
            float segLen = length(segDir);
            vec2 dirN = segDir / segLen;
            vec2 perp = vec2(-dirN.y, dirN.x);

            vec2 rel = p - base;
            float along = dot(rel, dirN);
            float t = clamp(along / segLen, 0.0, 1.0);

            // Cheap cull: distance from this pixel to the *unbent* straight rod.
            // Max bend is 0.3 and rod width tops out well under 0.1, so nothing
            // farther than that margin could be covered by this strand however
            // it ends up bending — skip the hashes/pow/exp below entirely.
            vec2 unbentPoint = base + dirN * (t * segLen);
            if (length(p - unbentPoint) > 0.5) continue;

            // Random pseudo-depth per strand: 0 = far back, 1 = close to camera.
            // Farther strands are thinner and dimmer, giving a fake sense of depth.
            float depth      = hash11(fs * 25.37 + 70.0);
            float depthScale = mix(0.15, 1.0, depth);
            float depthVis   = mix(0.12, 1.0, depth);

            float localRodWidth = rodWidth * depthScale;

            // Bend: each rod leans toward a random side by a random amount,
            // rooted firmly at the base and flexing more toward the tip, with
            // a gentle animated sway layered on top (like wind).
            float bendSign = hash11(fs * 13.7 + 90.0) > 0.5 ? 1.0 : -1.0;
            float bendAmt  = mix(0.05, 0.3, hash11(fs * 31.4 + 100.0));
            float sway     = sin(iTime * 0.5 + fs * 2.3) * bendAmt * 0.35;
            float bendCoeff = bendSign * bendAmt + sway;

            vec2 bentPoint = base + dirN * (t * segLen) + perp * (bendCoeff * t * t);
            vec2 bentTip   = tip + perp * bendCoeff;

            float d = length(p - bentPoint);

            // Antialiasing edge (tight, right at the rod boundary) kept separate
            // from the cross-section shading gradient below — otherwise the rim
            // glow and the body coverage fade out at the same distance and cancel.
            float aa = 0.0838 * depthScale;
            float body = smoothstep(localRodWidth, localRodWidth - aa, d) * depthVis;

            // Fake a rounded glass cross-section normal for rim + specular
            float edgeFactor = clamp(d / localRodWidth, 0.0, 1.0); // 0 at center, 1 at edge
            float nz = sqrt(1.0 - edgeFactor * edgeFactor);

            float fresnel  = edgeFactor * edgeFactor; // bright toward the curved edge
            float specular = pow(nz, 40.0);        // tight highlight down the center

            // Per-rod color: either a random hue per strand that slowly drifts
            // over time, or a fixed color — shared by the rim glow, hot core, and halo.
            float hue = fract(hash11(fs * 7.13 + 120.0) + iTime * 0.09);
            vec3 dynamicColor = hsv2rgb(vec3(hue, 0.6, 1.0));
            vec3 rodColor = mix(uRodColor, dynamicColor, uDynamicColor);

            vec3 rodBase = vec3(0.02, 0.022, 0.03); // near-black glass body

            col = mix(col, rodBase, body);
            col += rodColor * fresnel * body * uFresnelIntensity;
            col += rodColor * specular * body * uSpecularIntensity;

            // --- Glowing tip: hot core + soft halo, gently pulsing ---
            float pulse = 0.008 + 0.005 * sin(iTime * 1.3 + fs * 1.7);
            float tipDist = length(p - bentTip);
            float core = exp(-(tipDist * tipDist) / (0.00176 * pulse));
            float halo = exp(-(tipDist * tipDist) / (0.05 * pulse));

            col += mix(vec3(1.0), rodColor, 0.9) * core * 2.4 * depthVis;
            col += rodColor * halo * 0.4 * depthVis;

            // --- Glints: a couple of small bright highlights at random spots
            // along the rod, each flickering on its own random phase/speed.
            for (int g = 0; g < GLINT_MAX; g++) {
                float fg = float(g);
                float tGlint = hash11(fs * 3.3 + fg * 41.7 + 200.0);
                vec2 glintPos = base + dirN * (tGlint * segLen) + perp * (bendCoeff * tGlint * tGlint);

                float glintPhase = hash11(fs * 6.1 + fg * 17.3 + 210.0) * 16.28318;
                float glintSpeed = mix(0.5, 1.5, hash11(fs * 8.3 + fg * 5.1 + 220.0));
                float twinkle = pow(max(0.0, sin(iTime * glintSpeed + glintPhase)), 8.0);

                float gd = length(p - glintPos);
                float glint = exp(-(gd * gd) / 0.00001) * twinkle * depthVis;

                col += mix(vec3(1.0), rodColor, 0.3) * glint * 1.2;
            }
        }

        // --- Radial fade: the whole scene dims to black away from center ---
        float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, distFromCenter);
        col *= fade;

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
`;
}

const uniforms = {
    uStrandCount: { value: params.strandCount },
    uDynamicColor: { value: params.dynamicColor ? 1 : 0 },
    uRodColor: { value: hexToRgb(params.rodColor) },
    uBgColor: { value: hexToRgb(params.background) },
    uFadeStart: { value: params.fadeStart },
    uFadeEnd: { value: params.fadeEnd },
    uRodWidth: { value: params.rodWidth },
    uScatterRadius: { value: params.scatterRadius },
    uZoom: { value: params.zoom },
    uPan: { value: [params.panX, params.panY] },
    uFresnelIntensity: { value: params.fresnelIntensity },
    uSpecularIntensity: { value: params.specularIntensity },
};

let shaderCanvas: ShaderCanvas;

function createCanvas(): void {
    const fragmentShader = buildFragmentShader(params.strandMax, params.bokehMax);
    shaderCanvas = new ShaderCanvas('#app', { fragmentShader, uniforms });
}

function rebuildCanvas(): void {
    shaderCanvas.destroy();
    createCanvas();
}

createCanvas();

const gui = new GUI();
gui.close();

gui.add(params, 'strandCount', 1, params.strandMax, 1)
    .name('strand count')
    .onChange((v: number) => {
        uniforms.uStrandCount.value = v;
    });

gui.add(params, 'bokehMax', 0, 20, 1)
    .name('bokeh count (rebuild)')
    .onChange(() => {
        rebuildCanvas();
    });

gui.add(params, 'dynamicColor')
    .name('dynamic color')
    .onChange((v: boolean) => {
        uniforms.uDynamicColor.value = v ? 1 : 0;
    });

gui.addColor(params, 'rodColor')
    .name('rod color (static)')
    .onChange((v: string) => {
        uniforms.uRodColor.value = hexToRgb(v);
    });

gui.addColor(params, 'background')
    .name('background color')
    .onChange((v: string) => {
        uniforms.uBgColor.value = hexToRgb(v);
    });

gui.add(params, 'fadeStart', 0, 2, 0.01)
    .name('fade start radius')
    .onChange((v: number) => {
        uniforms.uFadeStart.value = v;
    });

gui.add(params, 'fadeEnd', 0, 3, 0.01)
    .name('fade end radius')
    .onChange((v: number) => {
        uniforms.uFadeEnd.value = v;
    });

gui.add(params, 'rodWidth', 0.002, 0.08, 0.001)
    .name('rod width')
    .onChange((v: number) => {
        uniforms.uRodWidth.value = v;
    });

gui.add(params, 'scatterRadius', 0.1, 2, 0.01)
    .name('scatter radius')
    .onChange((v: number) => {
        uniforms.uScatterRadius.value = v;
    });

gui.add(params, 'zoom', 0.2, 5, 0.01)
    .name('camera zoom')
    .onChange((v: number) => {
        uniforms.uZoom.value = v;
    });

gui.add(params, 'panX', -1.5, 1.5, 0.01)
    .name('camera pan x')
    .onChange((v: number) => {
        uniforms.uPan.value = [v, params.panY];
    });

gui.add(params, 'panY', -1.5, 1.5, 0.01)
    .name('camera pan y')
    .onChange((v: number) => {
        uniforms.uPan.value = [params.panX, v];
    });

gui.add(params, 'fresnelIntensity', 0, 3, 0.01)
    .name('fresnel intensity')
    .onChange((v: number) => {
        uniforms.uFresnelIntensity.value = v;
    });

gui.add(params, 'specularIntensity', 0, 3, 0.1)
    .name('specular intensity')
    .onChange((v: number) => {
        uniforms.uSpecularIntensity.value = v;
    });
