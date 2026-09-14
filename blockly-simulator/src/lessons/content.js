/**
 * RS.lessons.CONTENIDO — lesson data as a plain JS array (no JSON, no fetch:
 * the app is opened over file:// and fetch() would be CORS-blocked).
 *
 * Each record follows the mandatory 13-section structure from
 * data/Modulo_Aprendizaje.odt section 15 ("Formato de salida para generar
 * una lección"): objetivo, concepto, ejemplo, bloques, comoFunciona, prueba,
 * modificacion, desafio, criterioTexto, pista, competencias, resultados,
 * nivel.
 *
 * `criterio` is null when the lesson has no run-derived success check
 * (Lesson 1 is pure identification, see spec's lesson-success-check
 * capability). Lesson 2's `criterio.evaluar(snapshot)` checks
 * `snapshot.estado.x >= 260` (see check.js for the snapshot shape).
 *
 * Lessons 3-4 (this slice) introduce no new block types: Lesson 3
 * (Secuencias) uses only movement blocks; Lesson 4 (Sensores) uses only the
 * pre-existing `rs_si_obstaculo`/`rs_hay_obstaculo`/`rs_comparar` sensor
 * blocks. A lesson's `criterio` may also expose an optional
 * `describir(snapshot, ok)` hook for lesson-specific behavioral feedback
 * text (see check.js).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.lessons = RS.lessons || {};

  // Shared field order for full-lesson rendering (home.js's current-lesson
  // screen and panel.js's in-workspace side panel both read from here, so
  // the two stay in sync).
  RS.lessons.SECCIONES = [
    { clave: 'objetivo', titulo: 'Objetivo' },
    { clave: 'concepto', titulo: 'Concepto' },
    { clave: 'ejemplo', titulo: 'Ejemplo' },
    { clave: 'bloques', titulo: 'Bloques utilizados' },
    { clave: 'comoFunciona', titulo: '¿Cómo funciona?' },
    { clave: 'prueba', titulo: 'Prueba en el simulador' },
    { clave: 'modificacion', titulo: 'Modificación' },
    { clave: 'desafio', titulo: 'Desafío' },
    { clave: 'criterioTexto', titulo: 'Criterio de éxito' },
    { clave: 'pista', titulo: 'Pista' },
    { clave: 'competencias', titulo: 'Competencias' },
    { clave: 'resultados', titulo: 'Resultados de aprendizaje' },
    { clave: 'nivel', titulo: 'Nivel de dificultad' }
  ];

  // Lesson 1 has no run/criterio (pure identification) — it gets the plain
  // default field with no goal, same as Sandbox.
  var MAPA_SIN_DESAFIO = {
    obstaculos: [
      { x: 300, y: 220, w: 60, h: 140 },
      { x: 520, y: 80, w: 60, h: 60 },
      { x: 520, y: 420, w: 90, h: 70 },
      { x: 200, y: 470, w: 120, h: 40 },
      { x: 680, y: 220, w: 50, h: 160 }
    ],
    poseInicial: { x: 80, y: 300, angulo: 0 },
    meta: null
  };

  // Every criterio.evaluar below tests goal-arrival via RS.world.enMeta-
  // equivalent point-in-rect math against ITS OWN `meta` (closed over here,
  // not read from the live RS.world — this keeps criterio.evaluar a pure
  // function of `snapshot` alone, exactly like every other check in this
  // file, and lets tests call it directly with synthetic snapshots without
  // first loading the lesson's map into RS.world).
  function dentroDeMeta(meta, x, y) {
    return x >= meta.x && x <= meta.x + meta.w && y >= meta.y && y <= meta.y + meta.h;
  }

  // Each lesson's map is hoisted into a named constant and reused (never
  // re-literaled) both in its `mapa` field and inside its own
  // `criterio.evaluar` — a single source of truth for the goal rect, so the
  // visual marker (drawn from `mapa.meta`) and the actual pass/fail zone can
  // never silently drift apart.
  // v2 (richer maps — obstacle/goal geometry re-derived after the first
  // pass was judged too simple): every obstacle below is a real, collidable
  // AABB, empirically verified against the actual scheduler (Node harness,
  // same method as the original design). Decorative pieces (flanking
  // "tunnel" walls that dress up a straight approach without blocking it)
  // are called out per lesson; every other obstacle is load-bearing.
  var MAPA_LECCION_2 = {
    // Main wall pushed out to x=400 (was x=300) for a longer approach, plus
    // two decorative flanking walls forming a tunnel around the travel lane
    // (y150-200 / y400-450, clear of the y270-330 travel band). Empirically
    // verified: avanzar(2100)+detener() stops at x=332, inside the goal, no
    // collision; avanzar(3000) collides at x≈379.5 (boundary x>=380).
    obstaculos: [
      { x: 400, y: 220, w: 60, h: 140 },
      { x: 100, y: 150, w: 350, h: 50 },
      { x: 100, y: 400, w: 350, h: 50 }
    ],
    poseInicial: { x: 80, y: 300, angulo: 0 },
    meta: { x: 310, y: 270, w: 50, h: 60 }
  };
  var MAPA_LECCION_3 = {
    // Genuine two-turn zigzag (east → south → east), both required: wall A
    // blocks the direct east path (forces the first turn before x=280);
    // wall B blocks southward overshoot (forces the second turn before
    // continuing east). Third obstacle is purely decorative (off-path).
    // Empirically verified: avanzar(1500)+derecha(500)+avanzar(1200)+
    // izquierda(500)+avanzar(1000) reaches x=380,y=444, inside the goal;
    // going straight (no turn) collides at x≈279.7; turning once and
    // continuing south collides against wall B at y≈453.6.
    obstaculos: [
      { x: 300, y: 180, w: 60, h: 220 },
      { x: 180, y: 474, w: 160, h: 60 },
      { x: 620, y: 90, w: 70, h: 70 }
    ],
    poseInicial: { x: 80, y: 300, angulo: 0 },
    meta: { x: 350, y: 410, w: 70, h: 70 }
  };
  var MAPA_LECCION_4 = {
    // Main wall pushed out to x=440 (was x=340), plus two decorative
    // canyon walls (y150-190 / y410-450) dressing up the longer approach.
    // Empirically verified: avanzar(2583)+si hayObstaculo(){detener()}
    // stops at x=389.96, sensor consulted once, inside the goal.
    obstaculos: [
      { x: 440, y: 200, w: 60, h: 180 },
      { x: 150, y: 150, w: 400, h: 40 },
      { x: 150, y: 410, w: 400, h: 40 }
    ],
    poseInicial: { x: 80, y: 300, angulo: 0 },
    meta: { x: 350, y: 255, w: 55, h: 90 }
  };
  var MAPA_LECCION_5 = {
    // Main wall pushed out to x=380 (was x=320). Two decorative pieces add
    // visual richness without touching the intended post-turn path.
    // Empirically verified: avanzar(1900)+si_sino(hayObstaculo){derecha
    // (500)}sino{}+avanzar(800) reaches x=308,y=396, sensor consulted
    // once, inside the goal; a too-long first leg (avanzar(2400)) collides
    // at x≈358.4 before the decision is even reached.
    obstaculos: [
      { x: 380, y: 220, w: 60, h: 140 },
      { x: 550, y: 80, w: 70, h: 70 },
      { x: 150, y: 520, w: 200, h: 50 }
    ],
    poseInicial: { x: 80, y: 300, angulo: 0 },
    meta: { x: 270, y: 380, w: 90, h: 80 }
  };
  var MAPA_LECCION_6 = {
    // Main wall pushed out to x=420 (was x=300) for a longer, more visible
    // loop (more repetitions), plus two decorative flanking walls forming a
    // tunnel (y130-170 / y420-460, clear of the travel band). Empirically
    // verified: "repetir hasta hayObstaculo() { avanzar(100) }" exits at
    // x=344, y=300, evalsSensor=23, limiteSeguridad=null — inside the goal.
    obstaculos: [
      { x: 420, y: 180, w: 60, h: 220 },
      { x: 100, y: 130, w: 400, h: 40 },
      { x: 100, y: 420, w: 400, h: 40 }
    ],
    poseInicial: { x: 80, y: 300, angulo: 0 },
    meta: { x: 320, y: 260, w: 60, h: 80 }
  };
  var MAPA_LECCION_7 = {
    // Capstone v2: keeps the original first obstacle (near-start detour,
    // north or south) and ADDS a second load-bearing obstacle further east
    // (x560-620, spanning y140-440) that BOTH routes must detect and detour
    // around a second time before re-orienting east to the goal — the
    // capstone now genuinely chains two independent obstacle encounters,
    // not one. Third obstacle is decorative (far south, off both routes).
    // Empirically verified (Node harness, real scheduler):
    //   south route: avanzar(900)→repetir_hasta{avanzar(100)}→si_sino{
    //     derecha(500)}→avanzar(750)→izquierda(500)→repetir_hasta{
    //     avanzar(100)}→si_sino{derecha(500)}→avanzar(700)→izquierda(500)→
    //     avanzar(1900) reaches x=704,y=474, evalsSensor=28, inside goal.
    //   north route (mirrored, izquierda/derecha swapped) reaches
    //     x=704,y=102, also inside goal.
    //   Barreling straight east after only the FIRST detour (no second
    //     si_sino) collides against the new second obstacle at x≈538.9 —
    //     it is not optional. The old "ejemplo" program alone (no detours
    //     at all) still falls short at x=224 — no solution leak.
    obstaculos: [
      { x: 300, y: 220, w: 60, h: 140 },
      { x: 560, y: 140, w: 60, h: 300 },
      { x: 200, y: 500, w: 120, h: 40 }
    ],
    poseInicial: { x: 80, y: 300, angulo: 0 },
    meta: { x: 620, y: 90, w: 170, h: 420 }
  };

  RS.lessons.CONTENIDO = [
    {
      id: 1,
      nivel: 'Nivel 1 — Reconocimiento',
      titulo: '¿Qué es un robot?',
      objetivo: 'En esta lección aprenderás a identificar los componentes básicos de un robot móvil y a comprender su función dentro del simulador.',
      concepto: 'Un robot está compuesto por un sensor (percibe el entorno), un actuador (produce movimiento o acción), un controlador (decide qué hacer) y un entorno (el espacio donde el robot se mueve). En el simulador, estos cuatro elementos ya están presentes: el sensor de distancia, las ruedas como actuador, el programa de bloques como controlador y el mapa como entorno.',
      ejemplo: 'No hay programa que construir todavía: el ejemplo es visual. Observa el robot en el panel Simulador y localiza cada componente sobre su chasis.',
      bloques: 'Ninguno todavía — esta lección no requiere armar un programa.',
      comoFunciona: 'El chasis azul es el cuerpo del robot. Las ruedas (actuador) permiten el movimiento. El sensor frontal mide la distancia a los obstáculos. El programa que arma con bloques cumple el rol de controlador: decide qué instrucción ejecutar.',
      prueba: 'Esta lección no requiere ejecutar un programa en el simulador todavía. Simplemente observa el robot en el panel Simulador.',
      modificacion: 'No aplica en esta lección: no hay programa que modificar.',
      desafio: 'Señala, en el panel Simulador, dónde ubicarías el sensor, el actuador y el controlador del robot.',
      criterioTexto: 'El estudiante identifica correctamente los cuatro componentes (robot, sensor, actuador, controlador) sin ejecutar ningún programa.',
      pista: 'Pista 1: recordá que un robot siempre combina percepción (sensor), decisión (controlador) y acción (actuador).',
      competencias: 'C1 — Fundamentos de robótica',
      resultados: 'RA1 — Identificación',
      mapa: MAPA_SIN_DESAFIO,
      criterio: null
    },
    {
      id: 2,
      nivel: 'Nivel 2 — Aplicación guiada',
      titulo: 'Movimiento',
      objetivo: 'En esta lección aprenderás a utilizar los bloques de movimiento para hacer que el robot avance y se detenga.',
      concepto: 'El robot se mueve cuando su controlador ejecuta instrucciones de movimiento: avanzar, retroceder y girar. Cada instrucción tiene una duración (en milisegundos) que determina cuánto se desplaza o gira el robot antes de pasar a la siguiente instrucción.',
      ejemplo: 'INICIO → avanzar(2000) → detener()',
      bloques: 'avanzar(ms), detener()',
      comoFunciona: 'El bloque avanzar(2000) mueve el robot hacia adelante durante 2000 milisegundos. El bloque detener() lo detiene de inmediato al terminar. Juntos forman una secuencia: primero se ejecuta avanzar, y recién cuando termina se ejecuta detener.',
      prueba: 'Arma la secuencia avanzar(2000) seguida de detener() en el editor y presioná Ejecutar. Observá cómo se desplaza el robot en el panel Simulador.',
      modificacion: 'Cambiá el valor de avanzar(2000) por un número distinto y volvé a ejecutar. Observá cómo cambia la distancia recorrida.',
      desafio: 'Hacé que el robot avance durante un tiempo determinado y quede detenido dentro de la zona marcada en el simulador, antes de llegar al obstáculo.',
      criterioTexto: 'El robot debe avanzar y quedar detenido dentro de la zona de meta marcada en el mapa (justo antes del obstáculo), sin colisionar contra él.',
      pista: 'Pista 1: recordá que avanzar(ms) mueve el robot un tiempo determinado; a mayor ms, mayor distancia.',
      competencias: 'C2 — Movimiento y control',
      resultados: 'RA2 — Movimiento',
      // Geometry/verification: see MAPA_LECCION_2 above.
      mapa: MAPA_LECCION_2,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado) return false;
          return dentroDeMeta(MAPA_LECCION_2.meta, snapshot.estado.x, snapshot.estado.y);
        }
      }
    },
    {
      id: 3,
      nivel: 'Nivel 2 — Aplicación guiada',
      titulo: 'Secuencias',
      objetivo: 'En esta lección aprenderás que las acciones de un robot pueden ejecutarse en un orden determinado, y que ese orden cambia el resultado final del recorrido.',
      concepto: 'Un programa de robot es una secuencia: una lista de instrucciones que se ejecutan una después de la otra, en el orden en que fueron escritas. El robot no "decide" el orden por sí solo — recorre las instrucciones exactamente como el controlador las armó. Cambiar el orden de dos instrucciones cambia el camino que recorre el robot, aunque las instrucciones sean las mismas.',
      ejemplo: 'INICIO → avanzar(1000) → derecha(500) → avanzar(1000)',
      bloques: 'avanzar(ms), derecha(ms), retroceder(ms), izquierda(ms), detener()',
      comoFunciona: 'Cada bloque se ejecuta completo antes de pasar al siguiente: primero avanzar(1000) desplaza al robot hacia adelante, luego derecha(500) lo gira sobre su lugar, y recién después el segundo avanzar(1000) lo desplaza en la nueva dirección. Si se invirtiera el orden del giro y el segundo avance, el robot terminaría en un punto distinto.',
      prueba: 'Arma la secuencia avanzar(1000) → derecha(500) → avanzar(1000) en el editor y presioná Ejecutar. Observá el camino en forma de "L" que recorre el robot en el panel Simulador.',
      modificacion: 'Cambiá el orden de los bloques (por ejemplo, girá antes de avanzar la primera vez) y volvé a ejecutar. Observá cómo el camino final es distinto aunque uses las mismas instrucciones.',
      desafio: 'Armá una secuencia que rodee dos obstáculos en el camino — girando en el momento justo cada vez — y llegue a la zona de meta marcada al sureste. Vas a necesitar más de un giro.',
      criterioTexto: 'El robot debe girar a tiempo para esquivar el primer obstáculo, volver a girar para no pasarse de largo, y terminar detenido dentro de la zona de meta marcada, sin colisionar en ningún tramo.',
      pista: 'Pista 1: recordá que las instrucciones se ejecutan en el orden exacto en que las colocaste, una tras otra. Pista 2: si avanzás demasiado antes de girar, vas a chocar contra el obstáculo — el giro tiene que pasar antes de llegar a él. Pista 3: después del primer giro hay un segundo tramo con su propio límite: si seguís de largo sin volver a girar, también vas a chocar. Pista 4: usá izquierda(ms) para el segundo giro, así el robot vuelve a orientarse hacia el este.',
      competencias: 'C3 — Secuenciación de instrucciones',
      resultados: 'RA3 — Secuencias',
      // Geometry/verification: see MAPA_LECCION_3 above.
      mapa: MAPA_LECCION_3,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado) return false;
          return dentroDeMeta(MAPA_LECCION_3.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var y = Math.round(snapshot.estado.y);
          if (ok) {
            return 'El robot esquivó el obstáculo y terminó en x=' + x + 'px, y=' + y + 'px, dentro de la zona de meta.';
          }
          if (Math.abs(y - 300) < 60) {
            return 'El robot terminó casi a la misma altura que al inicio (y=' + y + 'px): la secuencia no llegó a girar a tiempo.';
          }
          return 'El robot terminó en x=' + x + 'px, y=' + y + 'px, fuera de la zona de meta.';
        }
      }
    },
    {
      id: 4,
      nivel: 'Nivel 2 — Aplicación guiada',
      titulo: 'Sensores',
      objetivo: 'En esta lección aprenderás a usar la lectura del sensor de distancia del robot para tomar una decisión: detenerse al aproximarse a un obstáculo.',
      concepto: 'Un sensor es un componente que percibe una condición del entorno — en este caso, la distancia hasta el obstáculo más cercano frente al robot. Esa lectura permite que el controlador tome una decisión en lugar de seguir siempre la misma secuencia fija: por ejemplo, "si la distancia es menor a 20, entonces detener el robot".',
      ejemplo: 'INICIO → avanzar(1300) → si hayObstaculo() { detener() }',
      bloques: 'avanzar(ms), si (hayObstaculo) hacer, comparar (medirDistancia < número), detener()',
      comoFunciona: 'El bloque "si hayObstaculo()" consulta el sensor de distancia en el instante en que el robot llega a esa instrucción. Si detecta un obstáculo cerca, ejecuta lo que está dentro del bloque (por ejemplo, detener()); si no detecta nada, continúa de largo con la siguiente instrucción. La decisión depende de la lectura real del sensor en ese momento, no de un valor fijo escrito de antemano.',
      prueba: 'Arma avanzar(1300) seguido de un bloque "si hayObstaculo() { detener() }" y presioná Ejecutar. Observá que el robot se detiene solo, sin que hayas fijado a mano en qué punto exacto frenar.',
      modificacion: 'Reemplazá el sensor "hayObstaculo()" por un bloque comparar que evalúe medirDistancia() contra un número (por ejemplo, medirDistancia() < 20) y volvé a ejecutar. Observá que la decisión de detenerse sigue dependiendo de una lectura del sensor, no de un valor de posición fijo.',
      desafio: 'Programá al robot para que avance y quede detenido dentro de la zona de meta marcada, justo antes del obstáculo, usando la lectura del sensor para decidir cuándo frenar — no una distancia fija adivinada de antemano.',
      criterioTexto: 'El robot debe quedar detenido dentro de la zona de meta marcada, justo antes del obstáculo, habiendo consultado el sensor al menos una vez durante la ejecución.',
      pista: 'Pista 1: recordá que el sensor solo se consulta cuando el programa llega a un bloque que lo usa (por ejemplo, "si hayObstaculo()"). Pista 2: si el robot no llega a ejecutar ningún bloque de sensor, nunca tomará una decisión basada en lo que percibe. Pista 3: colocá el bloque de decisión con el sensor después del avance, para que la lectura ocurra mientras el robot ya se está acercando al obstáculo.',
      competencias: 'C4 — Sensores y decisión',
      resultados: 'RA4 — Sensores',
      // Geometry/verification: see MAPA_LECCION_4 above.
      mapa: MAPA_LECCION_4,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          if (snapshot.metricas.evalsSensor < 1) return false;
          return dentroDeMeta(MAPA_LECCION_4.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var evals = snapshot.metricas ? snapshot.metricas.evalsSensor : 0;
          if (ok) {
            return 'El robot consultó su sensor y se detuvo dentro de la zona de meta, cerca del obstáculo (x=' + x + 'px).';
          }
          if (!evals) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor de distancia.';
          }
          return 'El robot terminó en x=' + x + 'px, fuera de la zona de meta.';
        }
      }
    },
    {
      id: 5,
      nivel: 'Nivel 2 — Aplicación guiada',
      titulo: 'Condicionales',
      objetivo: 'En esta lección aprenderás a hacer que el robot elija entre dos acciones distintas según se cumpla o no una condición.',
      concepto: 'Un condicional "si / si no" le permite al controlador elegir siempre una de dos acciones posibles: si la condición es verdadera, ejecuta la primera rama; si es falsa, ejecuta la segunda. A diferencia del bloque "si" (Lección 4), que solo agrega una acción cuando la condición se cumple y no hace nada en caso contrario, "si / si no" siempre ejecuta exactamente una de las dos ramas, nunca ambas ni ninguna.',
      ejemplo: 'INICIO → avanzar(1200) → si hayObstaculo() { derecha(500) } si no { } → avanzar(1000)',
      bloques: 'avanzar(ms), derecha(ms), si (hayObstaculo) / si no, comparar (medirDistancia < número)',
      comoFunciona: 'El bloque "si / si no" consulta la condición una sola vez, en el instante en que el robot llega a esa instrucción. Si la condición es verdadera, ejecuta únicamente lo que está en la primera rama; si es falsa, ejecuta únicamente lo que está en la rama "si no". Después de resolver esa decisión, el programa continúa con la siguiente instrucción de la secuencia, sin volver a consultar la condición.',
      prueba: 'Arma la secuencia avanzar(1200) → "si hayObstaculo() { derecha(500) } si no { }" → avanzar(1000) y presioná Ejecutar. Observá que el robot gira al detectar el obstáculo y luego continúa avanzando en la nueva dirección.',
      modificacion: 'Colocá alguna instrucción dentro de la rama "si no" (por ejemplo avanzar(500)) y alejá al robot del obstáculo antes de ejecutar, para observar que esa rama solo se ejecuta cuando la condición es falsa.',
      desafio: 'Haz que el robot avance, detecte el obstáculo con el sensor, gire para esquivarlo y llegue a la zona de meta marcada al sur.',
      criterioTexto: 'El robot debe haber consultado su sensor al menos una vez durante la ejecución, y terminar detenido dentro de la zona de meta marcada al sur del punto de giro, sin colisionar.',
      pista: 'Pista 1: recordá que "si / si no" siempre ejecuta una de las dos ramas, nunca ninguna ni ambas — pensá qué debería pasar en cada caso. Pista 2: para que el robot llegue a la zona de meta necesitás que, tras la decisión, siga habiendo un movimiento hacia adelante en la nueva dirección. Pista 3: revisá que la rama que gira esté conectada a la condición que detecta el obstáculo, y que después de la decisión el robot siga avanzando.',
      competencias: 'C5 — Condicionales',
      resultados: 'RA5 — Decisión de dos ramas',
      // Geometry/verification: see MAPA_LECCION_5 above.
      mapa: MAPA_LECCION_5,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          if (snapshot.metricas.evalsSensor < 1) return false;
          return dentroDeMeta(MAPA_LECCION_5.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var y = Math.round(snapshot.estado.y);
          var evals = snapshot.metricas ? snapshot.metricas.evalsSensor : 0;
          if (ok) {
            return 'El robot consultó su sensor, tomó la decisión correcta y terminó en x=' + x + 'px, y=' + y + 'px, dentro de la zona de meta.';
          }
          if (!evals) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor, por lo que nunca tomó una decisión basada en lo que percibe.';
          }
          if (Math.abs(y - 300) < 60) {
            return 'El robot consultó su sensor pero terminó casi a la misma altura que al inicio (y=' + y + 'px): la rama tomada no cambió su dirección de avance.';
          }
          return 'El robot terminó en x=' + x + 'px, y=' + y + 'px, fuera de la zona de meta.';
        }
      }
    },
    {
      id: 6,
      nivel: 'Nivel 3 — Autonomía',
      titulo: 'Repetición',
      objetivo: 'En esta lección aprenderás a hacer que el robot repita una acción de forma automática hasta que se cumpla una condición, en lugar de calcular a mano cuántas veces repetirla.',
      concepto: 'El bloque "repetir hasta" es un bucle de pre-verificación: antes de cada pasada, consulta la condición; si ya es verdadera, no ejecuta el cuerpo ni una sola vez. Si es falsa, ejecuta el cuerpo una vez y vuelve a consultar la condición, repitiendo este ciclo hasta que la condición se cumpla. A diferencia de "repetir N veces" (que siempre repite una cantidad fija conocida de antemano), "repetir hasta" no sabe cuántas veces va a repetir: depende de lo que perciba el sensor en cada vuelta. Por seguridad, el simulador impone un límite máximo de repeticiones: si la condición nunca llega a cumplirse, el bucle se corta solo al llegar a ese límite, en vez de quedar repitiendo para siempre.',
      ejemplo: 'INICIO → repetir hasta hayObstaculo() { avanzar(100) }',
      bloques: 'avanzar(ms), repetir hasta (hayObstaculo) hacer, comparar (medirDistancia < número)',
      comoFunciona: 'Antes de cada pasada del bucle, el bloque "repetir hasta" consulta la condición hayObstaculo(). Mientras sea falsa, ejecuta avanzar(100) y vuelve a preguntar. En cuanto hayObstaculo() se vuelve verdadera, el bucle termina sin ejecutar una pasada más, y el programa continúa con la siguiente instrucción (si hay alguna). Si la condición nunca se cumpliera, el simulador corta el bucle al alcanzar su límite de repeticiones de seguridad, para que el robot nunca quede repitiendo indefinidamente.',
      prueba: 'Arma "repetir hasta hayObstaculo() { avanzar(100) }" y presioná Ejecutar. Observá que el robot avanza en pasos cortos, deteniéndose solo cuando la condición se cumple, sin que hayas calculado a mano cuántos pasos hacían falta.',
      modificacion: 'Cambiá el valor de avanzar(100) por un paso más pequeño (por ejemplo avanzar(50)) y volvé a ejecutar. Observá que el robot necesita más repeticiones para llegar al mismo punto, y que el bucle sigue consultando la condición antes de cada paso.',
      desafio: 'Programá al robot para que se acerque a un obstáculo repitiendo un paso pequeño hasta detectarlo con el sensor, y quede detenido dentro de la zona de meta marcada.',
      criterioTexto: 'El robot debe quedar detenido dentro de la zona de meta marcada, cerca del obstáculo, habiendo consultado el sensor al menos dos veces, y sin haber alcanzado el límite de seguridad del bucle.',
      pista: 'Pista 1: recordá que "repetir hasta" consulta la condición antes de cada pasada, no solo al final. Pista 2: si el paso de avanzar es demasiado grande, el robot puede pasarse del punto donde el sensor detecta el obstáculo; usá pasos pequeños. Pista 3: si el bucle nunca detecta el obstáculo, va a terminar solo al llegar a su límite de repeticiones de seguridad — revisá que la condición del bucle sea realmente la que detecta el obstáculo que tenés adelante.',
      competencias: 'C6 — Repetición condicionada',
      resultados: 'RA6 — Bucles de pre-verificación',
      // Geometry/verification: see MAPA_LECCION_6 above.
      mapa: MAPA_LECCION_6,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var m = snapshot.metricas;
          if (m.evalsSensor < 2 || m.limiteSeguridad !== null) return false;
          return dentroDeMeta(MAPA_LECCION_6.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var m = snapshot.metricas || { evalsSensor: 0, limiteSeguridad: null };
          if (ok) {
            return 'El robot repitió el paso hasta detectar el obstáculo con su sensor y se detuvo en x=' + x + 'px, dentro de la zona de meta.';
          }
          if (m.limiteSeguridad) {
            return 'El robot alcanzó el límite de seguridad del bucle sin que la condición llegara a cumplirse.';
          }
          if (m.evalsSensor < 2) {
            return 'El robot terminó su ejecución habiendo consultado el sensor menos de dos veces: el bucle no llegó a repetirse lo suficiente.';
          }
          return 'El robot no se detuvo dentro de la zona de meta (x=' + x + 'px).';
        }
      }
    },
    {
      id: 7,
      nivel: 'Nivel 3 — Autonomía',
      titulo: 'Desafío integrado',
      objetivo: 'En esta lección vas a combinar todo lo aprendido — secuencias, sensores, "si / si no" y "repetir hasta" — para programar al robot de punta a punta, decidiendo vos mismo cómo rodear un obstáculo.',
      concepto: 'Un programa completo casi nunca usa una sola herramienta: combina una secuencia de pasos con decisiones ("si / si no") y repeticiones ("repetir hasta") que dependen de lo que el sensor va percibiendo en cada momento. No existe una única forma correcta de resolver un mismo problema: dos programas distintos, que usen bloques o combinaciones distintas, pueden lograr el mismo resultado si ambos hacen que el robot recorra el camino sin chocar.',
      ejemplo: 'INICIO → avanzar(900) → repetir hasta hayObstaculo() { avanzar(100) } (el robot se acerca al obstáculo y se detiene junto a él; a partir de ahí, sos vos quien decide cómo continuar el recorrido).',
      bloques: 'avanzar(ms), retroceder(ms), izquierda(ms), derecha(ms), detener(), si (hayObstaculo) hacer, si / si no, repetir hasta (hayObstaculo), comparar (medirDistancia < número)',
      comoFunciona: 'Cada herramienta cumple su rol dentro del programa completo: la secuencia ordena los pasos, el sensor te dice cuándo hay un obstáculo cerca, "si / si no" elige entre dos acciones según lo que detecta el sensor, y "repetir hasta" repite un paso corto sin que vos calcules cuántas veces hace falta. Combinarlas te permite programar un recorrido que se adapta al obstáculo, en vez de una ruta fija memorizada de antemano.',
      prueba: 'Arma el ejemplo (avanzar(900) → repetir hasta hayObstaculo() { avanzar(100) }) y presioná Ejecutar. Observá que el robot se detiene junto al obstáculo, listo para que agregues la parte del recorrido que lo rodea.',
      modificacion: 'A partir del ejemplo, agregá un bloque "si / si no" que decida girar cuando el sensor detecte el obstáculo, y seguí completando el recorrido paso a paso hasta lograr que el robot lo rodee por completo.',
      desafio: 'Programá al robot para que recorra el mapa completo: esquivá el primer obstáculo que encuentra en su camino usando el sensor, seguí avanzando, esquivá un SEGUNDO obstáculo más adelante de la misma manera, y llegá a la amplia zona de meta del lado derecho del mapa, sin chocar en ningún momento.',
      criterioTexto: 'El robot debe completar el recorrido —esquivando los dos obstáculos que encuentra en el camino— y quedar detenido dentro de la zona de meta marcada del lado derecho del mapa, habiendo consultado el sensor al menos una vez durante la ejecución, sin haber chocado y sin haber alcanzado el límite de seguridad de ningún bucle. No existe una única ruta correcta: cualquier combinación de bloques que logre este resultado es válida.',
      pista: 'Pista 1: pensá el desafío como varios pasos más chicos encadenados: acercarte al primer obstáculo, decidir hacia dónde rodearlo, retomar el camino, y repetir lo mismo con el segundo. Pista 2: usá el sensor (con "si / si no" o "repetir hasta") para decidir cuándo girar, en vez de adivinar una distancia fija. Pista 3: después de rodear cada obstáculo, acordate de volver a orientar al robot hacia la derecha antes de seguir avanzando, o terminará desviado de su recorrido. Pista 4: el segundo obstáculo es real — si intentás cruzar de largo sin esquivarlo, vas a chocar.',
      competencias: 'C7 — Integración de secuencias, sensores y control de flujo',
      resultados: 'RA7 — Programa autónomo completo',
      // Geometry/verification: see MAPA_LECCION_7 above.
      mapa: MAPA_LECCION_7,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var m = snapshot.metricas;
          if (m.evalsSensor < 1 || m.limiteSeguridad !== null) return false;
          return dentroDeMeta(MAPA_LECCION_7.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var m = snapshot.metricas || { evalsSensor: 0, limiteSeguridad: null };
          if (ok) {
            return 'El robot completó el recorrido, rodeó el obstáculo usando su sensor y llegó a la zona de meta (x=' + x + 'px) sin chocar.';
          }
          if (m.limiteSeguridad) {
            return 'El robot alcanzó el límite de seguridad de un bucle sin resolver la condición durante el recorrido.';
          }
          if (!m.evalsSensor) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor durante el recorrido.';
          }
          return 'El robot no completó el recorrido: se detuvo en x=' + x + 'px, fuera de la zona de meta.';
        }
      }
    }
  ];
})(typeof window !== 'undefined' ? window : this);
