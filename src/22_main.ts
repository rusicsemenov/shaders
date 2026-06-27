import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

// square

// ─── Fragment shader ──────────────────────────────────────────────────────────
const fragmentShader = /*language=GLSL*/ `
    precision mediump float;

    uniform float     iTime;
    uniform vec3      iResolution;
    
    float random(in vec2 _st) {
        return fract(sin(dot(_st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    
//    float SIZE = abs(0.8 * sin(iTime * 0.5) + 0.2);
    float SIZE = 0.3;
    const float STROKE_SIZE = 0.6;
    const vec3 BASE_COLOR = vec3(0.0);

    float halhStroke = STROKE_SIZE / 2.0;
    
    void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        uv = uv * 2.0 - 1.0;
        uv.x *= iResolution.x / iResolution.y;
        uv = mod(uv, 0.2) - 0.1;
        
        float sin = sin(iTime * 0.1);
        vec3 newColor = vec3(uv.x, random(uv), random(uv)); 
        
        float maxXRoY = max(abs(uv.x), abs(uv.y));
        vec3 color = mix(BASE_COLOR, newColor, step(maxXRoY, SIZE + halhStroke) - step(maxXRoY, SIZE - halhStroke));

        // Normals and lighting
        float dist = maxXRoY - SIZE;
        float normDist = dist / halhStroke;
        float tubeN = sqrt(1.0 - normDist * normDist);
        float light = tubeN * (maxXRoY * 0.5 + 0.9);
        
        color = color * light;
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

new ShaderCanvas('#app', { fragmentShader });
