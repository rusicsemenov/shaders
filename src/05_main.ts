import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

// Адаптированный шейдер из 03_main.ts
// Изменения:
//   - убран `#include <common>` (не нужен без Three.js)
//   - palette() + mainImage() объединены в один void main()
//   - gl_FragCoord используется напрямую (встроенная переменная WebGL)

const fragmentShader = `
    precision highp float;

    uniform vec3 iResolution;
    uniform float iTime;

    vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.2, 0.3, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263, 0.416, 0.557);
        return a + b * cos(6.28318 * (c * t + d));
    }

    void main() {
        vec2 or_uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
        vec2 uv = or_uv;
        vec3 finalColor = vec3(0.0);

        for (float i = 0.0; i < 4.0; i++) {
            uv = fract(uv * 1.5) - 0.5;

            float d = length(uv) * exp(-length(or_uv));

            vec3 col = palette(length(or_uv) + i * 0.4 + iTime);

            d = sin(d * 6.0 + iTime) / 2.2;
            d = abs(d);
            d = pow(0.01 / d, 2.2);

            finalColor += col * d;
        }

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

new ShaderCanvas('#app', { fragmentShader });
