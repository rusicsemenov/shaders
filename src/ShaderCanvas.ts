interface UniformValue {
    value: number | number[];
}

interface ShaderCanvasOptions {
    fragmentShader: string;
    vertexShader?: string;
    uniforms?: Record<string, UniformValue>;
    textures?: Record<string, string>;
    particles?: Float32Array;
}

const DEFAULT_VERTEX_SHADER = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

class ShaderCanvas {
    private readonly canvas: HTMLCanvasElement;
    private readonly gl: WebGLRenderingContext;
    private readonly program: WebGLProgram;
    private readonly uniformLocations = new Map<string, WebGLUniformLocation | null>();
    private readonly userUniforms: ShaderCanvasOptions['uniforms'];
    private readonly loadedTextures = new Map<
        string,
        { texture: WebGLTexture; unit: number; width: number; height: number }
    >();
    private rafId = 0;
    private readonly startTime = performance.now();
    private readonly observer: ResizeObserver;

    constructor(container: string | HTMLElement, options: ShaderCanvasOptions) {
        // --- Resolve container ---
        const el =
            typeof container === 'string'
                ? document.querySelector<HTMLElement>(container)
                : container;

        if (!el) throw new Error(`ShaderCanvas: container not found — "${container.toString()}"`);

        // --- Create canvas ---
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        el.appendChild(this.canvas);

        // --- WebGL context ---
        const gl = this.canvas.getContext('webgl');
        if (!gl) throw new Error('ShaderCanvas: WebGL not supported in this browser');
        this.gl = gl;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.userUniforms = options.uniforms;

        // --- Compile & link ---
        this.program = this.buildProgram(
            options.vertexShader ?? DEFAULT_VERTEX_SHADER,
            options.fragmentShader,
        );
        gl.useProgram(this.program);

        // --- Full-screen quad (TRIANGLE_STRIP: 2 triangles, 4 vertices) ---
        //   (-1,1) ─── (1,1)
        //      │  ╲       │
        //   (-1,-1) ── (1,-1)
        const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const data = options.particles ?? quad;

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(this.program, 'position');
        gl.enableVertexAttribArray(posLoc);

        const size = options.particles ? 3 : 2;
        gl.vertexAttribPointer(posLoc, size, gl.FLOAT, false, 0, 0);

        // --- Cache uniform locations ---
        this.cacheUniform('iTime');
        this.cacheUniform('iResolution');
        if (this.userUniforms) {
            for (const name of Object.keys(this.userUniforms)) {
                this.cacheUniform(name);
            }
        }
        if (options.textures) {
            let unit = 0;
            for (const [name, url] of Object.entries(options.textures)) {
                this.cacheUniform(name);
                this.cacheUniform(name + 'Size');
                this.loadTexture(name, url, unit++);
            }
        }

        // --- Resize observer (reacts to container resizes) ---
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(el);
        this.resize();

        // --- Start animation loop ---
        this.tick(options.particles);
    }

    // ─── Private helpers ───────────────────────────────────────────────────

    private loadTexture(name: string, url: string, unit: number): void {
        const gl = this.gl;
        const img = new Image();
        img.src = url;
        img.onload = () => {
            const texture = gl.createTexture()!;
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            this.loadedTextures.set(name, {
                texture,
                unit,
                width: img.naturalWidth,
                height: img.naturalHeight,
            });
        };
    }

    private cacheUniform(name: string): void {
        this.uniformLocations.set(name, this.gl.getUniformLocation(this.program, name));
    }

    private compileShader(type: number, source: string): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader) ?? '';
            gl.deleteShader(shader);
            const label = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
            throw new Error(`ShaderCanvas: ${label} shader compile error:\n${log}`);
        }

        return shader;
    }

    private buildProgram(vertSrc: string, fragSrc: string): WebGLProgram {
        const gl = this.gl;
        const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
        const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);

        const program = gl.createProgram()!;
        gl.attachShader(program, vert);
        gl.attachShader(program, frag);
        gl.linkProgram(program);

        // Shaders are copied into the program — safe to delete
        gl.deleteShader(vert);
        gl.deleteShader(frag);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program) ?? '';
            throw new Error(`ShaderCanvas: program link error:\n${log}`);
        }

        return program;
    }

    private resize(): void {
        const { canvas, gl } = this;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }

    private setUniform(name: string, value: number | number[]): void {
        const gl = this.gl;
        const loc = this.uniformLocations.get(name) ?? null;
        // WebGL silently ignores null locations — no guard needed,
        // but explicit check makes intent clear.
        if (loc === null) return;

        if (typeof value === 'number') {
            gl.uniform1f(loc, value);
        } else {
            switch (value.length) {
                case 2:
                    gl.uniform2f(loc, value[0], value[1]);
                    break;
                case 3:
                    gl.uniform3f(loc, value[0], value[1], value[2]);
                    break;
                case 4:
                    gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
                    break;
            }
        }
    }

    private tick = (particles: Float32Array | undefined): void => {
        const { canvas } = this;
        const t = (performance.now() - this.startTime) / 1000;

        this.setUniform('iTime', t);
        this.setUniform('iResolution', [canvas.width, canvas.height, 1.0]);

        if (this.userUniforms) {
            for (const [name, { value }] of Object.entries(this.userUniforms)) {
                this.setUniform(name, value);
            }
        }

        for (const [name, { texture, unit, width, height }] of this.loadedTextures) {
            const gl = this.gl;
            const loc = this.uniformLocations.get(name) ?? null;
            if (loc === null) continue;
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(loc, unit);
            this.setUniform(name + 'Size', [width, height]);
        }

        if (particles) {
            this.gl.drawArrays(this.gl.POINTS, 0, particles.length / 3);
        } else {
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        }
        this.rafId = requestAnimationFrame(() => this.tick(particles));
    };

    // ─── Public API ────────────────────────────────────────────────────────

    /** Stop the animation loop and free WebGL resources. */
    destroy(): void {
        cancelAnimationFrame(this.rafId);
        this.observer.disconnect();
        this.gl.deleteProgram(this.program);
        this.canvas.remove();
    }
}

export { ShaderCanvas };
export type { ShaderCanvasOptions };
