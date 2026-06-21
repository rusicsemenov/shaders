import './style.css';
import { ShaderCanvas } from './ShaderCanvas';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// ─── Base spin speed for each drum (radians/second) ──────────────────────────
const speeds = { left: 1.1, center: 1.9, right: 0.7 };

const gui = new GUI({ title: 'Slot drums' });
gui.add(speeds, 'left', 0, 6, 0.05).name('Left speed');
gui.add(speeds, 'center', 0, 6, 0.05).name('Center speed');
gui.add(speeds, 'right', 0, 6, 0.05).name('Right speed');

// ─── Background settings ──────────────────────────────────────────────────────
const uBgColor = { value: [0.04, 0.04, 0.07, 1.0] };
const bgSettings = { transparent: false, color: '#0a0a12' };

function hexToRgbFloat(hex: string): [number, number, number] {
    const n = Number.parseInt(hex.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function updateBg() {
    if (bgSettings.transparent) {
        uBgColor.value = [0, 0, 0, 0];
    } else {
        const [r, g, b] = hexToRgbFloat(bgSettings.color);
        uBgColor.value = [r, g, b, 1];
    }
}

const bgFolder = gui.addFolder('Background');
bgFolder.add(bgSettings, 'transparent').name('Transparent').onChange(updateBg);
bgFolder.addColor(bgSettings, 'color').name('Color').onChange(updateBg);

// ─── Fragment shader ──────────────────────────────────────────────────────────
const fragmentShader = /*language=GLSL*/ `
    precision mediump float;

    uniform float     iTime;
    uniform vec3      iResolution;
    uniform vec3      uAngle;       // accumulated rotation angle: left / center / right
    uniform sampler2D uIconAtlas;   // 6-cell horizontal atlas of user SVG icons
    uniform vec4      uBgColor;     // .rgb = background color, .a = 0 for transparent

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

    // ── Symbol panel SDF ─────────────────────────────────────────────────────────
    const float SYM_EXTRUDE  = 0.020;  // protrusion above drum surface
    const float PANEL_HALF_U = 0.34;   // panel half-width  (arc direction)
    const float PANEL_HALF_V = 0.30;   // panel half-height (axial direction)

    // Signed distance to a centred axis-aligned rectangle with given half-extents.
    float sdRect2(vec2 p, vec2 h) {
        vec2 d = abs(p) - h;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }

    // Returns the SDF of a flat icon panel extruded from the drum surface.
    // localPos is already in drum local space (after rotX + translation).
    float drumSymbolDist(vec3 localPos) {
        if (abs(localPos.x) > DRUM_H - 0.05) return 1000.0;

        float sectorAngle = atan(localPos.z, localPos.y);
        float sectorIndex = (sectorAngle / (PI * 2.0) + 0.5) * 6.0;
        float sectorFrac  = fract(sectorIndex);
        if (sectorFrac < 0.06 || sectorFrac > 0.94) return 1000.0;

        float centerAngle = (mod(floor(sectorIndex), 6.0) + 0.5) / 6.0 * (PI * 2.0) - PI;
        float u           = (sectorAngle - centerAngle) * DRUM_R;

        float radial = length(localPos.yz) - DRUM_R;
        return max(sdRect2(vec2(u, localPos.x), vec2(PANEL_HALF_U, PANEL_HALF_V)),
                   abs(radial) - SYM_EXTRUDE);
    }

    // Returns (distance, objectId) for the scene.
    // Drums: 1=left 2=center 3=right   Rings: 4   Icon panels: 5=left 6=center 7=right
    vec2 scene(vec3 point) {
        float drumCenterX = clamp(floor(point.x / DIST + 0.5), -1.0, 1.0);

        float drumDist, symDist, drumId;
        if (drumCenterX < -0.5) {
            vec3 lp  = rotX(point + vec3(DIST, 0.0, SIDE_Z_OFFSET), uAngle.x);
            drumDist = sdCylinder(lp, DRUM_R, DRUM_H);
            symDist  = drumSymbolDist(lp);
            drumId   = 1.0;
        } else if (drumCenterX > 0.5) {
            vec3 lp  = rotX(point + vec3(-DIST, 0.0, SIDE_Z_OFFSET), uAngle.z);
            drumDist = sdCylinder(lp, DRUM_R, DRUM_H);
            symDist  = drumSymbolDist(lp);
            drumId   = 3.0;
        } else {
            vec3 lp  = rotX(point, uAngle.y);
            drumDist = sdCylinder(lp, DRUM_R, DRUM_H);
            symDist  = drumSymbolDist(lp);
            drumId   = 2.0;
        }

        float ringDist = nearestRing(point);
        if (ringDist < drumDist && ringDist < symDist) return vec2(ringDist, 4.0);
        if (symDist  < drumDist)                       return vec2(symDist,  drumId + 4.0);
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

    // Returns drum surface colour: grey cap, black stripe, or dark sector base.
    vec3 drumAlbedo(vec3 localPos) {
        if (abs(localPos.x) > DRUM_H - 0.05) return vec3(0.22, 0.22, 0.26);
        float sectorAngle = atan(localPos.z, localPos.y);
        float sectorIndex = (sectorAngle / (PI * 2.0) + 0.5) * 6.0;
        float sectorFrac  = fract(sectorIndex);
        if (sectorFrac < 0.06 || sectorFrac > 0.94) return vec3(0.03);
        return vec3(0.04, 0.04, 0.08);
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
        float fragAlpha;
        bool isMiss = marchResult.x < 0.0;

        if (isMiss) {
            color = uBgColor.rgb;
            fragAlpha = uBgColor.a;
        } else {
            fragAlpha = 1.0;
            float drumId = marchResult.y;

            if (drumId > 4.5) {
                // Icon panel hit (drumId 5=left 6=center 7=right)
                vec3 hitPos = rayOrigin + rayDir * marchResult.x;
                vec3 normal = calcNormal(hitPos);

                // Reconstruct drum-local position to get sector UV
                vec3 localPos;
                if      (drumId < 5.5) localPos = rotX(hitPos + vec3(DIST,  0.0, SIDE_Z_OFFSET), uAngle.x);
                else if (drumId < 6.5) localPos = rotX(hitPos,                                    uAngle.y);
                else                   localPos = rotX(hitPos + vec3(-DIST, 0.0, SIDE_Z_OFFSET),  uAngle.z);

                float sectorAngle = atan(localPos.z, localPos.y);
                float sectorIndex = (sectorAngle / (PI * 2.0) + 0.5) * 6.0;
                float sectorIdx   = mod(floor(sectorIndex), 6.0);
                float centerAngle = (sectorIdx + 0.5) / 6.0 * (PI * 2.0) - PI;
                float u           = (sectorAngle - centerAngle) * DRUM_R;

                // Map panel coords → atlas UV, rotated +90°
                float localU = clamp(u / (PANEL_HALF_U * 2.0) + 0.5, 0.0, 1.0);
                float localV = clamp(localPos.x / (PANEL_HALF_V * 2.0) + 0.5, 0.0, 1.0);
                // -90° rotation: new_u = localV, new_v = 1 - localU
                vec4  icon   = texture2D(uIconAtlas, vec2((sectorIdx + localV) / 6.0, 1.0 - localU));

                float lum   = dot(icon.rgb, vec3(0.299, 0.587, 0.114));
                float pulse = 0.7 + 0.3 * sin(iTime * 2.5);
                float diff  = max(dot(normal, normalize(vec3(2.0, 4.0, 5.0))), 0.0);
                color = vec3(0.1, 0.65, 1.0) * lum * pulse * (2.0 + diff * 1.5);
            } else if (drumId > 3.5) {
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

        // In transparent mode, glow alone makes miss pixels semi-visible
        if (isMiss && uBgColor.a < 0.5) {
            fragAlpha = clamp(ringGlow * 8.0, 0.0, 1.0);
        }

        float vignette = 1.0 - dot(uv * 0.65, uv * 0.65);
        color *= clamp(vignette, 0.0, 1.0);
        color = pow(max(color, 0.0), vec3(0.4545));

        gl_FragColor = vec4(color, fragAlpha);
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

// ─── SVG icons (replace these 6 strings with your own SVGs) ──────────────────
//
// Each SVG is drawn into a 256×256 cell. Use stroke="white" fill="none" so
// the luminance mask in the fragment shader picks up your outlines in cyan.

const ICON_SVGS = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100.000000 100.000000">
        <path fill="none" stroke="white" d="M83.8 32.2c-14 13.6-13.4 13.2-15.6 9.8-.7-1.1-2.1-2-3.1-2-1.9 0-6.1 4.7-6.1 6.8 0 .5-.6 1.5-1.4 2.1-1.1 1-1.9.5-3.9-2.1-4.9-6.3-4.4-11.3 1.6-17.7l3.2-3.4-4 2.3c-6.8 3.9-22.9 14.7-25.1 16.9-2.8 2.6-3.7 1.6-1.8-2 1.6-3.1 1.8-2.9-3.4-3.2-1-.1-3.7.5-6.1 1.3-3.6 1.2-4.1 1.7-3.6 3.4 1.8 5.6 1.7 7.4-.6 9.7l-2.2 2.2-2.4-2.7c-2.7-3.1-2.9-5.4-.8-8.2.8-1 1.5-2.2 1.5-2.5 0-.7-8-3.2-8.5-2.7-.2.2.6 3 1.7 6.3C5.4 53.1 9.3 59 11.5 59c2.2 0 6.2-6 8.2-12.2 1-3.2 2.1-5.8 2.6-5.8.7 0 2.3 5.8 1.9 7.2-.1.5.2.8.8.8.5 0 1 .7 1 1.6 0 1.3.5 1.2 2.7-.5 1.4-1.2 2.8-2 2.9-1.8.2.2-.5 2.5-1.5 5.3-1.6 4-2.1 4.5-2.6 2.9C26.3 53 24.7 50 24 50c-1 0-8.8 9.2-13.5 16-3.6 5-3.1 4.7 4.8-3.5 6.5-6.8 8.4-8.3 7.7-6.1l-1 2.9 4.7-.5c2.7-.3 6.1-1.1 7.6-1.7 2.4-.9 2.6-1.4 1.7-3.1-.9-1.7-.7-2.2 1.2-2.9 2.2-.8 5.8-.4 5.8.7 0 .3-.7 1.3-1.5 2.2-1.5 1.6-1.3 1.9 2.5 3.4 2.2.9 4.3 1.6 4.6 1.6 1 0-.4-5.7-2.5-10-1-2.2-1.5-4-.9-4 2 0 6.5 3.3 8.4 6.1 2.1 3.2 3.4 3.7 3.4 1.4 0-1.3.3-1.3 2.6.1 1.6 1.1 2.3 2.3 1.9 3.3-.3.9.6.1 2-1.6 3-3.7 6.3-4.7 4.5-1.4-.5 1.1-1 2.3-1 2.8 0 1.1 7.2 3.3 10.9 3.3h2.9l-1.4-3.8c-1.5-4.2-1.7-7.2-.6-8.9.9-1.5 12.2 8.8 12.2 11.2 0 1 .9 1.5 2.6 1.5 2.1 0 2.5-.4 2-1.7-1.5-3.7-1.8-10.3-.7-13.4 1.3-3.7.4-4.9-3.4-4.1-2.2.4-2.3.6-1 2.6 1.6 2.4 3.1 11.6 1.8 11.6-.4 0-3.2-2.2-6.2-4.8-8-7.1-7.8-8.8 1.7-15.3 4.3-2.9 7.9-5.3 8-5.5.2-.1-.5-1.1-1.6-2.2-2-2-2-2-10.4 6zM41.5 42c1.4 1.6 1.5 2 .4 2-.8 0-2-.5-2.5-1-.7-.7-1.6-.4-2.8.8-1.6 1.9-1.5 1.9 2.1 1.8 2.8-.1 3.8.3 4.1 1.6.3 1.5-.4 1.8-3.6 1.8-3.3 0-4.1-.4-4.5-2.2-.4-1.5.1-3 1.5-4.5 2.6-2.8 3-2.8 5.3-.3zM67 44.5c1.5 1.9-.3 4.5-3.1 4.5-2.7 0-3.3-1.9-1.3-4.1 2.1-2.3 2.8-2.4 4.4-.4zm9.4 3.7c.3 2.4.2 5.6-.2 7.3-.9 2.9-.9 2.9-2.6-2.8-1.3-4.5-1.4-6.2-.5-7.3 1.9-2.3 2.6-1.6 3.3 2.8zM71 46.4c0 .3-.4.8-1 1.1-.5.3-1 .1-1-.4 0-.6.5-1.1 1-1.1.6 0 1 .2 1 .4z"/>
        <path fill="none" stroke="white" d="M54.7 57c-.4 1.6 0 2 1.8 2 1.3 0 2.7-.5 3.1-1.2.5-.8.2-.9-.9-.5s-1.7.1-1.7-.8c0-2.2-1.7-1.8-2.3.5z"/>
    </svg>`,
    // 0 — circle
    //`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><circle cx="128" cy="128" r="100" fill="none" stroke="white" stroke-width="14"/></svg>`,
    // 1 — square
    //`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect x="28" y="28" width="200" height="200" fill="none" stroke="white" stroke-width="14"/></svg>`,
    `<svg width="256" height="256" viewBox="0 0 256 77" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M114.255 66.2984H108.306C108.28 65.8395 108.247 65.4138 108.24 64.9881C108.24 60.8977 108.24 56.8073 108.227 52.7168C108.227 51.8788 108.167 51.0341 108.068 50.2027C107.789 47.8482 106.675 46.6044 104.566 46.2386C102.344 45.8595 100.176 46.784 99.3732 48.7661C98.8759 49.9899 98.6437 51.3933 98.6172 52.7235C98.5244 56.774 98.584 60.8245 98.584 64.8751C98.584 65.3074 98.584 65.7397 98.584 66.2585H92.4959C92.476 65.8661 92.4429 65.4471 92.4429 65.028C92.4429 61.0174 92.4561 57.0068 92.4296 52.9962C92.423 51.9586 92.35 50.9077 92.1709 49.8901C91.7863 47.7351 90.4466 46.4515 88.4637 46.2054C86.3547 45.946 84.3452 46.9503 83.5693 48.8858C83.1515 49.9367 82.9127 51.1272 82.8928 52.2579C82.8133 56.4681 82.8597 60.6782 82.8597 64.895C82.8597 65.3274 82.8597 65.7597 82.8597 66.2718H76.7052C76.6787 65.8661 76.6389 65.4803 76.6389 65.0946C76.6389 58.0377 76.6389 50.9742 76.6389 43.9174C76.6389 42.3078 77.8592 41.0973 79.4641 41.0973C79.9814 41.0973 80.512 41.0707 81.0226 41.1372C82.1169 41.2836 82.8 42.0551 82.8531 43.1725C82.8796 43.6913 82.8531 44.2167 82.8531 44.7355C82.8531 45.2144 82.8531 45.6932 82.8531 46.5246C84.3519 42.9064 86.7991 41.0774 90.4334 41.0574C94.1207 41.0375 96.6409 42.8 98.0004 46.4581C99.1212 43.7844 100.885 42.0551 103.472 41.3833C107.743 40.2792 113.546 41.4432 114.143 48.5133C114.64 54.3597 114.242 60.2858 114.242 66.2984H114.255Z" fill="none" stroke="white"/>
        <path d="M190.954 63.1127C190.954 64.137 190.954 65.1613 190.954 66.1856C190.954 68.9524 190.967 71.7193 190.954 74.4862C190.947 76.2554 190.231 76.9604 188.473 76.967C187.346 76.967 186.093 77.253 185.423 75.9295C185.164 75.424 184.839 74.8653 184.832 74.3332C184.799 63.8643 184.806 53.3955 184.806 42.9266C184.806 41.4567 185.933 40.326 187.399 40.3194C187.837 40.3194 188.281 40.3127 188.719 40.3194C190.191 40.346 190.901 41.051 190.947 42.5408C190.96 43.0064 190.947 43.4786 190.947 44.2502C193.374 41.3702 196.379 40.8381 199.589 41.0909C203.986 41.4301 207.149 43.6183 208.621 47.8351C210.107 52.0785 210.014 56.3685 208.104 60.4789C204.768 67.6555 194.82 67.9348 190.947 63.1061L190.954 63.1127ZM203.793 53.2026C203.734 52.7636 203.674 51.9588 203.515 51.1806C202.885 48.1411 200.55 46.2788 197.32 46.2123C194.223 46.1457 191.849 47.8351 191.06 50.7616C190.483 52.9033 190.523 55.0582 191.332 57.1334C192.201 59.3682 193.859 60.7383 196.233 61.0442C198.7 61.3635 200.829 60.6452 202.354 58.5634C203.435 57.0802 203.74 55.3575 203.8 53.2026H203.793Z" fill="none" stroke="white"/>
        <path d="M98.8956 32.1523H92.8075C92.7876 31.7465 92.7544 31.3608 92.7544 30.975C92.7544 21.5969 92.7544 12.2122 92.7544 2.83413C92.7544 1.1514 93.8752 0.0473123 95.5663 0.0473123C95.9245 0.0473123 96.2892 0.0340101 96.6473 0.0539635C98.1793 0.147079 98.8823 0.8654 98.8956 2.42176C98.9155 4.98909 98.8956 7.54978 98.9022 10.1171C98.9022 10.5029 98.9022 10.882 98.9022 11.2678C100.122 9.14604 101.853 7.84242 104.115 7.26378C106.284 6.71173 108.485 6.66518 110.601 7.46996C114.109 8.80684 115.628 11.6735 115.741 15.172C115.92 20.7389 115.787 26.3126 115.781 31.8862C115.781 31.9527 115.721 32.0259 115.661 32.1523H109.659C109.659 31.68 109.659 31.2145 109.659 30.7555C109.633 25.9867 109.686 21.2178 109.553 16.449C109.46 13.2365 107.656 11.5138 104.725 11.4806C101.456 11.4407 99.1211 13.3629 99.015 16.5155C98.8558 21.2378 98.9221 25.9734 98.8956 30.7023C98.8956 31.1745 98.8956 31.6468 98.8956 32.1656V32.1523Z" fill="none" stroke="white"/>
        <path d="M143.045 20.9842H125.271C124.893 25.0547 128.242 28.0211 132.46 27.5422C134.635 27.2961 136.307 26.4447 137.189 24.2499C137.865 22.5671 140.113 21.7956 141.705 22.6203C142.149 22.8465 142.633 23.3985 142.706 23.8641C142.919 25.2409 142.846 26.4913 141.718 27.7085C137.673 32.0915 132.752 32.9961 127.254 31.6526C123.321 30.6948 120.761 28.1541 119.76 24.1834C118.964 21.0108 118.99 17.8315 119.952 14.6922C121.126 10.8612 123.666 8.367 127.539 7.40924C131.478 6.43152 135.391 6.54459 138.774 9.08532C142.7 12.0318 143.23 16.3217 143.045 20.9975V20.9842ZM125.251 17.1531H137.135C137.308 13.8675 135.126 11.3733 132.009 11.2336C127.897 11.0474 125.437 13.1758 125.251 17.1531Z" fill="none" stroke="white"/>
        <path d="M248.619 55.1518H230.938C230.719 58.617 232.868 61.2509 236.137 61.5834C237.046 61.6766 237.981 61.6633 238.883 61.5435C240.667 61.3107 241.967 60.3995 242.736 58.6902C243.2 57.6526 243.757 56.5752 245.157 56.5352C248.061 56.4554 248.625 57.0141 248.453 59.9273C248.426 60.3264 248.247 60.7853 247.995 61.0979C243.446 66.6516 237.503 67.5495 231.13 65.1484C228.04 63.9845 226.236 61.4903 225.42 58.3244C224.644 55.3181 224.671 52.2785 225.473 49.2855C226.74 44.5566 230.52 41.4572 235.441 41.118C236.747 41.0315 238.094 41.0049 239.387 41.2044C244.891 42.0624 248.194 45.7338 248.658 51.3873C248.731 52.2652 248.764 53.1432 248.778 54.0278C248.778 54.3404 248.692 54.6596 248.612 55.1518H248.619ZM230.951 51.2143H242.842C242.855 47.6161 240.607 45.368 237.059 45.3348C233.458 45.3015 230.951 47.6826 230.958 51.2143H230.951Z" fill="none" stroke="white"/>
        <path d="M142.335 66.2785H136.227V61.1039C135.544 62.1016 135.08 62.9862 134.43 63.7045C132.089 66.2718 127.791 67.1032 124.216 65.6732C120.602 64.2233 119.368 61.1837 119.289 57.5988C119.183 52.9097 119.256 48.2207 119.269 43.525C119.269 42.3677 120.575 41.0973 121.71 41.084C122.187 41.084 122.671 41.0707 123.149 41.084C124.667 41.1505 125.404 41.8955 125.404 43.4319C125.417 47.1632 125.404 50.8878 125.404 54.6191C125.404 54.9383 125.404 55.2576 125.404 55.5835C125.423 59.2349 127.148 61.2635 130.265 61.3034C133.753 61.35 136.061 59.1485 136.127 55.5702C136.2 51.646 136.167 47.7152 136.187 43.7844C136.187 42.3012 137.381 41.0907 138.84 41.084C139.198 41.084 139.563 41.0774 139.921 41.084C141.572 41.1239 142.342 41.8423 142.395 43.5117C142.434 44.669 142.342 45.8329 142.342 46.9969C142.335 52.9297 142.342 58.8625 142.342 64.7953V66.2718L142.335 66.2785Z" fill="none" stroke="white"/>
        <path d="M82.8662 6.89727H87.6147V11.706H82.8662V15.3841C82.8662 18.151 82.8662 20.9112 82.8662 23.678C82.8662 26.3385 83.7615 27.1965 86.4143 27.1632C86.8918 27.1632 87.3693 27.1632 88.0192 27.1632C88.0192 28.5666 88.0457 29.9567 87.9927 31.3335C87.9861 31.533 87.608 31.839 87.3627 31.8855C85.0547 32.3311 82.7535 32.391 80.5251 31.5131C77.7198 30.4023 76.7184 28.0478 76.6852 25.281C76.6056 17.6721 76.6454 10.0566 76.6587 2.44767C76.6587 1.30368 78.0249 0.0599205 79.1722 0.0466182C79.6497 0.0399671 80.1338 0.0266649 80.6113 0.0532693C82.1499 0.139734 82.8529 0.871357 82.8662 2.41442C82.8795 3.85106 82.8662 5.29435 82.8662 6.90392V6.89727Z" fill="none" stroke="white"/>
        <path d="M169.745 61.3093V65.8853C166.939 66.5504 164.187 66.6501 161.568 65.3066C159.85 64.422 158.955 62.8723 158.649 60.9967C158.51 60.132 158.437 59.2408 158.437 58.3628C158.417 51.306 158.431 44.2492 158.431 37.199C158.431 35.2968 159.518 34.2259 161.442 34.2259C161.839 34.2259 162.244 34.206 162.642 34.2326C163.882 34.319 164.618 35.064 164.645 36.3277C164.678 37.8441 164.651 39.3672 164.651 41.0167H169.413V45.8986H164.651C164.651 47.7676 164.651 49.5235 164.651 51.2727C164.651 53.4344 164.651 55.6026 164.651 57.7642C164.651 60.4846 165.514 61.3226 168.266 61.3093C168.737 61.3093 169.208 61.3093 169.745 61.3093Z" fill="none" stroke="white"/>
        <path d="M153.51 66.2791H147.349C147.329 65.8269 147.296 65.4411 147.296 65.0487C147.296 55.7039 147.296 46.3524 147.296 37.0076C147.296 35.3315 148.423 34.2274 150.121 34.2208C150.519 34.2208 150.923 34.2075 151.321 34.2208C152.701 34.2806 153.43 35.0122 153.516 36.4023C153.53 36.6817 153.516 36.961 153.516 37.247C153.516 46.4322 153.516 55.6174 153.516 64.8093C153.516 65.2482 153.516 65.6872 153.516 66.2725L153.51 66.2791Z" fill="none" stroke="white"/>
        <path d="M220.088 66.2725H213.98C213.953 65.8269 213.907 65.3613 213.907 64.9024C213.907 55.644 213.907 46.379 213.907 37.1206C213.907 35.3714 215.041 34.2208 216.745 34.2208C217.143 34.2208 217.548 34.2075 217.946 34.2208C219.358 34.2806 220.081 34.9856 220.088 36.4023C220.108 39.5683 220.095 42.7342 220.095 45.9001C220.095 52.1921 220.095 58.4907 220.095 64.7826V66.2658L220.088 66.2725Z" fill="none" stroke="white"/>
        <path d="M179.772 66.2917H173.644C173.625 65.8128 173.585 65.3871 173.585 64.9548C173.585 58.4234 173.585 51.8987 173.585 45.3673C173.585 43.6313 174.719 42.4873 176.43 42.4873C176.788 42.4873 177.146 42.4807 177.511 42.4873C179.049 42.5272 179.766 43.2323 179.766 44.7953C179.779 49.8435 179.766 54.885 179.766 59.9332C179.766 62.0084 179.766 64.0902 179.766 66.285L179.772 66.2917Z" fill="none" stroke="white"/>
        <path d="M179.759 37.2196C179.759 38.9821 178.373 40.3389 176.622 40.299C174.938 40.2591 173.572 38.869 173.585 37.2062C173.598 35.4969 175.064 34.0603 176.755 34.1002C178.446 34.1401 179.766 35.5036 179.759 37.2129V37.2196Z" fill="none" stroke="white"/>
        <path d="M54.7468 43.6513L50.0116 50.1228H43.6316L43.4525 39.6207L37.6828 50.1162H29.0612L23.3246 39.0155L23.0991 50.1162H11.9375V20.0465C11.9243 16.4349 15.5984 15.9161 15.5984 15.9161L20.6718 15.823C21.9584 15.8031 23.4241 16.129 24.2398 17.1266C25.1285 18.2174 25.6524 19.5077 26.2095 20.7448C27.0318 22.5739 27.8608 24.403 28.6832 26.232C30.1157 29.4112 31.5482 32.5905 32.9807 35.7697L40.9656 18.6098C42.1328 16.0758 44.8851 15.8563 44.8851 15.8563L50.94 15.8363C54.7269 15.8563 54.8131 19.541 54.8131 19.541L54.7534 43.6646L54.7468 43.6513ZM66.744 4.34318C66.744 1.94213 64.8074 0 62.4133 0H4.33067C1.93653 0 0 1.94213 0 4.34318V61.882C0 64.2831 1.93653 66.2252 4.33067 66.2252H57.6051L66.7506 53.6546V4.34318H66.744Z" fill="none" stroke="white"/>
        <path d="M253.241 42.9008C253.188 42.8875 253.135 42.8875 253.088 42.8809C252.976 42.8809 252.863 42.8809 252.75 42.8809V43.6324C252.856 43.6324 252.956 43.6324 253.055 43.6324C253.115 43.6324 253.181 43.6324 253.241 43.6125C253.374 43.5859 253.467 43.5127 253.493 43.3797C253.506 43.3265 253.506 43.2666 253.506 43.2068C253.5 43.0338 253.413 42.9341 253.248 42.9008H253.241Z" fill="none" stroke="white"/>
        <path d="M253.493 43.3797C253.467 43.5194 253.374 43.5925 253.241 43.6125C253.181 43.6258 253.115 43.6258 253.055 43.6324C252.956 43.6324 252.85 43.6324 252.75 43.6324V42.8809C252.863 42.8809 252.976 42.8809 253.088 42.8809C253.142 42.8809 253.195 42.8809 253.241 42.9008C253.413 42.9341 253.493 43.0338 253.5 43.2068C253.5 43.2666 253.5 43.3265 253.486 43.3797H253.493Z" fill="none" stroke="white"/>
        <path d="M255.973 43.5053C255.934 43.1794 255.841 42.8735 255.688 42.5875C255.29 41.8292 254.674 41.3504 253.851 41.1442C253.566 41.071 253.274 41.0511 252.976 41.0777C252.392 41.1309 251.868 41.3437 251.424 41.7228C250.927 42.1418 250.621 42.6806 250.482 43.3191C250.429 43.5718 250.416 43.8312 250.436 44.0973C250.489 44.656 250.688 45.1614 251.039 45.6071C251.464 46.1392 252.014 46.4584 252.671 46.6047C252.79 46.6313 252.91 46.638 253.029 46.6513C253.042 46.6513 253.055 46.6513 253.069 46.6579H253.367C253.433 46.6513 253.506 46.638 253.573 46.6313C253.891 46.5914 254.189 46.4983 254.475 46.352C255.264 45.9396 255.748 45.2945 255.947 44.4232C255.973 44.2968 255.98 44.1704 256 44.0441C256 44.0308 256 44.0108 256.007 43.9975V43.7182C256 43.645 255.993 43.5718 255.98 43.5053H255.973ZM254.422 45.2546C254.236 45.2546 254.05 45.2546 253.871 45.2546C253.838 45.2546 253.825 45.2413 253.811 45.2147C253.692 44.9752 253.579 44.7291 253.46 44.4897C253.433 44.4365 253.4 44.3899 253.367 44.3367C253.301 44.2369 253.208 44.1704 253.089 44.1571C252.982 44.1438 252.87 44.1438 252.757 44.1372V45.2413H252.008V42.3281C252.008 42.3281 252.021 42.3281 252.027 42.3281C252.439 42.3281 252.85 42.3281 253.261 42.3281C253.447 42.3281 253.626 42.3547 253.798 42.4145C254.063 42.5076 254.223 42.7005 254.256 42.9799C254.276 43.1462 254.269 43.3058 254.209 43.4588C254.123 43.6649 253.957 43.7847 253.758 43.8578C253.745 43.8578 253.738 43.8645 253.725 43.8711C253.725 43.8711 253.725 43.8778 253.732 43.8778C253.904 43.931 254.024 44.0441 254.11 44.197C254.209 44.3766 254.302 44.5628 254.395 44.7424C254.475 44.8954 254.548 45.0484 254.621 45.208C254.621 45.2147 254.627 45.228 254.634 45.2413H254.428L254.422 45.2546Z" fill="none" stroke="white"/>
    </svg>`,
    // 2 — triangle
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><polygon points="128,22 238,220 18,220" fill="none" stroke="white" stroke-width="14" stroke-linejoin="round"/></svg>`,
    // 3 — 5-pointed star
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><polygon points="128,18 156,96 240,96 174,144 198,226 128,176 58,226 82,144 16,96 100,96" fill="none" stroke="white" stroke-width="14" stroke-linejoin="round"/></svg>`,
    // 4 — diamond
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><polygon points="128,18 238,128 128,238 18,128" fill="none" stroke="white" stroke-width="14" stroke-linejoin="round"/></svg>`,
    // 5 — cross / plus
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M108,22 L108,108 L22,108 L22,148 L108,148 L108,234 L148,234 L148,148 L234,148 L234,108 L148,108 L148,22 Z" fill="none" stroke="white" stroke-width="14" stroke-linejoin="round"/></svg>`,
];

async function buildAtlas(svgs: string[]): Promise<HTMLCanvasElement> {
    const S = 256;
    const canvas = document.createElement('canvas');
    canvas.width = S * svgs.length;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    for (let i = 0; i < svgs.length; i++) {
        const img = new Image();
        img.src = `data:image/svg+xml,${encodeURIComponent(svgs[i])}`;
        await new Promise<void>((resolve) => {
            img.onload = () => resolve();
        });
        ctx.drawImage(img, i * S, 0, S, S);
    }
    return canvas;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

(async () => {
    try {
        const atlas = await buildAtlas(ICON_SVGS);
        new ShaderCanvas('#app', {
            fragmentShader,
            uniforms: { uAngle, uBgColor },
            canvasTextures: { uIconAtlas: atlas },
        });
    } catch (e) {
        console.error('Failed to initialize', e);
    }
})();
