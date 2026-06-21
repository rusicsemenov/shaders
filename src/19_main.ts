import './style.css';
import { ShaderCanvas } from './ShaderCanvas';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// ─── Base spin speed for each drum (radians/second) ──────────────────────────
const speeds = { left: 1.1, center: 1.9, right: 0.7 };

const gui = new GUI({ title: 'Slot drums' });
gui.add(speeds, 'left', 0, 6, 0.05).name('Left speed');
gui.add(speeds, 'center', 0, 6, 0.05).name('Center speed');
gui.add(speeds, 'right', 0, 6, 0.05).name('Right speed');

// ─── Fragment shader ──────────────────────────────────────────────────────────
const fragmentShader = /*language=GLSL*/ `
    precision mediump float;

    uniform float iTime;
    uniform vec3  iResolution;
    uniform vec3  uAngle;   // accumulated rotation angle: left / center / right

    const float PI = 3.14159265;

    // Rotates point around the X axis by angle (radians).
    vec3 rotX(vec3 point, float angle) {
        float cosAngle = cos(angle), sinAngle = sin(angle);
        return vec3(point.x, cosAngle * point.y + sinAngle * point.z, sinAngle * point.y - cosAngle * point.z);
    }

    // Signed distance to a cylinder oriented along the X axis with radius and half-height.
    float sdCylinder(vec3 point, float radius, float halfHeight) {
        vec2 dist = abs(vec2(length(point.yz), point.x)) - vec2(radius, halfHeight);
        return min(max(dist.x, dist.y), 0.0) + length(max(dist, 0.0));
    }

    const float DRUM_R = 0.75;
    const float DRUM_H = 0.42;
    const float DIST_BETWEEN = 0.1;
    const float DIST = DRUM_H * 2.0 + DIST_BETWEEN;
    const float SIDE_Z_OFFSET = 0.1;
    const float RING_TUBE_R   = 0.004; // ring tube cross-section radius

    // Signed distance to a thin torus ring at world position (cx, 0, cz), matching drum radius.
    // cz shifts the ring in Z (depth), creating the levitation effect.
    float sdRing(vec3 point, float cx, float cz) {
        vec2 q = vec2(length(point.yz - vec2(0.0, cz)) - DRUM_R, point.x - cx);
        return length(q) - RING_TUBE_R;
    }

    // Nearest ring is determined by X coordinate alone (same proof as scene() drum selection).
    // Boundaries sit at the midpoints between adjacent ring X positions: 0 and ±(DIST*0.5+DRUM_H).
    // All rings share the same cz so the X-only selection proof still holds.
    float nearestRing(vec3 point) {
        const float boundary = DIST * 0.5 + DRUM_H;
        if (point.x < -boundary) return sdRing(point, -(DIST + DRUM_H), 0.0);
        if (point.x <  0.0)      return sdRing(point, -DRUM_H,          SIDE_Z_OFFSET);
        if (point.x <  boundary) return sdRing(point,  DRUM_H,          SIDE_Z_OFFSET);
        return                          sdRing(point,  DIST + DRUM_H,   0.0);
    }

    // Returns (distance, objectId) for the scene.
    // Drums: 1=left 2=center 3=right   Rings: 4
    vec2 scene(vec3 point) {
        float drumCenterX = clamp(floor(point.x / DIST + 0.5), -1.0, 1.0);

        float drumDist;
        float drumId;
        if (drumCenterX < -0.5) {
            drumDist = sdCylinder(rotX(point + vec3(DIST, 0.0, SIDE_Z_OFFSET), uAngle.x), DRUM_R, DRUM_H);
            drumId = 1.0;
        } else if (drumCenterX > 0.5) {
            drumDist = sdCylinder(rotX(point + vec3(-DIST, 0.0, SIDE_Z_OFFSET), uAngle.z), DRUM_R, DRUM_H);
            drumId = 3.0;
        } else {
            drumDist = sdCylinder(rotX(point, uAngle.y), DRUM_R, DRUM_H);
            drumId = 2.0;
        }

        float ringDist = nearestRing(point);
        if (ringDist < drumDist) return vec2(ringDist, 4.0);
        return vec2(drumDist, drumId);
    }

    // Estimates surface normal at point using central finite differences on the SDF.
    vec3 calcNormal(vec3 point) {
        const float eps = 0.0001;
        return normalize(vec3(
            scene(point + vec3(eps, 0, 0)).x - scene(point - vec3(eps, 0, 0)).x,
            scene(point + vec3(0, eps, 0)).x - scene(point - vec3(0, eps, 0)).x,
            scene(point + vec3(0, 0, eps)).x - scene(point - vec3(0, 0, eps)).x
        ));
    }

    // Ray marches from rayOrigin in direction rayDir.
    // Returns (dist, objectId) or (-1, 0) on miss. Accumulates ring glow into ringGlow.
    vec2 march(vec3 rayOrigin, vec3 rayDir, out float ringGlow) {
        float dist = 0.0;
        ringGlow = 0.0;
        for (int i = 0; i < 80; i++) {
            vec3 p = rayOrigin + rayDir * dist;
            vec2 sceneSample = scene(p);
            ringGlow += exp(-nearestRing(p) * 6.0) * 0.025;
            if (sceneSample.x < 0.001) return vec2(dist, sceneSample.y);
            if (dist > 20.0)           break;
            dist += sceneSample.x;
        }
        return vec2(-1.0, 0.0);
    }

    // Maps a section index (0–5, repeating) to one of six distinct colours.
    vec3 sectorColor(float idx) {
        float section = mod(idx, 6.0);
        if (section < 1.0) return vec3(0.95, 0.15, 0.10);
        if (section < 2.0) return vec3(0.10, 0.85, 0.20);
        if (section < 3.0) return vec3(0.15, 0.40, 1.00);
        if (section < 4.0) return vec3(1.00, 0.85, 0.05);
        if (section < 5.0) return vec3(1.00, 0.45, 0.00);
        return               vec3(0.60, 0.10, 0.90);
    }

    // Returns drum surface colour at local-space localPos: grey cap or a coloured sector stripe.
    vec3 drumAlbedo(vec3 localPos) {
        if (abs(localPos.x) > DRUM_H - 0.05) return vec3(0.22, 0.22, 0.26);

        float sectorAngle = atan(localPos.z, localPos.y);
        float sectorIndex = (sectorAngle / (PI * 2.0) + 0.5) * 6.0;

        float sectorFrac = fract(sectorIndex);
        if (sectorFrac < 0.06 || sectorFrac > 0.94) return vec3(0.03);

        return sectorColor(floor(sectorIndex));
    }

    // Entry point: traces a ray per pixel, shades the hit surface, applies vignette and gamma.
    void main() {
        vec2 uv = (gl_FragCoord.xy - iResolution.xy * 0.5) / iResolution.y;

        // Camera — fish-eye (equidistant spherical projection)
        vec3 rayOrigin = vec3(0.0, 0.0, 2.0);
        float r = length(uv);
        float theta = r * 1.9; // field-of-view spread: larger = more fish-eye
        vec3 rayDir = r < 0.001
            ? vec3(0.0, 0.0, -1.0)
            : normalize(vec3(uv * (sin(theta) / r), -cos(theta)));
        float ringGlow = 0.0;
        vec2 marchResult = march(rayOrigin, rayDir, ringGlow);

        vec3 color;

        if (marchResult.x < 0.0) {
            color = vec3(0.04, 0.04, 0.07);
        } else {
            float drumId = marchResult.y;

            if (drumId > 3.5) {
                // Ring hit — bright emissive cyan, no lighting needed
                color = vec3(0.15, 0.85, 1.0) * 4.0;
            } else {
                vec3  hitPos = rayOrigin + rayDir * marchResult.x;
                vec3  normal = calcNormal(hitPos);

                vec3 localPos;
                if      (drumId < 1.5) localPos = rotX(hitPos + vec3(DIST,  0.0, SIDE_Z_OFFSET), uAngle.x);
                else if (drumId < 2.5) localPos = rotX(hitPos,                                    uAngle.y);
                else                   localPos = rotX(hitPos + vec3(-DIST, 0.0, SIDE_Z_OFFSET),  uAngle.z);

                vec3 albedo = drumAlbedo(localPos);

                vec3 lightDir1 = normalize(vec3( 2.0,  4.0, 5.0));
                vec3 lightDir2 = normalize(vec3(-3.0, -1.0, 3.0));
                vec3 viewDir   = -rayDir;

                float diffuse  = max(dot(normal, lightDir1), 0.0) * 0.85
                               + max(dot(normal, lightDir2), 0.0) * 0.20;
                float specular = pow(max(dot(normal, normalize(lightDir1 + viewDir)), 0.0), 80.0);

                color = albedo * (0.08 + diffuse) + vec3(1.0) * specular * 0.55;
            }
        }

        // Additive cyan glow halo around rings — accumulated during march
        color += vec3(0.1, 0.65, 1.0) * ringGlow;

        float vignette = 1.0 - dot(uv * 0.65, uv * 0.65);
        color *= clamp(vignette, 0.0, 1.0);
        color = pow(max(color, 0.0), vec3(0.4545));

        gl_FragColor = vec4(color, 1.0);
    }
`;

