import './style.css';

// ─── Page ─────────────────────────────────────────────────────────────────────

document.getElementById('app')!.innerHTML = `
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  #app {
    z-index: 2;
  }
  body {
    background: #07071a;
    color: #cdd0e8;
    font-family: system-ui, -apple-system, sans-serif;
    height: auto;
  }
  nav {
    padding: 24px 48px;
    font-weight: 600;
    font-size: 1.1rem;
    color: #fff;
    letter-spacing: 0.05em;
  }
  .section {
    padding: 48px;
    min-height: 50vh;
  }
  .section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 8px;
  }
  .section p {
    font-size: 0.875rem;
    color: #888aaa;
    margin-bottom: 28px;
    max-width: 560px;
    line-height: 1.6;
  }
  .grid {
    display: grid;
    /*grid-template-columns: repeat(3, 1fr);*/
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  .card {
    height: 200px;
    border-radius: 14px;
    border: 1px solid rgba(80, 100, 200, 0.18);
    display: flex;
    align-items: flex-end;
    padding: 20px;
    position: relative;
    overflow: hidden;
    background: transparent; /* WebGL canvas behind */
  }
  .grid2 {
    grid-template-columns: repeat(auto-fit, minmax(440px, 1fr));
  }
  .grid2 .card {
    height: 400px;
  }
  .grid3 {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }
  .grid3 .card {
    height: 600px;
  }
  .card span {
    color: #fff;
    font-weight: 500;
    font-size: 0.95rem;
    position: relative;
    z-index: 1;
    text-shadow: 0 1px 8px rgba(0, 0, 20, 0.9);
  }
  .card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 13px;
    background: linear-gradient(to top, rgba(4, 4, 18, 0.55) 0%, transparent 55%);
    pointer-events: none;
  }
  footer {
    padding: 60px 48px;
    color: #444466;
    font-size: 0.8rem;
  }
</style>

<nav>the vialan</nav>

<div class="section">
  <h2>Our Products</h2>
  <p>A focused set of tools built to simplify complex workflows and help teams move faster.</p>
  <div class="grid">
    <div class="card"><span>Analytics Dashboard</span></div>
    <div class="card"><span>Design System</span></div>
    <div class="card"><span>API Platform</span></div>
  </div>
</div>

<div class="section">
  <h2>Our Services</h2>
  <p>We work closely with teams to deliver thoughtful solutions from strategy through to launch.</p>
  <div class="grid grid2">
    <div class="card"><span>Brand Strategy</span></div>
    <div class="card"><span>Web Development</span></div>
    <div class="card"><span>Growth Consulting</span></div>
  </div>
</div>

<div class="section">
  <h2>Our Ideas</h2>
  <p>Experiments, research, and open thinking on the things we find most interesting.</p>
  <div class="grid grid3">
    <div class="card"><span>Open Source</span></div>
    <div class="card"><span>Research Lab</span></div>
    <div class="card"><span>Community</span></div>
    <div class="card"><span>Community</span></div>
    <div class="card"><span>Community</span></div>
  </div>
</div>

<footer>© 2026 The Vialan · All rights reserved</footer>
`;

// ─── Single fixed WebGL canvas ────────────────────────────────────────────────
//
// position: fixed + z-index: -1 puts it behind all page content.
// Cards have background: transparent so the canvas shows through.
// Each frame we scissor-render the same shader once per card,
// passing uBlockOffset so particles are in card-local coordinates →
// they stay anchored to the card while scrolling.

const canvas = document.createElement('canvas');
Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '1',
});
document.body.prepend(canvas);

const gl = canvas?.getContext('webgl', { alpha: true })!;
if (!gl) throw new Error('WebGL not supported');

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// ─── Shaders ──────────────────────────────────────────────────────────────────

