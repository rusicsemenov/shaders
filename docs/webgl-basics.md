# WebGL: основы для тех, кто знает Canvas 2D

Разбор по коду `20_main.ts`.

---

## Содержание

1. [Чем WebGL отличается от Canvas 2D](#чем-webgl-отличается-от-canvas-2d)
2. [Пайплайн: как пиксель попадает на экран](#пайплайн-как-пиксель-попадает-на-экран)
3. [Шейдеры](#шейдеры)
4. [Компиляция программы](#компиляция-программы)
5. [Буферы и атрибуты](#буферы-и-атрибуты)
6. [Uniforms — данные из JS в шейдер](#uniforms--данные-из-js-в-шейдер)
7. [Full-screen quad — рисуем весь экран](#full-screen-quad--рисуем-весь-экран)
8. [Система координат](#система-координат)
9. [Render loop](#render-loop)
10. [Scissor test](#scissor-test)
11. [Что доступно в объекте gl](#что-доступно-в-объекте-gl)

---

## Чем WebGL отличается от Canvas 2D

| Canvas 2D | WebGL |
|---|---|
| CPU рисует по одному объекту | GPU рисует все пиксели **параллельно** |
| Команды: `fillRect`, `arc`, `drawImage` | Команды: запустить программу на GPU |
| Координаты в пикселях, y↓ | Координаты −1..1, y↑ (clip space) |
| Всё в JS | Логика рисования — в шейдерах (GLSL) |

В Canvas 2D ты описываешь **что** рисовать.  
В WebGL ты пишешь **программу**, которая запускается на GPU для каждого пикселя.

---

## Пайплайн: как пиксель попадает на экран

```
JS (CPU)
  │
  ├─ буфер с вершинами (координаты геометрии)
  ├─ uniforms (uTime, uBlockSize, …)
  │
  ▼
Vertex Shader          ← выполняется для каждой вершины
  │  gl_Position = …   ← куда поставить вершину в clip space
  │
  ▼
Растеризация           ← GPU определяет, какие пиксели покрывает треугольник
  │
  ▼
Fragment Shader        ← выполняется для каждого пикселя параллельно
  │  gl_FragColor = … ← какой цвет у этого пикселя
  │
  ▼
Экран
```

---

## Шейдеры

Шейдер — программа на языке **GLSL**, которую компилирует GPU.  
Два типа:

### Vertex shader
Получает координаты одной вершины, выдаёт позицию в clip space.

```glsl
attribute vec2 position;   // входные данные из буфера (JS)

void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    //                 x    y    z    w
}
```

`attribute` — данные, которые меняются для каждой вершины (из буфера).

### Fragment shader
Выполняется для каждого пикселя. Должен записать цвет в `gl_FragColor`.

```glsl
precision mediump float;   // точность вычислений

uniform float uTime;       // данные из JS, одинаковые для всех пикселей

void main() {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // RGBA, каждый компонент 0..1
}
```

`uniform` — данные из JS, не меняются в рамках одного draw call.

---

## Компиляция программы

В Canvas 2D контекст готов сразу. В WebGL нужно вручную скомпилировать шейдеры и слинковать программу.

```typescript
// 1. Создать шейдер
const s = gl.createShader(gl.FRAGMENT_SHADER)!;
gl.shaderSource(s, sourceCode);   // передать GLSL код
gl.compileShader(s);

// Проверить ошибки
if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error(gl.getShaderInfoLog(s));

// 2. Создать программу и слинковать два шейдера
const prog = gl.createProgram()!;
gl.attachShader(prog, vertexShader);
gl.attachShader(prog, fragmentShader);
gl.linkProgram(prog);

// 3. Активировать программу
gl.useProgram(prog);
```

В `20_main.ts` это обёрнуто в функцию `compile()` (строки ~209–216).

---

## Буферы и атрибуты

Буфер — массив данных на GPU (обычно координаты вершин).  
Атрибут — переменная в vertex shader, которая читает данные из буфера.

```typescript
// Создать буфер и загрузить данные
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...]), gl.STATIC_DRAW);

// Связать буфер с атрибутом в шейдере
const loc = gl.getAttribLocation(prog, 'position');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(
    loc,       // куда (атрибут)
    2,         // size: сколько чисел на одну вершину (vec2 = 2)
    gl.FLOAT,  // тип данных
    false,     // нормализация
    0,         // stride (0 = плотно упакованы)
    0          // offset
);
```

`gl.STATIC_DRAW` — подсказка GPU: данные загружаются один раз и не меняются.

---

## Uniforms — данные из JS в шейдер

Uniform — способ передать данные (время, размер блока, …) из JS в шейдер.  
В отличие от атрибутов, одинаковы для всех вершин/пикселей в одном draw call.

```typescript
// Получить location (делается один раз)
const uTimeLoc = gl.getUniformLocation(prog, 'uTime');

// Установить значение (каждый кадр или при изменении)
gl.uniform1f(uTimeLoc, 3.14);         // float
gl.uniform2f(uTimeLoc, 800, 600);     // vec2
gl.uniform3f(uTimeLoc, 1, 0, 0);      // vec3
gl.uniform4f(uTimeLoc, 1, 0, 0, 1);   // vec4
```

В `20_main.ts` три uniform'а (строки ~232–234):
- `uTime` — время в секундах
- `uBlockSize` — размер карточки в пикселях
- `uBlockOffset` — положение карточки на экране (для scissor-анимации)

---

## Full-screen quad — рисуем весь экран

В Canvas 2D можно вызвать `fillRect(0, 0, w, h)` и заполнить весь холст.  
В WebGL для этого рисуется прямоугольник из двух треугольников, покрывающий clip space (−1..1):

```typescript
// Четыре угла в clip space
const quad = new Float32Array([
//   x     y
    -1,   -1,   // левый нижний
     1,   -1,   // правый нижний
    -1,    1,   // левый верхний
     1,    1,   // правый верхний
]);

// TRIANGLE_STRIP рисует два треугольника из 4 точек:
// (0,1,2) и (1,2,3)
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
```

Fragment shader получает управление для каждого пикселя этого прямоугольника — то есть для всего экрана.

---

## Система координат

### Clip space (vertex shader → `gl_Position`)
```
(-1, 1) ────── (1, 1)
   │                │
   │   (0, 0)       │   ← центр экрана
   │                │
(-1,-1) ────── (1,-1)
```
Y растёт вверх. Всё за пределами −1..1 обрезается.

### Screen space (fragment shader → `gl_FragCoord`)
```
(0, h) ────── (w, h)
   │                │
   │                │
(0, 0) ────── (w, 0)   ← Y=0 внизу!
```
`gl_FragCoord.xy` — координаты текущего пикселя в пикселях.  
Y растёт вверх — противоположно CSS.

Поэтому в `20_main.ts` при вычислении UV координат делается flip:
```glsl
// y=0 должен быть вверху карточки (как в CSS)
vec2 uv = vec2(px.x, uBlockSize.y - px.y) / uBlockSize;
```

---

## Render loop

```typescript
const t0 = performance.now();

function tick() {
    const t = (performance.now() - t0) / 1000; // секунды

    // Синхронизировать размер canvas с viewport
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Очистить буфер
    gl.clearColor(0, 0, 0, 0); // RGBA 0..1
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Обновить uniforms
    gl.uniform1f(uTimeLoc, t);

    // Нарисовать
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

`gl.viewport` говорит WebGL в какую область canvas рендерить.  
Нужно вызывать при изменении размера canvas.

---

## Scissor test

Scissor ограничивает рендеринг прямоугольной областью.  
Всё за пределами прямоугольника не трогается (ни `clear`, ни `draw`).

```typescript
gl.enable(gl.SCISSOR_TEST);

// Координаты в пикселях, Y=0 снизу (как WebGL, не CSS)
gl.scissor(x, y, width, height);

gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // рисует только внутри scissor

gl.disable(gl.SCISSOR_TEST);
```

В `20_main.ts` scissor используется чтобы один шейдер рисовал в нескольких карточках:

```typescript
for (const card of cards) {
    const r = card.getBoundingClientRect();
    const x = Math.round(r.left);
    const y = Math.round(vh - r.bottom);  // flip: CSS y↓ → WebGL y↑

    gl.scissor(x, y, r.width, r.height);
    gl.uniform2f(uOffset, x, y);          // шейдер знает где карточка
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
```

`uBlockOffset` передаётся в шейдер чтобы вычислить координаты **внутри** карточки:
```glsl
vec2 px = gl_FragCoord.xy - uBlockOffset; // 0..cardSize, не экранные
```

Это делает частицы привязанными к карточке: при скролле `getBoundingClientRect()`
возвращает новые координаты → `uBlockOffset` обновляется → `px` остаётся неизменным.

---

## Что доступно в объекте gl

После `canvas.getContext('webgl')` ты получаешь объект `WebGLRenderingContext`.  
В нём ~150 методов и ~200 констант. Всё делится на несколько групп:

| Группа | Примеры методов |
|---|---|
| Компиляция шейдеров | `createShader`, `shaderSource`, `compileShader`, `getShaderInfoLog` |
| Сборка программы | `createProgram`, `attachShader`, `linkProgram`, `useProgram` |
| Буферы | `createBuffer`, `bindBuffer`, `bufferData` |
| Атрибуты | `getAttribLocation`, `enableVertexAttribArray`, `vertexAttribPointer` |
| Uniforms | `getUniformLocation`, `uniform1f`, `uniform2f`, `uniform3f`, `uniform4f`, `uniformMatrix4fv` |
| Текстуры | `createTexture`, `bindTexture`, `texImage2D`, `texParameteri` |
| Рендеринг | `viewport`, `clear`, `clearColor`, `drawArrays`, `drawElements` |
| Состояния | `enable`, `disable`, `blendFunc`, `scissor`, `depthFunc` |
| Считывание | `getParameter`, `getError`, `readPixels` |

**Где смотреть все методы:**

- **MDN** — самая подробная документация с примерами:  
  https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext
- **Khronos Quick Reference Card** — одностраничная шпаргалка по всему API (PDF):  
  https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf
- **WebGL Fundamentals** — учебник с объяснением каждого шага:  
  https://webglfundamentals.org

**Посмотреть прямо в браузере** — открыть DevTools и набрать `gl.` для автодополнения, или:

```typescript
// Все методы объекта gl
console.log(Object.getOwnPropertyNames(WebGLRenderingContext.prototype));

// Все константы (gl.FLOAT, gl.ARRAY_BUFFER, …)
Object.entries(WebGLRenderingContext).filter(([, v]) => typeof v === 'number');
```
