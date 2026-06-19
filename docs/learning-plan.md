# План изучения

Закладки и порядок прохождения тем по мере работы над проектом.

---

## Нормали и освещение

### 1. Базовое освещение — с чего начать

> Обязательно до Normal Mapping

- [LearnOpenGL — Colors](https://learnopengl.com/Lighting/Colors)
- [LearnOpenGL — Basic Lighting](https://learnopengl.com/Lighting/Basic-Lighting) ← dot product, diffuse, specular, ambient

**Что понять:** нормаль + направление света + `dot()` = яркость точки. Это основа всего.

---

### 2. Normal Mapping

- [LearnOpenGL — Normal Mapping](https://learnopengl.com/Advanced-Lighting/Normal-Mapping)

**Что понять:**
- почему normal map синий (tangent space)
- TBN матрица — перевод нормали из текстуры в мировые координаты
- разница object space vs tangent space vs world space

---

### 3. Displacement vs Normal — в чём разница

| | Normal map | Displacement map |
|---|---|---|
| Геометрия меняется | нет | да |
| Виден силуэт | нет | да |
| Самотени | нет | да |
| Стоимость | дёшево | дорого |

**В нашем проекте:**
- `16_main.ts`, `17_main.ts`, `18_main.ts` — displacement в вершинном шейдере
- нормали из градиента волновой функции = аналог normal map но вычисленный аналитически

---

### 4. Аналитические нормали (то что мы делаем)

Нормаль к поверхности `f(x, y)`:

```
∂f/∂x = производная по X
∂f/∂y = производная по Y
normal = normalize(vec3(-∂f/∂x, -∂f/∂y, 1.0))
```

- [Inigo Quilez — Normals for Implicit Surfaces](https://iquilezles.org/articles/normalsSDF/)

**Числовой вариант (finite differences)** — используем в `17_main.ts`, `18_main.ts`:
```glsl
float dfdx = (f(x + eps, y) - f(x, y)) / eps;
float dfdy = (f(x, y + eps) - f(x, y)) / eps;
```

---

## Видео

| Канал | Что смотреть | Почему |
|---|---|---|
| **Acerola** (YouTube) | normal mapping, lighting | лучший по шейдерам, с визуальными примерами |
| **SimonDev** (YouTube) | Three.js shaders, PBR | практика, WebGL |
| **Inigo Quilez** (YouTube) | аналитические нормали, SDF | математика поверхностей |

---

## Интерактивно

- [ShaderToy](https://www.shadertoy.com) — искать `normal mapping`, `wave normals`, `bump map`
- [The Book of Shaders](https://thebookofshaders.com) — глава 11 (noise), 13 (fbm)

---

## Тени в Three.js

- [Three.js — Shadow Maps](https://threejs.org/manual/#en/shadows)

**Важно:** при `onBeforeCompile` + displacement нужен `customDepthMaterial` —
иначе shadow pass считает тени от плоской геометрии (см. `17_main.ts`).

```typescript
mesh.customDepthMaterial = depthMaterial; // с той же трансформацией вершин
```

---

## PBR материалы

- [LearnOpenGL — PBR Theory](https://learnopengl.com/PBR/Theory)

**Параметры `MeshStandardMaterial`:**
- `roughness` — матовость (0 = зеркало, 1 = полностью матовый)
- `metalness` — металл/диэлектрик (влияет на цвет бликов)
- `normalMap` — текстура нормалей (tangent space)
- `displacementMap` — текстура смещения вершин
