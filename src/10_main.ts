import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

import bgUrl from './assets/bg.jpg';

const fragmentShader = `
    precision mediump float;

    uniform vec3 iResolution;
    uniform float iTime;

    uniform sampler2D u_texture;
    uniform vec2 u_textureSize;
    
    #define NUM_STRIPS 500.0
    
    float randomShift(float stripIndex) {
      return fract(sin(stripIndex * 127.1) * 43758.5453);
    }


    void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        uv.y = 1.0 - uv.y;
        
        float canvasAspect = iResolution.x / iResolution.y;
        float imageAspect  = u_textureSize.x / u_textureSize.y;
        
        vec2 scale = canvasAspect > imageAspect
              ? vec2(1.0, canvasAspect / imageAspect)                                                                      
              : vec2(imageAspect / canvasAspect, 1.0);

        uv = (uv - 0.5) / scale + 0.5;

        // 1. Определяем номер полосы по X
        float stripIndex = floor(uv.x * NUM_STRIPS);
        
        // 2. Генерируем случайное смещение для этой полосы (через hash/noise)
        float shift = randomShift(stripIndex) * 0.02 * abs(sin(iTime * 1.0 + stripIndex));
        
        // 3. Смещаем uv.y
        uv.y += shift;
        
        // 4. Затухание снизу
        float fadeTop = smoothstep(0.0, max(abs(sin(iTime * 0.3 + stripIndex) * 0.2), 0.1), uv.y);
        float fadeBottom = smoothstep(1.0, max(abs(sin(iTime * 0.2 + stripIndex) * 0.9), 0.8), uv.y);
        float fade = fadeTop * fadeBottom;
        
        // 5. Сэмплируем
        vec4 color = texture2D(u_texture, uv) * fade;

        // vec4 color = texture2D(u_texture, uv);
        gl_FragColor = color;
    }
`;

try {
    new ShaderCanvas('#app', { fragmentShader, textures: { u_texture: bgUrl } });
} catch (_error) {
    console.log('WebGL not supported', _error);
}
