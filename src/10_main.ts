import './style.css';
import { ShaderCanvas } from './ShaderCanvas';

const fragmentShader = `
    precision mediump float;

    uniform vec3 iResolution;
    uniform float iTime;

    // ─── SDF functions ───────────────────────────────────────────────────────

    float sdSphere(vec3 p, float r) {
        return length(p) - r;
    }

    float sdPlane(vec3 p) {
        return p.y;
    }

    // ─── Scene ───────────────────────────────────────────────────────────────
    // returns vec2(distance, materialId)
    // materialId: 1.0 = sphere, 2.0 = plane

    vec2 scene(vec3 p) {
        vec2 sphere = vec2(sdSphere(p - vec3(0.0, 0.5, 0.0), 0.5), 1.0);
        vec2 plane  = vec2(sdPlane(p), 2.0);
        return sphere.x < plane.x ? sphere : plane;
    }

    // ─── Ray marching ────────────────────────────────────────────────────────

    vec2 march(vec3 ro, vec3 rd) {
        float t = 0.0;
        for (int i = 0; i < 64; i++) {
            vec3 p = ro + rd * t;
            vec2 result = scene(p);
            if (result.x < 0.001) return vec2(t, result.y);
            t += result.x;
            if (t > 20.0) break;
        }
        return vec2(-1.0, 0.0);
    }

    // ─── Normal ──────────────────────────────────────────────────────────────
    // gradient of SDF = направление "наружу" от поверхности

    vec3 calcNormal(vec3 p) {
        vec2 e = vec2(0.001, 0.0);
        return normalize(vec3(
            scene(p + e.xyy).x - scene(p - e.xyy).x,
            scene(p + e.yxy).x - scene(p - e.yxy).x,
            scene(p + e.yyx).x - scene(p - e.yyx).x
        ));
    }

    // ─── Main ────────────────────────────────────────────────────────────────

    void main() {
        // uv центрированы по Y, чтобы пропорции не зависели от размера экрана
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

        // камера
        vec3 ro = vec3(0.0, 1.5, 3.0);
        vec3 rd = normalize(vec3(uv, -1.0));

        vec2 hit = march(ro, rd);
        float t     = hit.x;
        float matId = hit.y;

        vec3 col = vec3(0.08, 0.08, 0.12); // фон

        if (t > 0.0) {
            vec3 p = ro + rd * t;
            vec3 n = calcNormal(p);

            vec3 lightDir = normalize(vec3(1.0, 2.0, 1.5));
            float diff = max(dot(n, lightDir), 0.0);

            vec3 baseColor = matId < 1.5
                ? vec3(0.2, 0.5, 0.9)  // шар — синий
                : vec3(0.4, 0.4, 0.4); // плоскость — серая

            col = baseColor * (0.15 + diff * 0.85);
        }

        gl_FragColor = vec4(col, 1.0);
    }
`;

new ShaderCanvas('#app', { fragmentShader });
