# Simulador de Robot — Editor Blockly

Editor de bloques (Blockly) + simulador 2D de robot en Canvas, para enseñar programación
robótica sin backend, sin bundler y sin instalación. Se abre haciendo doble click en
`index.html`.

## Cómo abrir

1. Doble click en `index.html` (o abrilo con `file://...` desde el navegador).
2. No hace falta `npm install`, servidor de desarrollo, ni conexión a internet
   permanente (ver "Blockly sin internet" abajo).

## Cómo probar

1. Arrastrá bloques desde las categorías **Movimiento**, **Actuadores**,
   **Sensores/Decisión** y **Repetición** hacia el workspace, conectándolos en secuencia.
2. El panel inferior derecho muestra el código generado en un pseudocódigo estilo
   C++/Arduino (no JavaScript), actualizado en vivo.
3. Click en **Ejecutar**: el robot se mueve en el canvas superior derecho, y cada
   paso resalta simultáneamente el bloque en el editor y su línea correspondiente
   en el panel de código.
4. **Detener** interrumpe la ejecución en cualquier momento. **Reiniciar** vuelve el
   robot a su pose inicial y limpia mensajes de error.
5. Si el robot choca contra un obstáculo o el borde del mapa, la ejecución se
   detiene automáticamente y aparece un mensaje explicando qué acción causó el choque.

## Tests

Abrí `tests/test.html` con doble click. Es un harness de aserciones propio (sin
runner externo, sin npm): corre en el navegador y muestra PASS/FAIL por caso,
más un resumen al final. Cubre:

- Ray-AABB y determinismo de `medirDistancia()`/`hayObstaculo()`.
- Cinemática del robot (`avanzar`, `girar`).
- Generación del árbol de programa (secuencia simple, `repetir` sin pre-expandir,
  `si hayObstaculo()` con condición no evaluada en tiempo de generación).
- `toMqttPayload()` (despoja a `{accion, valor}`, sin `bailar`).
- `cppView.render()` (texto de línea, indentación, mapeo bloque↔línea, solo la
  línea de cabecera de `repetir`/`si`).
- Integración árbol → intérprete → estado final del robot con reloj simulado.
- `RS.ui.resaltar()` marca exactamente un bloque y una línea a la vez.

La lógica pura (config, generador, sim, runtime) fue además verificada en un
smoke test headless con Node durante el desarrollo (19/19 aserciones OK).

## Divergencias respecto del firmware real (`example/control_PaperOne/`)

Estas divergencias son decisiones de producto documentadas, no bugs:

- **Giros sin dividir por 4**: `izquierda(ms)`/`derecha(ms)` consumen el valor
  `ms` tal cual (`GIRO = 0.18°/ms`). El firmware real hace `delay(rx_valor / 4)`
  para los giros. Se decidió priorizar la previsibilidad pedagógica sobre la
  paridad exacta de timing.
- **Nombres de despliegue distintos en el panel C++**: el panel de código muestra
  `girarIzquierda(500);` / `girarDerecha(500);` en vez de `izquierda`/`derecha`
  (nombres de protocolo), y `repetir(4) { ... }` en vez de un `for` de C++ real
  (no es C++ compilable, es pseudocódigo estilo Arduino). Configurable en
  `src/config.js` vía `RS.config.nombreCpp` y `RS.config.estiloRepetir` (`'repetir'`
  o `'for'`).
- **`bailar()` no existe**: fue removido por completo del producto (sin bloque,
  sin acción, sin coreografía de 13 pasos ni parpadeo de LED). El firmware real
  todavía acepta `"bailar"` como acción MQTT, pero el editor nunca la emite —
  el vocabulario generado (`avanzar`, `retroceder`, `izquierda`, `derecha`,
  `detener`, `led`) es un subconjunto estricto del vocabulario del firmware, así
  que no rompe nada si un programa se porta a MQTT en el futuro.
