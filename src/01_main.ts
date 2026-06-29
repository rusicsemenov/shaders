import './style.css';
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.querySelector('#app')?.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(10, 10, 100, 100);

const vertexShader = `
    uniform float iTime;
        
    void main() {
        vec3 pos = position;
        pos.y += sin(pos.x * 2.0 + iTime) * 0.5; 
        pos.x += sin(pos.y * 2.0 + iTime) * 0.5; 
        // pos.z = sin(pos.x * 0.7 + iTime * 2.0) * 2.2;
         
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }  
`;

const fragmentShader = `
    #include <common>
    uniform vec3 iResolution;
    uniform float iTime;
    
    // By iq: https://www.shadertoy.com/user/iq
    // license: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
        // Normalized pixel coordinates (from 0 to 1)
        vec2 uv = fragCoord/iResolution.xy;
        // Time varying pixel color
        vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
        // Output to screen
        fragColor = vec4(col,1.0);
    }
    
    void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
    }
`;

const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3() },
};

uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1);

const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
});

const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

camera.position.z = 20;
plane.rotation.x = -0.8;

function animate(time: number) {
    // plane.rotation.x = time / 6000;
    // plane.rotation.y = time / 2000;

    uniforms.iTime.value = time / 1000;

    renderer.render(scene, camera);
}
