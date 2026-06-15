# GLSL Функции в шейдерах

Документация по функциям, используемым в этом проекте.

**Источники:**
- [Khronos GLSL ES 1.00 Specification](https://registry.khronos.org/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf)
- [Khronos GLSL Reference Pages](https://registry.khronos.org/OpenGL-Refpages/gl4/)
- [The Book of Shaders](https://thebookofshaders.com/)
- [Inigo Quilez Articles](https://iquilezles.org/articles/)

---

## Содержание

1. [Встроенные функции GLSL](#встроенные-функции-glsl)
   - [fract](#fract)
   - [mod](#mod)
   - [floor](#floor)
   - [abs](#abs)
   - [sin / cos](#sin--cos)
   - [pow](#pow)
   - [exp](#exp)
   - [length](#length)
   - [distance](#distance)
   - [dot](#dot)
   - [cross](#cross)
   - [normalize](#normalize)
   - [mix](#mix)
   - [clamp](#clamp)
   - [smoothstep](#smoothstep)
   - [max / min](#max--min)
2. [Пользовательские функции](#пользовательские-функции)
   - [palette](#palette)
   - [random](#random)
   - [noise (Value Noise)](#noise-value-noise)
   - [fbm (Fractal Brownian Motion)](#fbm-fractal-brownian-motion)
3. [Концепции шейдеров](#концепции-шейдеров)
   - [Специальные переменные](#специальные-переменные)
   - [Перспективная проекция](#перспективная-проекция)
   - [Бесконечный скролл](#бесконечный-скролл)

---

## Встроенные функции GLSL

### `fract`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/fract.xhtml) · [The Book of Shaders — Shaping Functions](https://thebookofshaders.com/05/)

```glsl
float fract(float x)
vec2  fract(vec2 x)
vec3  fract(vec3 x)
```

Возвращает **дробную часть** числа: `fract(x) = x - floor(x)`.

Результат всегда в диапазоне `[0.0, 1.0)`.

**Применение в проекте:**

```glsl
// 03_main.ts — тайлинг UV-координат (эффект фракталя)
uv = fract(uv * 1.5) - 0.5;
```
Умножает UV на 1.5 (масштабирует), затем `fract` «оборачивает» координаты обратно в `[0, 1)`, создавая бесконечное повторение тайлов. Вычитание 0.5 центрирует каждый тайл вокруг нуля.

```glsl
// 04_main.ts — разбивает пространство на целую и дробную части для noise
vec2 i = floor(_st);   // целая часть — номер ячейки
vec2 f = fract(_st);   // дробная часть — позиция внутри ячейки
```

---

### `mod`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/mod.xhtml)

```glsl
float mod(float x, float y)  // x - y * floor(x/y)
vec2  mod(vec2 x, float y)
vec2  mod(vec2 x, vec2 y)
```

Остаток от деления — аналог `%` в JS, но для `float`. Результат всегда в диапазоне `[0.0, y)`.

Ключевое отличие от JS `%`: `mod(-1.0, 3.0) = 2.0`, а не `-1.0` — результат всегда положительный.

**Применение в проекте — бесконечный скролл (`12_main.ts`):**

```glsl
float scrolledZ = zFar + mod(position.z - zFar + iTime * speed, depth);
```

Без `mod` точка летела бы в бесконечность. С `mod` значение «оборачивается» назад к `zFar` как только достигает `zNear`:

```
iTime * speed:  0    5   10   15   17.5  20   25
mod(..., 17.5): 0    5   10   15   0     2.5  7.5  ← сброс
scrolledZ:     -18  -13  -8   -3  -18  -15.5 -10.5
```

Каждая точка имеет свой начальный `position.z`, поэтому они равномерно распределены вдоль тоннеля в любой момент времени.

---

### `floor`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/floor.xhtml)

```glsl
float floor(float x)
vec2  floor(vec2 x)
```

Округляет вниз до ближайшего целого: `floor(1.7) = 1.0`, `floor(-1.2) = -2.0`.

**Применение:** вместе с `fract` формирует «решётку» для процедурного noise.

```glsl
vec2 i = floor(_st);  // индекс ячейки в решётке
```

---

### `abs`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/abs.xhtml)

```glsl
float abs(float x)
```

Абсолютное значение. Отрицательные числа становятся положительными.

**Применение в проекте:**

```glsl
// 03_main.ts — делает все значения d положительными
// (синус возвращает [-1, 1], abs → [0, 1])
d = abs(d);
```

---

### `sin` / `cos`

> [Khronos sin](https://registry.khronos.org/OpenGL-Refpages/gl4/html/sin.xhtml) · [Khronos cos](https://registry.khronos.org/OpenGL-Refpages/gl4/html/cos.xhtml) · [The Book of Shaders — Shaping Functions](https://thebookofshaders.com/05/)

```glsl
float sin(float angle)  // angle в радианах
float cos(float angle)
vec2  sin(vec2 angle)
vec3  cos(vec3 angle)
```

Возвращают значения в диапазоне `[-1.0, 1.0]`.

**Паттерн «cosine palette»** (из `03_main.ts`, техника IQ):

```glsl
// a + b * cos(2π * (c*t + d))
// Генерирует плавные циклические цвета
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.2, 0.3, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(6.28318 * (c*t + d));
}
```

**Применение для анимации волн** (`01_main.ts`, vertex shader):
```glsl
pos.y += sin(pos.x * 2.0 + iTime) * 0.5;
```

**Применение в матрице вращения** (`04_main.ts`):
```glsl
mat2 rot = mat2(cos(0.5), sin(0.5),
               -sin(0.5), cos(0.5));
```

---

### `pow`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/pow.xhtml)

```glsl
float pow(float base, float exponent)
```

Возводит `base` в степень `exponent`. `base` должен быть `>= 0`.

**Применение в проекте:**

```glsl
// 03_main.ts — создаёт резкий «bloom» эффект вокруг нуля
d = pow(0.01 / d, 2.2);
```

Когда `d` очень мало (близко к 0), `0.01 / d` становится очень большим — это создаёт яркое свечение. Степень `2.2` — gamma correction: делает переход от тёмного к светлому более «экранным».

---

### `exp`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/exp.xhtml)

```glsl
float exp(float x)  // = e^x
```

Экспонента. Полезна для создания быстрого убывания, так как `exp(-x)` стремится к 0 при больших x.

**Применение в проекте:**

```glsl
// 03_main.ts — ослабляет яркость на краях экрана
float d = length(uv) * exp(-length(or_uv));
```

`exp(-length(or_uv))` — чем дальше от центра (`or_uv` большой), тем множитель меньше, эффект «затухает» к краям.

---

### `length`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/length.xhtml)

```glsl
float length(vec2 v)   // sqrt(v.x*v.x + v.y*v.y)
float length(vec3 v)
```

Длина вектора (расстояние от начала координат до точки).

**Применение:**

```glsl
// 03_main.ts — расстояние от центра uv
float d = length(uv) * exp(-length(or_uv));
```

---

### `distance`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/distance.xhtml)

```glsl
float distance(vec2 p0, vec2 p1)  // = length(p1 - p0)
float distance(vec3 p0, vec3 p1)
```

Расстояние между двумя точками. Сокращение для `length(p1 - p0)`.

**Применение в проекте — круглые точки (`12_main.ts`, fragment shader):**

```glsl
float dist = distance(gl_PointCoord, vec2(0.5));
if (dist > 0.5) discard;
```

`gl_PointCoord` — UV-координата внутри точки от `(0,0)` до `(1,1)`. Центр точки = `vec2(0.5)`. Всё что дальше 0.5 от центра — за пределами круга, `discard` убирает эти фрагменты.

---

### `dot`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/dot.xhtml)

```glsl
float dot(vec2 a, vec2 b)  // a.x*b.x + a.y*b.y
float dot(vec3 a, vec3 b)
```

Скалярное произведение. Равно `length(a) * length(b) * cos(угол)`.

**Применение:**

```glsl
// 04_main.ts — хэш для псевдослучайного числа
fract(sin(dot(_st.xy, vec2(12.9898, 78.233))) * 43758.5453123)

// 02_main.ts — диффузное освещение (насколько нормаль смотрит на свет)
float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
```

---

### `cross`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/cross.xhtml)

```glsl
vec3 cross(vec3 a, vec3 b)
```

Векторное произведение. Результат — вектор, перпендикулярный обоим исходным. Используется для вычисления нормалей к поверхности.

**Применение (`02_main.ts`, vertex shader):**

```glsl
// Вычисляем нормаль к волнообразной поверхности через касательные
vec3 T_x = vec3(1.0, 0.0, dz_dx);   // касательная вдоль X
vec3 T_y = vec3(0.0, 1.0, dz_dy);   // касательная вдоль Y
vec3 computedNormal = normalize(cross(T_x, T_y));
```

---

### `normalize`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/normalize.xhtml)

```glsl
vec2 normalize(vec2 v)  // v / length(v)
vec3 normalize(vec3 v)
```

Возвращает вектор той же направленности, но с длиной 1.0 (единичный вектор).

**Применение:**

```glsl
// 02_main.ts
vNormal = normalize(normalMatrix * computedNormal);
vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
```

---

### `mix`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/mix.xhtml) · [The Book of Shaders — Color](https://thebookofshaders.com/06/)

```glsl
float mix(float a, float b, float t)  // a*(1-t) + b*t
vec3  mix(vec3 a, vec3 b, float t)
```

Линейная интерполяция между `a` и `b`. При `t=0` → `a`, при `t=1` → `b`.

**Применение (`04_main.ts`):**

```glsl
// Смешивает базовые цвета в зависимости от значения fbm
color = mix(vec3(0.0745, 0.4863, 0.6471),
            vec3(0.0745, 0.0983, 0.1171),
            clamp(f*f * 4.0, 0.0, 1.0));
```

---

### `clamp`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/clamp.xhtml)

```glsl
float clamp(float x, float minVal, float maxVal)
```

Ограничивает значение диапазоном: `max(minVal, min(maxVal, x))`.

**Применение:**

```glsl
// 04_main.ts — не даёт t выйти за [0.0, 1.0] перед mix
clamp(f*f * 4.0, 0.0, 1.0)
clamp(length(q), 0.0, 1.0)
```

---

### `smoothstep`

> [Khronos Reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/smoothstep.xhtml) · [The Book of Shaders — Shaping Functions](https://thebookofshaders.com/05/)

```glsl
float smoothstep(float edge0, float edge1, float x)
```

Плавная интерполяция между 0 и 1 по S-образной кривой (Hermite). Возвращает `0` если `x <= edge0`, `1` если `x >= edge1`.

Формула внутри: `t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t*t*(3 - 2*t)`

В отличие от `clamp`, переход не линейный — он замедляется у краёв (ease-in/ease-out).

```
clamp:      /
smoothstep: ⌒  (S-кривая)
```

**Применение в проекте — мягкие края точек (`12_main.ts`, fragment shader):**

```glsl
float alpha = smoothstep(0.5, 0.1, dist);
```

Обратите внимание: `edge0 > edge1` — это инверсия. При `dist = 0.5` (край) → `alpha = 0`, при `dist = 0.1` (центр) → `alpha = 1`. Точка плавно светлеет к центру.

---

### `max` / `min`

> [Khronos max](https://registry.khronos.org/OpenGL-Refpages/gl4/html/max.xhtml)

```glsl
float max(float a, float b)
float min(float a, float b)
```

Максимум / минимум из двух значений.

**Применение:**

```glsl
// 02_main.ts — «обрезает» отрицательный diffuse
// (поверхность не может быть «темнее» нуля от одного источника)
float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
```

---

## Пользовательские функции

### `palette`

> Авторство: [Inigo Quilez](https://iquilezles.org/articles/palettes/) · Используется в `03_main.ts`

```glsl
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.2, 0.3, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(6.28318 * (c * t + d));
}
```

**Что делает:** генерирует плавный циклический цвет по формуле `a + b·cos(2π·(c·t + d))`.

| Параметр | Роль |
|---|---|
| `a` | базовый цвет (смещение) |
| `b` | амплитуда (яркость) |
| `c` | частота изменения по каналам RGB |
| `d` | фазовый сдвиг (какой цвет при `t=0`) |

**Использование:**
```glsl
// t меняется со временем и по позиции → цвета «плывут»
vec3 col = palette(length(or_uv) + i * 0.4 + iTime);
```

---

### `random`

> Источник: [The Book of Shaders — Random](https://thebookofshaders.com/10/) · Используется в `04_main.ts`, `main.ts`

```glsl
float random(in vec2 _st) {
    return fract(sin(dot(_st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
```

**Что делает:** псевдослучайное число `[0, 1)` по 2D-координату.

**Как работает:**
1. `dot(_st, vec2(...))` — скалярное произведение с «магическими» константами, разбрасывает входные значения по большому диапазону
2. `sin(...)` — «перемешивает» ещё раз (синус непредсказуем на больших значениях)
3. `* 43758.5...` — умножает на большое число, дробная часть выглядит случайной
4. `fract(...)` — берём только дробную часть → `[0, 1)`

> ⚠️ Это **не** криптографически стойкая функция. Используется только для визуальных эффектов.

---

### `noise` (Value Noise)

> Источник: [Morgan McGuire @morgan3d](https://www.shadertoy.com/view/4dS3Wd) · [The Book of Shaders — Noise](https://thebookofshaders.com/11/) · Используется в `04_main.ts`, `main.ts`

```glsl
float noise(in vec2 _st) {
    vec2 i = floor(_st);   // индекс ячейки
    vec2 f = fract(_st);   // позиция внутри ячейки

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    // Smooth step: f^2 * (3 - 2f) вместо линейного f
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
           (c - a) * u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}
```

**Что делает:** создаёт «плавный» шум. В отличие от `random`, соседние точки имеют близкие значения.

**Алгоритм:**
1. Разбивает пространство на квадратные ячейки (`floor` и `fract`)
2. Генерирует случайное значение в каждом из 4 углов ячейки
3. Интерполирует между ними через `mix` со сглаженным `u` (Smoothstep)

**Smoothstep** `f² · (3 - 2f)` вместо линейного `f` убирает резкие стыки между ячейками.

---

### `fbm` (Fractal Brownian Motion)

> Источник: [The Book of Shaders — Fractal Brownian Motion](https://thebookofshaders.com/13/) · [Inigo Quilez — FBM](https://iquilezles.org/articles/fbm/) · Используется в `04_main.ts`, `main.ts`

```glsl
#define NUM_OCTAVES 5

float fbm(in vec2 _st) {
    float v = 0.0;
    float a = 0.5;          // амплитуда
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5),
                   -sin(0.5), cos(0.5));  // матрица вращения ~28.6°

    for (int i = 0; i < NUM_OCTAVES; ++i) {
        v += a * noise(_st);   // добавляем octave
        _st = rot * _st * 2.0 + shift;  // масштабируем и смещаем
        a *= 0.5;              // уменьшаем амплитуду вдвое
    }
    return v;
}
```

**Что делает:** складывает несколько слоёв (`octaves`) шума с разными масштабами и амплитудами — создаёт природоподобные текстуры (облака, туман, горы).

**Принцип «octaves»:**

| Октава | Масштаб | Амплитуда | Роль |
|---|---|---|---|
| 1 | ×1 | 0.5 | крупная форма |
| 2 | ×2 | 0.25 | средний детализ |
| 3 | ×4 | 0.125 | мелкая деталь |
| 4 | ×8 | 0.0625 | ещё мельче |
| 5 | ×16 | 0.03125 | микро-деталь |

**Вращение `rot`** (угол 0.5 рад ≈ 28.6°) — предотвращает артефакты осевой симметрии, которые были бы видны без поворота.

**Использование в проекте — domain warping:**

```glsl
// 04_main.ts — fbm внутри fbm = «искажение домена»
vec2 q, r;
q.x = fbm(st + 0.02*iTime);
q.y = fbm(st + vec2(1.0));

r.x = fbm(st + 1.0*q + vec2(1.7, 9.2) + 0.15*iTime);
r.y = fbm(st + 1.0*q + vec2(8.3, 2.8) + 0.126*iTime);

float f = fbm(st + r);
```

Это техника **[domain warping](https://iquilezles.org/articles/warp/)** (IQ): координаты для финального `fbm` сами являются результатом предыдущих `fbm`. Создаёт органичные, «закрученные» узоры — как облака или мрамор.

---

---

## Концепции шейдеров

### Специальные переменные

Встроенные переменные WebGL — не нужно объявлять, они уже существуют.

| Переменная | Шейдер | Описание |
|---|---|---|
| `gl_Position` | vertex | Финальная позиция вершины в clip space `(-1..1)`. Обязательно устанавливать. |
| `gl_PointSize` | vertex | Размер точки в пикселях при `gl.POINTS`. |
| `gl_PointCoord` | fragment | UV внутри точки `(0,0)...(1,1)`, доступна только при `gl.POINTS`. |
| `gl_FragColor` | fragment | Финальный цвет пикселя `vec4(r, g, b, a)`. Обязательно устанавливать. |

**Varyings** — переменные объявленные с `varying`, передаются из vertex шейдера в fragment. GPU автоматически интерполирует значение между вершинами.

```glsl
// vertex shader
varying float vAlpha;
vAlpha = 0.8;

// fragment shader — получает уже интерполированное значение
varying float vAlpha;
gl_FragColor = vec4(col, vAlpha);
```

---

### Перспективная проекция

Без перспективы все точки выглядят одинакового размера независимо от расстояния. Перспектива делает дальние объекты меньше, схлопывая их к центру экрана.

**Формула деления на расстояние:**

```glsl
float cameraZ = 1.0;           // позиция камеры по Z
float dist = cameraZ - scrolledZ;  // расстояние до точки (всегда > 0)
float perspW = dist / cameraZ;     // нормализованное расстояние

float aspect = iResolution.x / iResolution.y;

gl_Position = vec4(
    pos.x / perspW / aspect,  // дальние точки X → к 0 (центру)
    pos.y / perspW,           // дальние точки Y → к 0 (горизонт)
    ndcZ,
    1.0
);
```

При `scrolledZ = -18` (далеко): `dist = 19`, `perspW = 19` → координаты делятся на 19 → точка у центра.
При `scrolledZ = -0.5` (близко): `dist = 1.5`, `perspW = 1.5` → координаты делятся на 1.5 → точка у края.

**Размер точек с перспективой:**

```glsl
gl_PointSize = clamp(7.0 / perspW, 1.0, 10.0);
```

Ближние точки большие, дальние — маленькие.

---

### Бесконечный скролл

Паттерн для создания эффекта бесконечного движения без изменения буфера геометрии.

**Идея:** каждая точка имеет начальный `position.z` (стартовая фаза). `mod` заставляет значение циклически возвращаться к старту:

```glsl
float zFar  = -18.0;
float zNear = -0.5;
float depth = zNear - zFar;  // = 17.5
float speed = 3.0;

float scrolledZ = zFar + mod(position.z - zFar + iTime * speed, depth);
```

Визуализация для одной точки с `position.z = -9.0` (середина диапазона):

```
t=0:  mod(-9+18 + 0,   17.5) = mod(9,  17.5) = 9   → scrolledZ = -18+9  = -9
t=3:  mod(-9+18 + 9,   17.5) = mod(18, 17.5) = 0.5 → scrolledZ = -18+0.5 = -17.5 (прыжок!)
t=6:  mod(-9+18 + 18,  17.5) = mod(27, 17.5) = 9.5 → scrolledZ = -18+9.5 = -8.5
```

Прыжок (`scrolledZ` меняется с `-0.5` на `-18`) происходит у всех точек в разное время и они в этот момент прозрачные (fade near + fade far), поэтому он незаметен.

---

## Быстрая шпаргалка

| Функция | Результат | Применение |
|---|---|---|
| `fract(x)` | `[0, 1)` дробная часть | тайлинг, шум |
| `mod(x, y)` | `[0, y)` остаток деления | бесконечный скролл, цикл |
| `floor(x)` | целое вниз | индекс ячейки |
| `abs(x)` | `\|x\|` | симметрия |
| `sin/cos(x)` | `[-1, 1]` | волны, цвет, вращение |
| `pow(x, e)` | `x^e` | гамма, bloom |
| `exp(x)` | `e^x` | затухание |
| `length(v)` | длина вектора | расстояние от начала |
| `distance(a,b)` | расстояние между точками | круглые точки (`gl_PointCoord`) |
| `dot(a,b)` | скалярное произв. | освещение, хэш |
| `cross(a,b)` | векторное произв. | нормали |
| `normalize(v)` | единичный вектор | направления |
| `mix(a,b,t)` | линейная интерполяция | цвет, переходы |
| `clamp(x,a,b)` | ограничение диапазона | безопасный `t` для `mix` |
| `smoothstep(e0,e1,x)` | S-кривая `[0,1]` | мягкие края, fade |
| `max/min(a,b)` | максимум/минимум | освещение |
| `random(uv)` | псевдослучайный `[0,1)` | шум |
| `noise(uv)` | плавный шум | органика |
| `fbm(uv)` | фрактальный шум | облака, туман, марбл |