// ─── Animation cycle ──────────────────────────────────────────────────────────
//
// One full cycle (9 s):
//   0.0 – 2.0   all spinning freely
//   3.0 – 4.8   center decelerates → snaps to sector
//   4.0 – 5.8   right  decelerates → snaps to sector
//   5.0 – 6.8   left  decelerates → snaps to sector (1.8 s, cubic ease-out)
//   5.8 – 7.3   all stopped (pause)
//   7.3 – 8.0   all spin back up (ease-in)
//   8.0 – 9.0   all spinning freely → loop
//
const SECTOR = (Math.PI * 2) / 6; // 60° per colour sector
const STOP_DUR = 1.8; // deceleration window
const CYCLE = 10;
const PAUSE_END = 7.3;
const START_DUR = 0.7;
const START_END = PAUSE_END + START_DUR; // 8.0

type Key = 'left' | 'center' | 'right';
const KEYS: Key[] = ['left', 'center', 'right'];
const STOP_START: Record<Key, number> = { left: 5, center: 3, right: 4 };

// Easing functions
function easeOutCubic(t: number) {
    const x = Math.max(0, Math.min(1, t));
    return 1 - (1 - x) ** 3;
}
function easeInQuad(t: number) {
    const x = Math.max(0, Math.min(1, t));
    return x * x;
}

