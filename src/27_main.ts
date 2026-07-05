import './style.css';
import { ShaderCanvas } from './ShaderCanvas';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// Compile-time loop bounds (GLSL ES 1.00 needs constant loop bounds);
// the GUI-controlled counts just break out of these early.
const ROPE_MAX = 10;
const STRAND_MAX = 7;

function hexToRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const params = {
    background: '#050308',
    dynamicAngle: true,
    staticAngle: 0.52,
    bendAmount: 0.17,
    ropeCount: 3,
    strandCount: 6,
};

const overlay = document.createElement('div');

overlay.innerText = 'Give your site a living background';
overlay.classList.add('overlay');
overlay.style.color = 'white';
overlay.style.textAlign = 'center';
overlay.style.lineHeight = '1.2';
overlay.style.letterSpacing = '1.2px';
overlay.style.mixBlendMode = 'difference';
overlay.style.maxWidth = '1600px';
overlay.style.margin = '0 auto';
document.body.appendChild(overlay);

const fragmentShader = /*language=GLSL*/ `
    precision highp float;
    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec3 uBgColor;
    uniform float uDynamicAngle; // > 0.5 = animated, otherwise uStaticAngle is used
    uniform float uStaticAngle;
    uniform float uBendAmount;
    uniform float uRopeCount;
    uniform float uStrandCount;

    const int ROPE_MAX = 20;
    const int STRAND_MAX = 12;

    void main() {
        vec2 p = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
        p.x *= iResolution.x / iResolution.y;

        vec3 col = uBgColor;

        // Rotate coordinate system so ribbons flow bottom-left → top-right
        float angle;
        if (uDynamicAngle > 0.5) {
            angle = sin(0.52 * p.x + 0.3 * p.y + 0.2 * iTime) * 0.4;
        } else {
            angle = uStaticAngle;
        }
        float ca = cos(angle), sa = sin(angle);
        float along  =  p.x * ca + p.y * sa;  // along ribbon direction
        float across = -p.x * sa + p.y * ca;  // perpendicular (ribbon stack)

        // Fade to black on the left side
        float fade = smoothstep(-2.1, 2.5, along);

        // --- Step 2: a bundle of strands twisting around one rope centerline ---
        float twistRate  = 0.5;   // how tightly the strands spiral along the rope
        float spinSpeed  = 0.4;   // how fast the spiral rotates over time
        float radius     = 0.067;  // how far strands orbit from the centerline
        float width      = 0.0292;  // strand thickness

        // Step 3: bend the whole rope's centerline into a curve instead of a straight line
        float bendAmount = uBendAmount;   // how far the rope swings sideways

        // Step 5: track the closest (most camera-facing) strand so ropes occlude each other
        float bestDepth    = -5.0; // lower than any real depth (-1..1), so anything wins initially
        vec3  bestColor    = vec3(0.0);
        float bestBody     = 0.0;
        float bestShade    = 0.0;
        float bestSpecular = 0.0;

        // Step 4: ropes, each spaced across the screen with its own bend/twist phase.
        // The loop bound stays a compile-time constant; uRopeCount just breaks early.
        for (int r = 0; r < ROPE_MAX; r++) {
            if (float(r) >= uRopeCount) break;

            float ropeOffset = (float(r) - 1.0) * 0.0016; // spreads ropes left/center/right
            float ropePhase  = float(r) * 3.9;          // gives each rope its own braid timing

            // Step 6: one shared angle drives both position and depth, so ropes braid consistently
            float braidFreq = 1.5; // how many crossings over the visible length
            float ropeAngle = braidFreq * along + ropePhase;

            float baseAcross = ropeOffset + bendAmount * cos(ropeAngle); // position (was sin(...bendFreq...))
            float ropeDepth  = sin(ropeAngle);                           // depth, now correlated with position

            // Cull A: the strand-level term can shift totalDepth by at most 0.001,
            // so ropeDepth*1.5+0.001 is the best this rope could ever score here.
            // If that can't beat what we already found, skip its strands entirely.
            float maxPossibleDepth = ropeDepth * 1.5 + 0.001;
            if (maxPossibleDepth <= bestDepth) continue;

            // Cull B: if this rope's centerline is farther from this pixel than any
            // strand could reach, none of its strands can cover this pixel either.
            if (abs(across - baseAcross) > radius + width) continue;

            for (int k = 0; k < STRAND_MAX; k++) {
                if (float(k) >= uStrandCount) break;

                // Spread strands evenly around the circle (2π / N per strand)
                float phase = float(k) * (6.28318 / uStrandCount) + ropePhase;

                float strandAngle = twistRate * along * 1.7 + iTime * spinSpeed + phase;
                float offset = radius * cos(strandAngle); // sideways position we see
                float depth  = sin(strandAngle);          // -1 = behind, +1 = toward camera
                float center = baseAcross + offset;

                float dist = abs(across - center);
                float body = smoothstep(width, 0.0, dist);
                float shade = 0.5 + 0.5 * depth; // dim when facing away, bright when facing camera
                float totalDepth = ropeDepth * 1.5 + depth * 0.001; // rope-level ordering dominates, twist adds local detail

                // Step 7: fake a rounded cross-section normal for a metallic specular highlight
                float edgeFactor = clamp(dist / width, 0.0, 1.0); // 0 at strand center, 1 at edge
                float nz = sqrt(1.0 - edgeFactor * edgeFactor);   // bulge normal, like a round rod
                float specular = pow(nz, 24.0);                  // tight, shiny highlight

                vec3 strandColor;
                if (k == 0) strandColor = vec3(0.9, 0.1, 0.05);        // red
                else if (k == 1) strandColor = vec3(0.95, 0.45, 0.05); // orange
                else if (k == 2) strandColor = vec3(0.1, 0.3, 0.9);    // blue
                else if (k == 3) strandColor = vec3(0.9, 0.9, 0.95);   // white/silver
                else strandColor = vec3(0.6, 0.05, 0.6);               // magenta

                if (body > 0.01 && totalDepth > bestDepth) {
                    bestDepth    = totalDepth;
                    bestColor    = strandColor;
                    bestBody     = body;
                    bestShade    = shade;
                    bestSpecular = specular;
                }
            }
        }

        col += bestColor * bestBody * bestShade * fade * 2.0;
        col += vec3(1.0) * bestBody * bestSpecular * fade; // metallic specular highlight

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
`;

