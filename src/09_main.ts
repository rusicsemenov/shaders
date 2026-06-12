import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

import bgUrl from './assets/bg.jpg';

const fragmentShader = `
    precision mediump float;

    uniform vec3 iResolution;
    uniform float iTime;

    uniform sampler2D u_texture;
    uniform vec2 u_textureSize;

    void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        uv.y = 1.0 - uv.y;
        
        float canvasAspect = iResolution.x / iResolution.y;
        float imageAspect  = u_textureSize.x / u_textureSize.y;
        
        vec2 scale = canvasAspect > imageAspect
              ? vec2(1.0, canvasAspect / imageAspect)                                                                      
              : vec2(imageAspect / canvasAspect, 1.0);

        uv = (uv - 0.5) / scale + 0.5;

        vec4 color = texture2D(u_texture, uv);
        gl_FragColor = color;
    }
`;

new ShaderCanvas('#app', { fragmentShader, textures: { u_texture: bgUrl } });