// Per-drum accumulated state
const angle: Record<Key, number> = { left: 0, center: 0, right: 0 };
const stopFrom: Record<Key, number> = { left: 0, center: 0, right: 0 };
const stopTo: Record<Key, number> = { left: 0, center: 0, right: 0 };
const stopReady: Record<Key, boolean> = { left: false, center: false, right: false };

let lastNow = performance.now() / 1000;
let lastCt = 0;

const uAngle = { value: [0, 0, 0] };

(function animate() {
    const now = performance.now() / 1000;
    const dt = Math.min(now - lastNow, 0.05);
    lastNow = now;
    const cycleTime = now % CYCLE;

    // On cycle wrap: reset stop-initialisation flags for all drums
    if (cycleTime < lastCt) {
        KEYS.forEach((k) => {
            stopReady[k] = false;
        });
    }
    lastCt = cycleTime;

    KEYS.forEach((key, i) => {
        const stopStart = STOP_START[key];
        const stopEnd = stopStart + STOP_DUR;

        if (cycleTime < stopStart) {
            // Free spin — integrate angle normally
            angle[key] += speeds[key] * dt;
            stopReady[key] = false;
        } else if (cycleTime < stopEnd) {
            // Deceleration phase
            if (!stopReady[key]) {
                stopFrom[key] = angle[key];
                // Target: next clean sector boundary in the direction of travel
                stopTo[key] = Math.ceil(angle[key] / SECTOR) * SECTOR;
                stopReady[key] = true;
            }
            // Cubic ease-out interpolation → drum slows and settles at target
            angle[key] =
                stopFrom[key] +
                (stopTo[key] - stopFrom[key]) * easeOutCubic((cycleTime - stopStart) / STOP_DUR);
        } else if (cycleTime < PAUSE_END) {
            // Stopped — hold at sector boundary
            angle[key] = stopTo[key];
        } else if (cycleTime < START_END) {
            // Spin-up — ease-in from rest
            angle[key] += speeds[key] * easeInQuad((cycleTime - PAUSE_END) / START_DUR) * dt;
        } else {
            // Fully spinning again
            angle[key] += speeds[key] * dt;
        }

        uAngle.value[i] = angle[key];
    });
    requestAnimationFrame(animate);
})();

// ─── Boot ─────────────────────────────────────────────────────────────────────

try {
    new ShaderCanvas('#app', {
        fragmentShader,
        uniforms: { uAngle },
    });
} catch (e) {
    console.error('WebGL not supported', e);
}
