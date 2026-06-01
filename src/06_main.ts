import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

const vertexShader = `
    attribute vec3 position;
    varying float vDepth;
    uniform vec3 iResolution;
    uniform float iTime;

    float hash(float n) { return fract(sin(n) * 43758.5453); }
    
    void main() {
        float aspectX = iResolution.x / iResolution.y;
        float aspectY = iResolution.y / iResolution.x;
        
        aspectX = aspectX > 1.0 ? aspectX : 1.0;
        aspectY = aspectY > 1.0 ? aspectY : 1.0;
        
        float t = -iTime * 0.05;
        
        float rnd = hash(position.x * 127.1 + position.z * 311.7);
        float wave = sin(iTime + rnd * 5.28) * 0.05; 
        
        float newX = position.x * cos(t) + position.z * sin(t);
        float newZ = -position.x * sin(t) + position.z * cos(t);
        
        vDepth = newZ;
        gl_PointSize = 3.0 * (1.0 - vDepth);
        
        gl_Position = vec4(
            (newX + wave) / aspectX, 
            (position.y - wave) / aspectY, 
            newZ + wave, 
            1.0
        );
    }
`;

const fragmentShader = `
    precision highp float;

    varying float vDepth;
    
    uniform vec3 iResolution;
    uniform float iTime;

    void main() {
        float dist = distance(gl_PointCoord, vec2(0.1));
        float alpha = smoothstep(0.5, 0.3, dist);

        float brightness = 1.0 - vDepth * 0.5; 
        vec3 finalColor = vec3(brightness);

        if (dist > 0.5) discard;
        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// const particles = new Float32Array(1000 * 3);
// for (let i = 0; i < particles.length; i += 3) {
//     particles[i] = Math.random() * 2 - 1; // x
//     particles[i + 1] = Math.random() * 2 - 1; // y
//     particles[i + 2] = Math.random(); // z (depth)
// }

const pointsCount = 10000;
const particles = new Float32Array(pointsCount * 3);
const noiseSize = 0.08;
const R = 0.6;

const getDistortion = () => (Math.random() - 0.5) * noiseSize;

for (let i = 0; i < particles.length; i += 3) {
    const phi = Math.acos(1 - (2 * i) / pointsCount); // по расстоянию от полюса
    const theta = Math.PI * (1 + Math.sqrt(5)) * i; // золотое сечение

    particles[i] = R * Math.sin(phi) * Math.cos(theta) + getDistortion(); // x
    particles[i + 1] = R * Math.sin(phi) * Math.sin(theta) + getDistortion(); // y
    particles[i + 2] = R * Math.cos(phi) + getDistortion(); // z
}

new ShaderCanvas('#app', { fragmentShader, vertexShader, particles });