- **`toMqttPayload()` es solo transformación de datos**: no implica ningún cliente
  MQTT real, conexión de red ni topic — es una función pura que limpia un nodo
  hoja del árbol dejando `{accion, valor}`, compatible en forma con el payload
  que espera `mqtt_handler.h` (archivo de solo lectura, nunca modificado ni importado).

## Blockly sin internet (fallback local)

`index.html` carga Blockly desde CDN (`unpkg.com/blockly@11.2.2`) con atributo
`integrity` (SRI). Si el CDN no está disponible o falla la verificación de
integridad, un `onerror` inyecta automáticamente la copia local en
`vendor/blockly/blockly.min.js` (misma versión, descargada una sola vez con
`curl -L https://unpkg.com/blockly@11.2.2/blockly.min.js -o vendor/blockly/blockly.min.js`).
Esto permite usar el simulador en un aula sin conexión.

## Arquitectura (resumen)

Sin ES modules (romperían bajo `file://` por CORS): cada archivo cuelga de un
único objeto global `RS`, cargado en orden fijo vía `<script>` planos (ver
`index.html`). Un solo generador (`src/generator/program-tree.js`) recorre el
workspace de Blockly y produce un **árbol** de programa anidado (no una lista
plana): los nodos `repetir`/`si` tienen un cuerpo anidado, y las condiciones y
repeticiones se evalúan en tiempo de ejecución por el intérprete
(`src/runtime/interpreter.js`), no en tiempo de generación. Ese mismo árbol
alimenta dos consumidores desacoplados: el intérprete que mueve al robot, y
`src/generator/cpp-view.js`, que es una función pura sobre el árbol para el
panel de código — así ambas vistas nunca pueden desincronizarse por
construcción. El doble feedback (bloque resaltado + línea de código resaltada)
pasa por un único punto de llamada, `RS.ui.resaltar(blockId)`.

## Checklist E2E manual (registro de resultados)

Verificado mediante:
1. Descarga real de Blockly 11.2.2 desde CDN (`unpkg.com`) y cálculo del hash
   SHA-384 usado en el atributo `integrity` — confirmado que hay acceso a
   internet en este entorno y que el bundle UMD expone `window.Blockly` con
   mensajes en inglés incluidos por defecto.
2. Verificación de sintaxis (`node --check`) de los 16 archivos JavaScript — todos OK.
3. Smoke test headless en Node de la lógica pura (config, generador de árbol,
   `cppView`, mundo/robot/sensores, intérprete): **19/19 aserciones pasaron**,
   incluyendo:
   - Determinismo de `medirDistancia()`/`hayObstaculo()` para la misma pose.
   - Pose inicial del robot libre de colisión, con ≥40px de corredor libre
     hacia adelante.
   - Cinemática (`avanzar`, `girar`) con las constantes `VEL`/`GIRO` sin dividir por 4.
   - Árbol de programa NO aplanado para `repetir`/`si` (un solo nodo con cuerpo,
     no N hojas expandidas).
   - `toMqttPayload()` despoja metadata correctamente; `bailar` ausente del vocabulario.
   - `cppView.render()` genera líneas C++-style correctas, con indentación y
     mapeo bloque↔línea de solo cabecera para `repetir`/`si`.
   - El intérprete re-camina el cuerpo de `repetir` 3 veces en tiempo real
     (mismo `blockId`, no 3 nodos pre-generados).

**Pendiente de verificación manual en navegador real** (no se pudo automatizar en
esta sesión por no contar con herramienta de automatización de navegador):
arrastrar bloques en el editor real de Blockly, click en Ejecutar/Detener/Reiniciar,
provocar una colisión visualmente, evitarla con `si hayObstaculo()`, y comprobar
el resize del layout en 1280×720 y 1920×1080. El harness `tests/test.html` y la
guía de "Cómo probar" de arriba están listos para que quien abra el proyecto
complete esta verificación con un doble click.
