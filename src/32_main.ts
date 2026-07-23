import './style.css';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// https://spd.tech

function hexToRgb(hex: string): [number, number, number] {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const canvas = document.createElement('canvas');
canvas.classList.add('bg-canvas');
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d')!;

// CSS sizes the canvas with dvw/dvh (see .bg-canvas in style.css) so it
// tracks Safari's collapsing toolbar correctly. window.innerHeight doesn't
// update the same way, so the drawing buffer is sized off the element's
// actual rendered box instead.
let cssWidth = 0;
let cssHeight = 0;

function resize(): void {
    const rect = canvas.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = cssWidth * devicePixelRatio;
    canvas.height = cssHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();

const heroStyle = document.createElement('style');
heroStyle.textContent = `
    .hero-text {
        position: fixed;
        top: 50%;
        left: 15%;
        transform: translateY(-50%);
        max-width: 845px;
        color: #fff;
        pointer-events: none;
        z-index: 1;

        &.d-flex {
            display: flex;
        }

        &.flex-column {
            flex-direction: column;
        }

        &.align-items-center {
            align-items: center;
        }

        &.mt-5 {
            margin-top: 3rem;
        }

        &.text-center,
        .text-center {
            text-align: center;
        }

        @media (min-width: 1024px) {
            &.mt-lg-0 {
                margin-top: 0;
            }

            &.align-items-lg-start {
                align-items: flex-start;
            }

            &.text-lg-left,
            .text-lg-left {
                text-align: left;
            }
        }

        .title {
            margin: 0;
            font-family: var(--heading);
            font-size: clamp(2.25rem, 5vw, 3.5rem);
            font-weight: 700;
            line-height: 1.15;
            letter-spacing: -0.02em;
            color: #fff;

            &.mb-4 {
                margin-bottom: 1.5rem;
            }

            &.text-bold {
                font-weight: 700;
            }
        }

        .title-highlight {
            background: linear-gradient(to right, #f9ae35 0%, #ee4646 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .sub-title-wrap {
            max-width: 530px;
        }

        .sub-title {
            margin: 1.5rem 0 2rem;
            font-size: 1.15rem;
            line-height: 1.5;
            color: rgba(255, 255, 255, 0.75);
        }
    }
    @media (max-width: 1024px) {
        .hero-text {
            left: 5%;
        }
    }
    @media (max-width: 924px) {
        .hero-text {
            left: unset;
        }
    }
`;
document.head.appendChild(heroStyle);

const hero = document.createElement('div');
hero.innerHTML = `
    <div class="hero-text d-flex flex-column mt-5 mt-lg-0 align-items-center text-center align-items-lg-start text-lg-left">
        <h1 class="title mb-4 text-bold">
            Global <span class="title-highlight">Software Product Development</span> Company
        </h1>
        <div class="sub-title-wrap">
            <p class="sub-title text-center text-lg-left">Accelerating Growth with Strategic Tech Solutions</p>
        </div>
    </div>
`;
document.body.appendChild(hero);

// Lattice value noise: hash the 4 corners of the cell containing (x, y),
// then smoothstep-interpolate between them. Same idea as the GLSL
// hash()/noise() pair in main.ts, ported to run per-line on the CPU
// instead of per-pixel on the GPU.
function hash2(x: number, y: number): number {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

function noise2D(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);

    const u = smooth(xf);
    const v = smooth(yf);

    return a + (b - a) * u + (c - a) * v * (1 - u) + (d - b) * u * v;
}

const config = {
    lineCount: 40,
    clusterStart: 0.95, // fraction of width where the line cluster begins
    spacingStart: 20, // px gap between neighboring lines at y=0
    spacingEnd: 40, // px gap between neighboring lines at y=height
    amplitude: 110, // px of horizontal sway from noise
    noiseScale: 0.00202, // noise frequency along the y-axis
    lineNoiseStep: 0.123, // how far apart neighboring lines sit in noise space — smaller = more correlated
    timeScale: 0.00055, // how fast the noise field drifts over time
    segmentStep: 2, // vertical px between sampled points on a line
    widthStart: 2.5, // stroke width at y=0
    widthEnd: 1.6, // stroke width at y=height
    lineColor: '#a8c6fe',
    opacityMin: 0.05, // alpha of the outermost lines
    opacityMax: 0.8, // alpha of the center line
    backgroundColor: '#05182b',
};

function applyBackgroundColor(): void {
    document.body.style.backgroundColor = config.backgroundColor;
}
applyBackgroundColor();

interface Point {
    x: number;
    y: number;
    width: number;
}

function samplePoint(
    lineIndex: number,
    time: number,
    width: number,
    height: number,
    y: number,
): Point {
    const t = y / height;

    // Gap between neighboring lines tapers from spacingStart at y=0 to
    // spacingEnd at y=height, so the whole cluster narrows or fans out
    // instead of staying a fixed width top to bottom.
    const spacing = config.spacingEnd + (config.spacingStart - config.spacingEnd) * (1 - t);
    const baseX = width * config.clusterStart - lineIndex * spacing;

    // Each line reads the same drifting noise field but offset along x
    // by its own index, so neighbors stay close while still tracing
    // distinct paths instead of moving in lockstep.
    const n = noise2D(
        y * config.noiseScale,
        lineIndex * config.lineNoiseStep + time * config.timeScale,
    );
    // Envelope pins both endpoints (t=0 and t=1) to baseX and lets the
    // noise offset grow toward the middle of the line, so only the
    // body sways while start/end stay put.
    const envelope = Math.sin(Math.PI * t);
    const offset = (n - 0.5) * 2 * config.amplitude * envelope;
    const lineWidth = config.widthEnd + (config.widthStart - config.widthEnd) * (1 - t);

    return { x: baseX + offset, y, width: lineWidth };
}

function buildLinePoints(lineIndex: number, time: number, width: number, height: number): Point[] {
    const points: Point[] = [];

    for (let y = 0; y < height; y += config.segmentStep) {
        points.push(samplePoint(lineIndex, time, width, height, y));
    }
    // segmentStep rarely divides height evenly, so the loop above can stop
    // short of the bottom edge — always sample the true edge explicitly so
    // the envelope fully reaches t=1 and the line touches the border.
    points.push(samplePoint(lineIndex, time, width, height, height));

    return points;
}

function drawSmoothLine(points: Point[]): void {
    if (points.length < 2) return;

    // Canvas can only stroke a whole path with one lineWidth, so each
    // curve piece (same midpoint-smoothing shape as before) is stroked
    // separately to let width taper from widthStart to widthEnd.
    let prev = points[0];

    for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;

        ctx.lineWidth = curr.width;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
        ctx.stroke();

        prev = { x: midX, y: midY, width: curr.width };
    }

    const last = points.at(-1)!;
    ctx.lineWidth = last.width;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
}

function render(time: number): void {
    const width = cssWidth;
    const height = cssHeight;

    ctx.clearRect(0, 0, width, height);

    const [r, g, b] = hexToRgb(config.lineColor);

    for (let i = 0; i < config.lineCount; i++) {
        const t = i / (config.lineCount - 1); // 0 at first line, 1 at last line
        const centerWeight = Math.sin(Math.PI * t); // 0 at both edges, 1 at center
        const alpha = config.opacityMin + centerWeight * (config.opacityMax - config.opacityMin);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        drawSmoothLine(buildLinePoints(i, time, width, height));
    }

    requestAnimationFrame(render);
}

requestAnimationFrame(render);

const gui = new GUI();
gui.close();

const lines = gui.addFolder('Lines');
lines.add(config, 'lineCount', 1, 150, 1).name('line count');
lines.add(config, 'clusterStart', 0, 1, 0.01).name('cluster start x');
lines.add(config, 'spacingStart', 0, 60, 1).name('spacing at y=0');
lines.add(config, 'spacingEnd', 0, 60, 1).name('spacing at far end');
lines.add(config, 'widthStart', 0.2, 8, 0.1).name('width at y=0');
lines.add(config, 'widthEnd', 0.2, 8, 0.1).name('width at far end');

const motion = gui.addFolder('Motion');
motion.add(config, 'amplitude', 0, 300, 1).name('sway amplitude');
motion.add(config, 'noiseScale', 0.0005, 0.02, 0.0001).name('noise scale (y)');
motion.add(config, 'lineNoiseStep', 0.01, 1, 0.01).name('line noise step');
motion.add(config, 'timeScale', 0, 0.001, 0.00001).name('drift speed');
motion.add(config, 'segmentStep', 4, 80, 1).name('segment step');

const colors = gui.addFolder('Colors');
colors.addColor(config, 'lineColor').name('line color');
colors.add(config, 'opacityMin', 0, 1, 0.01).name('edge opacity');
colors.add(config, 'opacityMax', 0, 1, 0.01).name('center opacity');
colors.addColor(config, 'backgroundColor').name('background color').onChange(applyBackgroundColor);
