import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

import bgUrl from './assets/bg.jpg';

const fragmentShader = `
    precision mediump float;

    uniform vec3 iResolution;
    uniform float iTime;

    uniform sampler2D u_texture;
    uniform vec2 u_textureSize;
    
    uniform vec2 u_mouse;
    
    void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        uv.y = 1.0 - uv.y;
        
        float canvasAspect = iResolution.x / iResolution.y;
        float imageAspect  = u_textureSize.x / u_textureSize.y;
        
        vec2 delta = uv - u_mouse;
        float angle = atan(delta.y, delta.x); 
    
        float wobble = sin(angle * 2.0 + iTime * 1.1) * 0.03
               + sin(angle * 7.0 + iTime * 0.7) * 0.015
               + sin(angle * 30.0 + iTime * 1.8) * 0.008;

        
        float dist = length(delta) + wobble;
         
        float burn = smoothstep(0.3, 0.0, dist) ;
        
        vec2 scale = canvasAspect > imageAspect
              ? vec2(1.0, canvasAspect / imageAspect)                                                                      
              : vec2(imageAspect / canvasAspect, 1.0);

        uv = (uv - 0.5) / scale + 0.5;

        // 4. Затухание снизу
        float fadeTop = smoothstep(0.0, max(abs(sin(iTime * 0.3 + uv.x / 0.5) * 0.2), 0.1), uv.y);
        float fadeBottom = smoothstep(1.0, max(abs(sin(iTime * 0.2 + uv.x / 0.2) * 0.8), 0.8), uv.y);
        float fade = fadeTop * fadeBottom;
        
        // 5. Сэмплируем
        vec4 color = texture2D(u_texture, uv) * 0.3;
        vec4 burned = vec4(texture2D(u_texture, uv).rgb * 1.2, 1.0) * fade;

        // gl_FragColor = color;
        gl_FragColor = mix(color, burned, burn);
    }
`;

const mouse = { value: [0.5, 0.5] };

globalThis.addEventListener('mousemove', (e) => {
    mouse.value = [e.clientX / window.innerWidth, e.clientY / window.innerHeight];
});

try {
    new ShaderCanvas('#app', {
        fragmentShader,
        textures: { u_texture: bgUrl },
        uniforms: { u_mouse: mouse },
    });
} catch (_error) {
    console.log('WebGL not supported', _error);
}
