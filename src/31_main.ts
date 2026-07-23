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
    strandMax: 60,
    strandCount: 30,
    spread: 1.6,
    waveAmplitude: 0.5,
    waveFrequency: 1.0,
    scrollSpeed: 0.15,
    strandWidth: 0.018,
    glowSize: 0.05,
    glowIntensity: 0.6,
    fresnelIntensity: 0.8,
    specularIntensity: 2.5,
    coreColor: '#ff1a3c',
    highlightColor: '#5b2cff',
    background: '#05030a',
    fadeStart: 1.6,
    fadeEnd: 2.6,
    zoom: 1.0,
    panX: 0.0,
    panY: 0.0,
};

// STRAND_MAX is a GLSL compile-time loop bound (GLSL ES 1.00 requires
// constant loop bounds). strandCount just breaks the loop early via a
// uniform, same as the Fiberglass shader's uStrandCount — no rebuild
// needed for that one.
function buildFragmentShader(strandMax: number): string {
    return /*language=GLSL*/ `
    precision highp float;
    uniform vec3 iResolution;
    uniform float iTime;
    uniform float uStrandCount;
    uniform float uSpread;
    uniform float uWaveAmplitude;
    uniform float uWaveFrequency;
    uniform float uScrollSpeed;
    uniform float uStrandWidth;
    uniform float uGlowSize;
    uniform float uGlowIntensity;
    uniform float uFresnelIntensity;
    uniform float uSpecularIntensity;
    uniform vec3 uCoreColor;
    uniform vec3 uHighlightColor;
    uniform vec3 uBgColor;
    uniform float uFadeStart;
    uniform float uFadeEnd;
    uniform float uZoom;
    uniform vec2 uPan;

    const int STRAND_MAX = ${strandMax};

    float hash11(float n) {
        return fract(sin(n) * 43758.5453123);
    }

    void main() {
        vec2 p = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
        p.x *= iResolution.x / iResolution.y;
        p = p / uZoom + uPan;

        // --- Background: near-black, gentle glow toward the upper-right ---
        float bgGlow = smoothstep(-0.6, 1.6, p.x - p.y * 0.5);
        vec3 col = mix(uBgColor, uHighlightColor * 0.12, bgGlow * 0.5);

        for (int s = 0; s < STRAND_MAX; s++) {
            if (float(s) >= uStrandCount) break;

            float fs = float(s);

            // Per-strand path: two summed sine waves with random amplitude,
            // frequency and phase, scrolled over time — gives each strand
            // its own organic, flowing curve instead of a shared formula.
            float baseOffset = (hash11(fs * 11.3 + 1.0) - 0.5) * uSpread;
            float ampA   = mix(0.5, 1.0, hash11(fs * 7.7 + 2.0)) * uWaveAmplitude;
            float freqA  = mix(0.8, 1.6, hash11(fs * 13.1 + 3.0)) * uWaveFrequency;
            float phaseA = hash11(fs * 5.3 + 4.0) * 6.28318;
            float ampB   = ampA * 0.35;
            float freqB  = freqA * 2.3;
            float phaseB = hash11(fs * 9.9 + 5.0) * 6.28318;

            float scroll = iTime * uScrollSpeed;
            float fx  = baseOffset
                + ampA * sin(freqA * p.x + phaseA + scroll)
                + ampB * sin(freqB * p.x + phaseB - scroll * 0.6);
            float dfx = ampA * freqA * cos(freqA * p.x + phaseA + scroll)
                + ampB * freqB * cos(freqB * p.x + phaseB - scroll * 0.6);

            // True perpendicular distance from the pixel to the curve,
            // correcting for local slope so width stays constant everywhere.
            float dist = abs(p.y - fx) / sqrt(1.0 + dfx * dfx);

            // Cheap cull: nothing further than a generous margin from the
            // curve could be covered by this strand's body or glow.
            if (dist > 1.0) continue;

            // Random pseudo-depth per strand: thinner/dimmer strands read as
            // further back, brighter/wider ones read as closer.
            float depth      = hash11(fs * 25.37 + 70.0);
            float depthScale = mix(0.35, 1.0, depth);
            float depthVis   = mix(0.25, 1.0, depth);

            float width = uStrandWidth * depthScale * mix(0.6, 1.6, hash11(fs * 17.0 + 80.0));
            float aa = 0.006 * depthScale;
            float body = smoothstep(width, width - aa, dist) * depthVis;

            // Fake a rounded ribbon cross-section normal for rim + specular,
            // same trick as the Fiberglass rod shader.
            float edgeFactor = clamp(dist / width, 0.0, 1.0);
            float nz = sqrt(1.0 - edgeFactor * edgeFactor);
            float fresnel  = edgeFactor * edgeFactor;
            float specular = pow(nz, 60.0);

            vec3 strandColor = mix(uCoreColor, uHighlightColor, hash11(fs * 3.3 + 90.0));
            vec3 specColor   = mix(strandColor, vec3(1.0), 0.65);

            vec3 ribbonBase = vec3(0.02, 0.01, 0.03);
            col = mix(col, ribbonBase, body);
            col += strandColor * fresnel * body * uFresnelIntensity;
            col += specColor * specular * body * uSpecularIntensity;

            // Soft glow halo bleeding out from the strand, independent of
            // the hard antialiased body edge.
            float glow = exp(-(dist * dist) / (uGlowSize * uGlowSize)) * depthVis;
            col += strandColor * glow * uGlowIntensity;
        }

        // --- Radial fade: dim to black away from center ---
        float distFromCenter = length(p);
        float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, distFromCenter);
        col *= fade;

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
`;
}

