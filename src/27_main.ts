import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

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

    void main() {
        vec2 p = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
        p.x *= iResolution.x / iResolution.y;

        vec3 col = vec3(0.02, 0.01, 0.035);

        // Rotate coordinate system so ribbons flow bottom-left → top-right
//        float angle = 0.52;
        float angle = sin(0.52 * p.x + 0.3 * p.y + 0.2 * iTime) * 0.4;
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
        float bendAmount = 0.17;   // how far the rope swings sideways

        const int STRAND_COUNT = 6;

        // Step 5: track the closest (most camera-facing) strand so ropes occlude each other
        float bestDepth    = -5.0; // lower than any real depth (-1..1), so anything wins initially
        vec3  bestColor    = vec3(0.0);
        float bestBody     = 0.0;
        float bestShade    = 0.0;
        float bestSpecular = 0.0;

        // Step 4: three big ropes, each spaced across the screen with its own bend/twist phase
        const int ROPE_COUNT = 3;
        for (int r = 0; r < ROPE_COUNT; r++) {
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

            for (int k = 0; k < STRAND_COUNT; k++) {
                // Spread strands evenly around the circle (2π / N per strand)
                float phase = float(k) * (6.28318 / float(STRAND_COUNT)) + ropePhase;

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

new ShaderCanvas('#app', { fragmentShader });
