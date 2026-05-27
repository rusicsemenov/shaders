import './style.css';
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(2, 2, 200, 200);

const vertexShader = `
    void main() {
        vec3 pos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }  
`;

const fragmentShader = `
    #include <common>
    
    uniform vec3 iResolution;
    uniform float iTime;
    
    vec3 palette( float t ) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.2, 0.3, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263,0.416,0.557);
    
        return a + b*cos( 6.28318*(c*t+d) );
    } 
    
    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
        vec2 or_uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;
        vec2 uv = or_uv;
        vec3 finalColor = vec3(0.0);
        
        for (float i = 0.0; i < 4.0; i++) {
            uv = fract(uv * 1.5) - 0.5;
    
            float d = length(uv) * exp(-length(or_uv)) ;
    
            vec3 col = palette(length(or_uv) + i*.4 + iTime);
    
            d = sin(d*6. + iTime)/2.2;
            d = abs(d);
    
            d = pow(0.01 / d, 2.2);
    
            finalColor += col * d;
        }
            
        fragColor = vec4(finalColor, 1.0);
    }
    
    void main() {
      vec3 baseColor = vec3(0.);
      gl_FragColor = vec4(baseColor, 1.0);

      mainImage(gl_FragColor, gl_FragCoord.xy);
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
    vertexShader,
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
