import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

const fragmentShader = /*language=GLSL*/ `
    precision highp float;
    uniform vec3 iResolution;
    uniform float iTime;

    const int STRAND_MAX = 100;
    const int STRAND_COUNT = 100;
    const int BOKEH_MAX = 18;

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

        // --- Background: faint blue haze near center, dark toward edges ---
        vec3 bgCenter = vec3(0.05, 0.07, 0.11);
        vec3 bgEdge   = vec3(0.008, 0.008, 0.014);
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
        float rodWidth     = 0.021;
        float scatterRadius = 0.8; // how far tips spread out around the center
        vec2  origin = vec2(-0.2, -1.7); // shared base point, off the bottom edge

        for (int s = 0; s < STRAND_MAX; s++) {
            if (s >= STRAND_COUNT) break;

            float fs = float(s);
            float angle = hash11(fs * 17.13 + 50.0) * 6.28318;
            float rad   = sqrt(hash11(fs * 9.71 + 60.0)) * scatterRadius; // sqrt keeps density uniform across the disc
            vec2 tip  = vec2(cos(angle), sin(angle)) * rad; // scattered within a circle around center
            vec2 base = origin;                              // all strands fan from one point

            // Random pseudo-depth per strand: 0 = far back, 1 = close to camera.
            // Farther strands are thinner and dimmer, giving a fake sense of depth.
            float depth      = hash11(fs * 25.37 + 70.0);
            float depthScale = mix(0.15, 1.0, depth);
            float depthVis   = mix(0.12, 1.0, depth);

            float localRodWidth = rodWidth * depthScale;

            // Bend: each rod leans toward a random side by a random amount,
            // rooted firmly at the base and flexing more toward the tip, with
            // a gentle animated sway layered on top (like wind).
            vec2 segDir = tip - base;
            float segLen = length(segDir);
            vec2 dirN = segDir / segLen;
            vec2 perp = vec2(-dirN.y, dirN.x);

            float bendSign = hash11(fs * 13.7 + 90.0) > 0.5 ? 1.0 : -1.0;
            float bendAmt  = mix(0.05, 0.3, hash11(fs * 31.4 + 100.0));
            float sway     = sin(iTime * 0.5 + fs * 2.3) * bendAmt * 0.35;
            float bendCoeff = bendSign * bendAmt + sway;

            vec2 rel = p - base;
            float along = dot(rel, dirN);
            float t = clamp(along / segLen, 0.0, 1.0);
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

            float fresnel  = pow(edgeFactor, 2.0); // bright toward the curved edge
            float specular = pow(nz, 40.0);        // tight highlight down the center

            // Per-rod dynamic color: a random hue per strand that slowly drifts
            // over time, shared by the rim glow, hot core, and halo.
            float hue = fract(hash11(fs * 7.13 + 120.0) + iTime * 0.09);
            vec3 rodColor = hsv2rgb(vec3(hue, 0.6, 1.0));
            
//            vec3 rodColor = vec3(0.25, 0.5, 0.95);
            
            vec3 rodBase = vec3(0.02, 0.022, 0.03); // near-black glass body

            col = mix(col, rodBase, body);
            col += rodColor * fresnel * body * 0.9;
            col += rodColor * specular * body * 0.9;

            // --- Glowing tip: hot core + soft halo, gently pulsing ---
            float pulse = 0.008 + 0.005 * sin(iTime * 1.3 + fs * 1.7);
            float tipDist = length(p - bentTip);
            float core = exp(-(tipDist * tipDist) / (0.006 * pulse));
            float halo = exp(-(tipDist * tipDist) / (0.05 * pulse));

            col += mix(vec3(1.0), rodColor, 0.5) * core * 1.4 * depthVis;
            col += rodColor * halo * 0.9 * depthVis;
        }

        // --- Radial fade: the whole scene dims to black away from center ---
        float fade = 1.0 - smoothstep(.2, 1.4, distFromCenter);
        col *= fade;

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
`;

new ShaderCanvas('#app', { fragmentShader });
