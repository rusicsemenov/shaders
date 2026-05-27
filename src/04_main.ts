import './style.css';
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(2, 2, 200, 200);

const fragmentShader = `
    #ifdef GL_ES
    precision mediump float;
    #endif
    
    uniform vec3 iResolution;
    uniform float iTime;
    
    float random (in vec2 _st) {
        return fract(sin(dot(_st.xy,
                             vec2(12.9898,78.233)))*
                             43758.5453123);
    }
    
    // Based on Morgan McGuire @morgan3d
    // https://www.shadertoy.com/view/4dS3Wd
    float noise (in vec2 _st) {
        vec2 i = floor(_st);
        vec2 f = fract(_st);
    
        // Four corners in 2D of a tile
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
    
        vec2 u = f * f * f * (3.0 - 2.0 * f);
    
        return mix(a, b, u.x) +
                (c - a)* u.y * (1.0 - u.x) +
                (d - b) * u.x * u.y;
    }
    
    #define NUM_OCTAVES 5
    
    float fbm ( in vec2 _st) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        // Rotate to reduce axial bias
        mat2 rot = mat2(cos(0.5), sin(0.5),
                        -sin(0.5), cos(0.5));
        for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(_st);
            _st = rot * _st * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }
    
    void main() {
        vec2 st = gl_FragCoord.xy/iResolution.xy * 4.;
        // st += st * abs(sin(iTime*0.1)*3.0);
        vec3 color = vec3(0.0);
    
        vec2 q = vec2(0.);
        q.x = fbm( st + 0.02*iTime);
        q.y = fbm( st + vec2(1.0));
    
        vec2 r = vec2(0.);
        r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*iTime );
        r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*iTime);
    
        float f = fbm(st+r);
        
        color = mix(vec3(0.0745, 0.4863, 0.6471), 
                    vec3(0.0745, 0.0983, 0.1171),
                    clamp(f*f * 4.0, 0.0, 1.0));
    
        color = mix(color,
                    vec3(0.0345, 0.0203, 0.0471),
                    clamp(length(q),0.0,1.0));

        color = mix(color,
                    vec3(0.0745, 0.4863, 0.6471),
                    clamp(length(r.x),0.0,1.0));
    
        gl_FragColor = vec4((f*f*f + .3*f*f + .7*f)*color,1.);
    }
`;

const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3() },
};

uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1);
});

const material = new THREE.ShaderMaterial({
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
});

const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

function animate(time: number) {
    uniforms.iTime.value = time / 1000;

    renderer.render(scene, camera);
}