const uniforms = {
    uStrandCount: { value: params.strandCount },
    uSpread: { value: params.spread },
    uWaveAmplitude: { value: params.waveAmplitude },
    uWaveFrequency: { value: params.waveFrequency },
    uScrollSpeed: { value: params.scrollSpeed },
    uStrandWidth: { value: params.strandWidth },
    uGlowSize: { value: params.glowSize },
    uGlowIntensity: { value: params.glowIntensity },
    uFresnelIntensity: { value: params.fresnelIntensity },
    uSpecularIntensity: { value: params.specularIntensity },
    uCoreColor: { value: hexToRgb(params.coreColor) },
    uHighlightColor: { value: hexToRgb(params.highlightColor) },
    uBgColor: { value: hexToRgb(params.background) },
    uFadeStart: { value: params.fadeStart },
    uFadeEnd: { value: params.fadeEnd },
    uZoom: { value: params.zoom },
    uPan: { value: [params.panX, params.panY] },
};

let shaderCanvas: ShaderCanvas;

function createCanvas(): void {
    const fragmentShader = buildFragmentShader(params.strandMax);
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

gui.add(params, 'strandMax', 10, 150, 1)
    .name('strand max (rebuild)')
    .onChange(() => {
        rebuildCanvas();
    });

gui.add(params, 'spread', 0.2, 3, 0.01)
    .name('vertical spread')
    .onChange((v: number) => {
        uniforms.uSpread.value = v;
    });

gui.add(params, 'waveAmplitude', 0, 1.5, 0.01)
    .name('wave amplitude')
    .onChange((v: number) => {
        uniforms.uWaveAmplitude.value = v;
    });

gui.add(params, 'waveFrequency', 0.1, 3, 0.01)
    .name('wave frequency')
    .onChange((v: number) => {
        uniforms.uWaveFrequency.value = v;
    });

gui.add(params, 'scrollSpeed', -1, 1, 0.01)
    .name('scroll speed')
    .onChange((v: number) => {
        uniforms.uScrollSpeed.value = v;
    });

gui.add(params, 'strandWidth', 0.002, 0.08, 0.001)
    .name('strand width')
    .onChange((v: number) => {
        uniforms.uStrandWidth.value = v;
    });

gui.add(params, 'glowSize', 0.005, 0.3, 0.001)
    .name('glow size')
    .onChange((v: number) => {
        uniforms.uGlowSize.value = v;
    });

gui.add(params, 'glowIntensity', 0, 2, 0.01)
    .name('glow intensity')
    .onChange((v: number) => {
        uniforms.uGlowIntensity.value = v;
    });

gui.add(params, 'fresnelIntensity', 0, 3, 0.01)
    .name('fresnel intensity')
    .onChange((v: number) => {
        uniforms.uFresnelIntensity.value = v;
    });

gui.add(params, 'specularIntensity', 0, 5, 0.01)
    .name('specular intensity')
    .onChange((v: number) => {
        uniforms.uSpecularIntensity.value = v;
    });

gui.addColor(params, 'coreColor')
    .name('core color')
    .onChange((v: string) => {
        uniforms.uCoreColor.value = hexToRgb(v);
    });

gui.addColor(params, 'highlightColor')
    .name('highlight color')
    .onChange((v: string) => {
        uniforms.uHighlightColor.value = hexToRgb(v);
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

gui.add(params, 'zoom', 0.2, 5, 0.01)
    .name('camera zoom')
    .onChange((v: number) => {
        uniforms.uZoom.value = v;
    });

gui.add(params, 'panX', -2, 2, 0.01)
    .name('camera pan x')
    .onChange((v: number) => {
        uniforms.uPan.value = [v, params.panY];
    });

gui.add(params, 'panY', -2, 2, 0.01)
    .name('camera pan y')
    .onChange((v: number) => {
        uniforms.uPan.value = [params.panX, v];
    });