const uniforms = {
    uBgColor: { value: hexToRgb(params.background) },
    uDynamicAngle: { value: params.dynamicAngle ? 1 : 0 },
    uStaticAngle: { value: params.staticAngle },
    uBendAmount: { value: params.bendAmount },
    uRopeCount: { value: params.ropeCount },
    uStrandCount: { value: params.strandCount },
};

new ShaderCanvas('#app', { fragmentShader, uniforms });

const gui = new GUI();
gui.close();
gui.addColor(params, 'background')
    .name('background color')
    .onChange((v: string) => {
        uniforms.uBgColor.value = hexToRgb(v);
    });
gui.add(params, 'dynamicAngle')
    .name('dynamic angle')
    .onChange((v: boolean) => {
        uniforms.uDynamicAngle.value = v ? 1 : 0;
    });
gui.add(params, 'staticAngle', -3.14, 3.14, 0.01)
    .name('static angle')
    .onChange((v: number) => {
        uniforms.uStaticAngle.value = v;
    });
gui.add(params, 'bendAmount', 0, 0.5, 0.005)
    .name('bend amount')
    .onChange((v: number) => {
        uniforms.uBendAmount.value = v;
    });
gui.add(params, 'ropeCount', 1, ROPE_MAX, 1)
    .name('rope count')
    .onChange((v: number) => {
        uniforms.uRopeCount.value = v;
    });
gui.add(params, 'strandCount', 1, STRAND_MAX, 1)
    .name('strand count')
    .onChange((v: number) => {
        uniforms.uStrandCount.value = v;
    });
