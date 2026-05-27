import './style.css';
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(20, 20, 200, 200);

const vertexShader = `
    uniform float iTime;
    
    varying vec3 vNormal;    
        
    void main() {
        vec3 pos = position;
        
        // pos.y += sin(pos.x * 2.0 + iTime) * 0.5; 
        // pos.x += cos(pos.y * 2.0 + iTime) * 0.5; 
        pos.z = sin(pos.x * 0.7 + iTime) * 1.5;
         
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        
        float dz_dx = cos(pos.x * 0.7 + iTime) * 1.5 * 0.7;
        float dz_dy = 0.0;
        
        vec3 T_x = vec3(1.0, 0.0, dz_dx);
        vec3 T_y = vec3(0.0, 1.0, dz_dy);
        vec3 computedNormal = normalize(cross(T_x, T_y));

        vNormal = normalize(normalMatrix * computedNormal);
    }  
`;

const fragmentShader = `
    #include <common>
    uniform vec3 iResolution;
    uniform float iTime;
    
    varying vec3 vNormal;
    
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
      vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
      float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
      float ambient = 0.2;
      float light = ambient + diffuse;
  
      vec3 baseColor = vec3(0.2, 0.5, 1.0); // синий
      gl_FragColor = vec4(baseColor * light, 1.0);

//      mainImage(gl_FragColor, gl_FragCoord.xy);
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

const defaultMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

const plane = new THREE.Mesh(geometry, material);
// const plane = new THREE.Mesh(geometry, defaultMaterial);
scene.add(plane);

camera.position.z = 20;
plane.rotation.x = -Math.PI / 5;

function animate(time: number) {
    // plane.rotation.x = time / 6000;
    // plane.rotation.y = time / 2000;

    uniforms.iTime.value = time / 1000;

    renderer.render(scene, camera);
}
