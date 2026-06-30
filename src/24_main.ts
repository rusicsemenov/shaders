import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

const fragmentShader = /*language=GLSL*/ `
    precision highp float;
    uniform vec3 iResolution;
    uniform float iTime;

    void main() {
        vec2 p = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
        p.x *= iResolution.x / iResolution.y;

        vec3 col = vec3(0.02, 0.01, 0.035);

        // Rotate coordinate system so ribbons flow bottom-left → top-right
        float angle = 0.52;
        float ca = cos(angle), sa = sin(angle);
        float along  =  p.x * ca + p.y * sa;  // along ribbon direction
        float across = -p.x * sa + p.y * ca;  // perpendicular (ribbon stack)

        // Fade to black on the left side
        float fade = smoothstep(-1.7, 0.15, along);

        // 12 main ribbon bands
        for (float i = 0.0; i < 12.0; i++) {
            float t = i / 11.0; // 0 = bottom (dark red), 1 = top (blue)

            float baseAcross = (i - 5.5) * 0.075;

            // Each ribbon gets its own wave frequency and phase
            float wave = (0.04 + i * 0.006) * sin(along * (1.2 + i * 0.09) + iTime * 0.3 + i * 0.9);
            float center = baseAcross + wave;

            float dist  = abs(across - center);
            float width = 0.014 + 0.003 * sin(i * 1.9);
            float body  = smoothstep(width, 0.0, dist);

            // Color gradient: i=0 dark red → magenta → purple → blue i=11
            vec3 rCol;
            if (t < 0.2) {
                rCol = mix(vec3(0.55, 0.0, 0.0), vec3(0.92, 0.05, 0.05), t * 5.0);
            } else if (t < 0.48) {
                rCol = mix(vec3(0.92, 0.05, 0.05), vec3(0.85, 0.0, 0.5), (t - 0.2) * 3.57);
            } else if (t < 0.72) {
                rCol = mix(vec3(0.85, 0.0, 0.5), vec3(0.5, 0.0, 0.8), (t - 0.48) * 4.17);
            } else {
                rCol = mix(vec3(0.5, 0.0, 0.8), vec3(0.1, 0.15, 0.9), (t - 0.72) * 3.57);
            }

            col += rCol * body * fade * 2.5;

            // Thin bright highlight offset to one edge of each ribbon
            float hlDist = abs(across - center + width * 0.6);
            float hl     = smoothstep(width * 0.08, 0.0, hlDist);
            float hlStr  = t > 0.72 ? 4.0 : 0.35;
            col += vec3(0.88, 0.9, 1.0) * hl * fade * hlStr;
        }

        // Extra thin white streaks in the blue/silver band (top ribbons)
        for (float j = 0.0; j < 3.0; j++) {
            float baseAcross = (-5.5 + j * 1.3) * 0.075;
            float wave   = 0.03 * sin(along * 1.1 + iTime * 0.22 + j * 2.4);
            float center = baseAcross + wave;
            float streak = smoothstep(0.0025, 0.0, abs(across - center));
            col += vec3(0.9, 0.92, 1.0) * streak * fade * 5.0;
        }

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
`;

new ShaderCanvas('#app', { fragmentShader });