const vert = /*language=GLSL*/ `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const frag = /*language=GLSL*/ `
    precision mediump float;

    uniform float uTime;
    uniform vec2  uBlockSize;    // card size in pixels
    uniform vec2  uBlockOffset;  // card bottom-left in WebGL (y-up) screen coords

    float h11(float n) { return fract(sin(n) * 43758.5453); }
    float h21(vec2  p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
        // Local pixel coords within this card (y = 0 at card bottom in WebGL space)
        vec2 px = gl_FragCoord.xy - uBlockOffset;

        // Normalized UV: (0,0) = top-left, (1,1) = bottom-right
        vec2 uv = vec2(px.x, uBlockSize.y - px.y) / uBlockSize;

        // Aspect-corrected, centered at (0,0)
        float aspect = uBlockSize.x / uBlockSize.y;
        vec2  uvA    = (uv - 0.5) * vec2(aspect, 1.0);

        // Dark navy base — same tone as body background
        vec3 col = vec3(0.02, 0.025, 0.09);

        // ── Bokeh blobs ───────────────────────────────────────────────────────
        for (int i = 0; i < 5; i++) {
            float fi = float(i);
            vec2  pos = (vec2(h11(fi*7.13+1.3), h11(fi*13.7+2.7)) - 0.5) * vec2(aspect, 1.0);
            float r   = 0.02  + 0.14 * h11(fi*3.1+0.5) * sin(uTime*0.1+fi*3.7);
            float ph  = 6.28318 * h11(fi*17.3+4.1);
            float spd = 1.025  + 0.04 * h11(fi*11.1+6.3);

            // Slow drift
            pos += 0.025 * vec2(sin(uTime*spd+ph), cos(uTime*spd*0.8+ph));

            float d       = length(uvA - pos);
            float blob    = exp(-d*d / (r*r * 0.5));
            float flicker = 0.6 + 0.4 * sin(uTime*0.3+ph);

            vec3 bc = h11(fi*5.3) < 0.7
                ? mix(vec3(0.05, 0.72, 1.0), vec3(0.0, 0.55, 0.95), h11(fi*2.3))
                : vec3(0.25, 0.08, 0.85);

            col += bc * blob * flicker * 0.8;
        }

        // ── Sparkles: статичные мерцающие ────────────────────────────────────
        float G    = 148.0;
        vec2  cell = floor(px / G);

        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                vec2  c    = cell + vec2(float(dx), float(dy));
                vec2  sp   = (c + vec2(h21(c), h21(c + vec2(17.3, 23.7)))) * G;
                float sph  = 6.28318 * h21(c + vec2(7.3,  5.1));
                float sspd = 0.4     + 5.0  * h21(c + vec2(3.7,  9.1));
                float b    = pow(0.5 + 0.5  * sin(uTime * sspd + sph), 5.0);

                float dist  = length(px - sp);
                float spark = exp(-dist*dist / 1.2) * b;

                bool  warm = h21(c + vec2(1.1, 2.2)) < 0.15;
                vec3  sc   = warm ? vec3(1.0, 0.6, 0.15) : vec3(0.85, 0.92, 1.0);
                col += sc * spark * 5.0;
            }
        }

        // ── Sparkles: летящие с глубиной (z) ─────────────────────────────────
        // uv здесь с центром в (0.5, 0.5)
        vec2 center = uv - 0.5;

        for (int i = 0; i < 240; i++) {
            float fi = float(i);

            // z: fract делает бесконечный цикл без if — когда долетело (z→0), прыгает к 1
            float speed = 0.08 + 0.12 * h11(fi * 3.7 + 1.1);
            float z     = fract(h11(fi * 13.1 + 5.3) - uTime * speed);

            // Базовая позиция частицы (случайная, от центра)
            vec2 base = vec2(h11(fi * 7.3 + 2.1), h11(fi * 11.7 + 4.3)) - 0.5;
            base     *= vec2(aspect, 1.0); // учитываем пропорции карточки

            // Перспективная проекция: ближе → дальше от центра
            vec2 proj = base / max(z, 0.001);

            // Размер и яркость: ближе → крупнее и ярче
            float proximity = 1.0 - z;
            float radius    = mix(0.3, 2.5, proximity * proximity);
            float bright    = mix(0.0, 1.0, proximity * proximity);

            // Расстояние в пикселях от текущего фрагмента до частицы
            vec2  projPx = (proj / vec2(aspect, 1.0) + 0.5) * uBlockSize;
            float d      = length(px - projPx);
            float fly    = exp(-d * d / (radius * radius + 0.001)) * bright;

            // Цвет: смесь белого и голубого, изредка оранжевый
            bool  warm2 = h11(fi * 5.1 + 0.7) < 0.1;
            vec3  fc    = warm2 ? vec3(1.0, 0.55, 0.1) : mix(vec3(0.6, 0.8, 1.0), vec3(1.0), proximity);
            col += fc * fly * 3.0;
        }
    
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
`;

// ─── Compile & link ───────────────────────────────────────────────────────────

function compile(type: number, src: string): WebGLShader {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile error');
    return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? 'link error');
gl.useProgram(prog);

// Full-screen quad (TRIANGLE_STRIP)
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const posLoc = gl.getAttribLocation(prog, 'position');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

const uTime = gl.getUniformLocation(prog, 'uTime');
const uSize = gl.getUniformLocation(prog, 'uBlockSize');
const uOffset = gl.getUniformLocation(prog, 'uBlockOffset');

// ─── Render loop ──────────────────────────────────────────────────────────────

const visibleCards = new Set<Element>();
const observer = new IntersectionObserver((entries) => {
    for (const e of entries)
        e.isIntersecting ? visibleCards.add(e.target) : visibleCards.delete(e.target);
});
document.querySelectorAll('.card').forEach((c) => observer.observe(c));

const t0 = performance.now();

function tick() {
    const t = (performance.now() - t0) / 1000;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
        gl.viewport(0, 0, vw, vh);
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uTime, t);
    gl.enable(gl.SCISSOR_TEST);

    for (const card of visibleCards) {
        const r = card.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;

        const x = Math.round(r.left);
        const y = Math.round(vh - r.bottom); // flip y: WebGL origin is at bottom
        const w = Math.round(r.width);
        const h = Math.round(r.height);

        gl.scissor(x, y, w, h);
        gl.uniform2f(uSize, w, h);
        gl.uniform2f(uOffset, x, y); // card's bottom-left in WebGL coords
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.disable(gl.SCISSOR_TEST);
    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
