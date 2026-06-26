import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

// lines

// ─── Fragment shader ──────────────────────────────────────────────────────────
const fragmentShader = /*language=GLSL*/ `
    precision mediump float;

    uniform float     iTime;
    uniform vec3      iResolution;
    
    const int COUNT = 10;
    const float SIZE = 0.009;
    const float PI = 3.14159;

    float random(in vec2 _st) {
        return fract(sin(dot(_st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
        float xNorm = gl_FragCoord.x / iResolution.x;
        float scale = (iResolution.x + iResolution.y) * 0.5;
        vec2 uv = (gl_FragCoord.xy - iResolution.xy * 0.5) / scale;
//        uv = mod(uv * 1.0, vec2(0.25, 0.25));
        
        vec3 color = vec3(0.0);
        float maxZ = -2.0;

        for (int i = 1; i <= COUNT; i++) {
            float angle = uv.x * 10.0 - uv.y * 0.0 - iTime * 0.1;
            float phase_i = float(i) * 2.0 * PI / float(COUNT);
            angle += phase_i;
            
//            float effect = 0.3;
            float effect = (xNorm + 0.8) * 0.2;
            
            float lineY = sin(angle) * effect;
            float dist  = abs(uv.y - lineY);
            
            float lineZ = cos(angle);

            // dynamic size
            float sizeZ = SIZE * (1.0 + lineZ * 0.8);
            float slope = cos(angle) * 10.0 * effect;
            float effectiveSize = sizeZ * sqrt(1.0 + slope * slope);

            float colorY = (1.0 - step(effectiveSize, dist));

            // Normals and lighting
            float normDist = dist / effectiveSize;
            float tubeN = sqrt(1.0 - normDist * normDist);
            float light = tubeN * (lineZ * 0.5 + 0.7);
            
            if (colorY > 0.5 && lineZ > maxZ) {
                maxZ = lineZ;
                color = vec3(
                    random(vec2(float(i), 0.0)),
                    random(vec2(float(i), 1.0)),
                    random(vec2(float(i), 2.0))
//                );
                ) * light;
            }
        }

        gl_FragColor = vec4(color, 1.0);
    }
`;

new ShaderCanvas('#app', { fragmentShader });
