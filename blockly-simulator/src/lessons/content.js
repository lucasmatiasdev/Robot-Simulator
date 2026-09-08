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
      desafio: 'Hacé que el robot avance durante un tiempo determinado y se detenga antes de llegar al obstáculo que aparece en el simulador.',
      criterioTexto: 'El robot debe avanzar y quedar detenido en una posición final x ≥ 260px, sin colisionar contra el obstáculo ubicado en x=300px (margen de seguridad de 40px).',
      pista: 'Pista 1: recordá que avanzar(ms) mueve el robot un tiempo determinado; a mayor ms, mayor distancia.',
      competencias: 'C2 — Movimiento y control',
      resultados: 'RA2 — Movimiento',
      // Start x=80, first obstacle at x=300 (40px wide, so its face is at
      // x=300): a final x >= 260 leaves a 40px safety margin before it.
      criterio: {
        evaluar: function (snapshot) {
          return !!(snapshot && snapshot.estado && snapshot.estado.x >= 260);
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
      desafio: 'Armá una secuencia que le permita al robot recorrer una ruta sencilla utilizando varias instrucciones consecutivas, de modo que termine notablemente alejado de su punto de partida, tanto en dirección horizontal como vertical.',
      criterioTexto: 'El robot debe terminar su recorrido a una distancia horizontal de al menos 160px del origen (x ≥ 160px) y a una distancia vertical de al menos 60px de su altura inicial (|y − 300| ≥ 60px), sin colisionar.',
      pista: 'Pista 1: recordá que las instrucciones se ejecutan en el orden exacto en que las colocaste, una tras otra. Pista 2: para alejarte tanto en x como en y necesitás combinar al menos un avance y al menos un giro en tu secuencia. Pista 3: revisá que el giro esté ubicado entre dos avances, y no al principio o al final, para que realmente cambie la dirección del segundo tramo.',
      competencias: 'C3 — Secuenciación de instrucciones',
      resultados: 'RA3 — Secuencias',
      // Geometry: start (80,300,0°). avanzar(1000)+derecha(500,90°)+avanzar(1000)
      // reaches roughly x=200,y=420 — well past both thresholds with margin.
      criterio: {
        evaluar: function (snapshot) {
          return !!(snapshot && snapshot.estado &&
            snapshot.estado.x >= 160 && Math.abs(snapshot.estado.y - 300) >= 60);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var y = Math.round(snapshot.estado.y);
          if (ok) {
            return 'El robot ejecutó la secuencia completa y terminó en x=' + x + 'px, y=' + y + 'px, claramente alejado de su punto de partida.';
          }
          if (Math.abs(y - 300) < 60) {
            return 'El robot terminó casi a la misma altura que al inicio (y=' + y + 'px): la secuencia no llegó a cambiar de dirección.';
          }
          return 'El robot terminó en x=' + x + 'px, sin alejarse lo suficiente de su punto de partida.';
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
      desafio: 'Programá al robot para que avance y se detenga al aproximarse a un obstáculo, usando la lectura del sensor para decidir cuándo frenar, no una distancia fija adivinada de antemano.',
      criterioTexto: 'El robot debe quedar detenido cerca del obstáculo, entre x=225px y x=270px, a una altura similar a la inicial (|y − 300| ≤ 40px), habiendo consultado el sensor al menos una vez durante la ejecución.',
      pista: 'Pista 1: recordá que el sensor solo se consulta cuando el programa llega a un bloque que lo usa (por ejemplo, "si hayObstaculo()"). Pista 2: si el robot no llega a ejecutar ningún bloque de sensor, nunca tomará una decisión basada en lo que percibe. Pista 3: colocá el bloque de decisión con el sensor después del avance, para que la lectura ocurra mientras el robot ya se está acercando al obstáculo.',
      competencias: 'C4 — Sensores y decisión',
      resultados: 'RA4 — Sensores',
      // Geometry: hayObstaculo() true for x>216; obstacle face at x=300,
      // collision at x>=280. The "si hayObstaculo(){detener()}" check only
      // runs once the preceding avanzar() node finishes (sequential
      // interpreter), so its duration must land comfortably inside the
      // pinned [225,270] window, not just past the x>216 sensor threshold:
      // avanzar(1300) stops at x=236 (80 + 0.12*1300).
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var x = snapshot.estado.x;
          var y = snapshot.estado.y;
          return x >= 225 && x <= 270 && Math.abs(y - 300) <= 40 && snapshot.metricas.evalsSensor >= 1;
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var evals = snapshot.metricas ? snapshot.metricas.evalsSensor : 0;
          if (ok) {
            return 'El robot consultó su sensor y se detuvo a una distancia segura del obstáculo (x=' + x + 'px).';
          }
          if (!evals) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor de distancia.';
          }
          if (x < 225) {
            return 'El robot se detuvo demasiado lejos del obstáculo (x=' + x + 'px), sin aprovechar la lectura del sensor.';
          }
          return 'El robot no se detuvo a tiempo al aproximarse al obstáculo (x=' + x + 'px).';
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
      desafio: 'Haz que el robot avance cuando el camino esté libre y cambie de dirección cuando detecte un obstáculo.',
      criterioTexto: 'El robot debe haber consultado su sensor al menos una vez durante la ejecución, y terminar alejado de su punto de partida tanto en dirección horizontal (x ≥ 200px) como en dirección vertical (al menos 60px de diferencia respecto a su altura inicial), sin colisionar.',
      pista: 'Pista 1: recordá que "si / si no" siempre ejecuta una de las dos ramas, nunca ninguna ni ambas — pensá qué debería pasar en cada caso. Pista 2: para que el robot termine notablemente desplazado tanto en x como en y necesitás que, tras la decisión, siga habiendo un movimiento hacia adelante en la nueva dirección. Pista 3: revisá que la rama que gira esté conectada a la condición que detecta el obstáculo, y que después de la decisión el robot siga avanzando.',
      competencias: 'C5 — Condicionales',
      resultados: 'RA5 — Decisión de dos ramas',
      // Geometry: hayObstaculo() true for x>216, obstacle face at x=300,
      // collision at x>=280. avanzar(1200) stops at x=224 (80+0.12*1200),
      // past the sensor threshold but short of collision. The "si/si no"
      // then turns 90° (derecha(500)) when the sensor is true, and the
      // program continues with avanzar(1000) in the new heading: y moves by
      // ~120px (0.12*1000), landing around x=224, y=420 — matching design's
      // pinned expected pose.
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var x = snapshot.estado.x;
          var y = snapshot.estado.y;
          return snapshot.metricas.evalsSensor >= 1 && x >= 200 && Math.abs(y - 300) >= 60;
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var y = Math.round(snapshot.estado.y);
          var evals = snapshot.metricas ? snapshot.metricas.evalsSensor : 0;
          if (ok) {
            return 'El robot consultó su sensor, tomó la decisión correcta y terminó en x=' + x + 'px, y=' + y + 'px, claramente desplazado de su punto de partida.';
          }
          if (!evals) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor, por lo que nunca tomó una decisión basada en lo que percibe.';
          }
          if (Math.abs(y - 300) < 60) {
            return 'El robot consultó su sensor pero terminó casi a la misma altura que al inicio (y=' + y + 'px): la rama tomada no cambió su dirección de avance.';
          }
          return 'El robot terminó en x=' + x + 'px, sin alejarse lo suficiente de su punto de partida horizontal.';
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
      desafio: 'Programá al robot para que se acerque a un obstáculo repitiendo un paso pequeño hasta detectarlo con el sensor, sin calcular de antemano cuántas repeticiones necesita.',
      criterioTexto: 'El robot debe quedar detenido cerca del obstáculo, entre x=217px y x=270px, a una altura similar a la inicial (|y − 300| ≤ 40px), habiendo consultado el sensor al menos dos veces, y sin haber alcanzado el límite de seguridad del bucle.',
      pista: 'Pista 1: recordá que "repetir hasta" consulta la condición antes de cada pasada, no solo al final. Pista 2: si el paso de avanzar es demasiado grande, el robot puede pasarse del punto donde el sensor detecta el obstáculo; usá pasos pequeños. Pista 3: si el bucle nunca detecta el obstáculo, va a terminar solo al llegar a su límite de repeticiones de seguridad — revisá que la condición del bucle sea realmente la que detecta el obstáculo que tenés adelante.',
      competencias: 'C6 — Repetición condicionada',
      resultados: 'RA6 — Bucles de pre-verificación',
      // Geometry: hayObstaculo() true for x>216 (design's pinned threshold).
      // Reference program "repetir hasta hayObstaculo() { avanzar(100) }"
      // empirically verified via a Node harness (real scheduler run, same
      // method as Slice C1.1's empirical RED-test approach): exits at
      // x=224, y=300, evalsSensor=13, limiteSeguridad=null — comfortably
      // inside the pinned window, matching design's expected pose exactly.
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var x = snapshot.estado.x;
          var y = snapshot.estado.y;
          var m = snapshot.metricas;
          return x >= 217 && x <= 270 && Math.abs(y - 300) <= 40 &&
            m.evalsSensor >= 2 && m.limiteSeguridad === null;
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var m = snapshot.metricas || { evalsSensor: 0, limiteSeguridad: null };
          if (ok) {
            return 'El robot repitió el paso hasta detectar el obstáculo con su sensor y se detuvo en x=' + x + 'px, dentro de la zona esperada.';
          }
          if (m.limiteSeguridad) {
            return 'El robot alcanzó el límite de seguridad del bucle sin que la condición llegara a cumplirse.';
          }
          if (m.evalsSensor < 2) {
            return 'El robot terminó su ejecución habiendo consultado el sensor menos de dos veces: el bucle no llegó a repetirse lo suficiente.';
          }
          if (x < 217) {
            return 'El robot se detuvo demasiado lejos del obstáculo (x=' + x + 'px).';
          }
          return 'El robot no se detuvo dentro de la zona esperada cerca del obstáculo (x=' + x + 'px).';
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
      desafio: 'Programá al robot para que recorra el mapa completo, esquive el primer obstáculo que encuentra en su camino usando el sensor, y llegue bien lejos hacia la derecha del mapa, sin chocar en ningún momento.',
      criterioTexto: 'El robot debe completar el recorrido y quedar detenido en x ≥ 480px, habiendo consultado el sensor al menos una vez durante la ejecución, sin haber chocado y sin haber alcanzado el límite de seguridad de ningún bucle. No existe una única ruta correcta: cualquier combinación de bloques que logre este resultado es válida.',
      pista: 'Pista 1: pensá el desafío como varios pasos más chicos encadenados: acercarte al obstáculo, decidir hacia dónde rodearlo, y retomar el camino hacia la derecha. Pista 2: usá el sensor (con "si / si no" o "repetir hasta") para decidir cuándo girar, en vez de adivinar una distancia fija. Pista 3: después de rodear el obstáculo, acordate de volver a orientar al robot hacia la derecha antes de seguir avanzando, o terminará desviado de su recorrido.',
      competencias: 'C7 — Integración de secuencias, sensores y control de flujo',
      resultados: 'RA7 — Programa autónomo completo',
      // Geometry: obstacle 1 at x300..360,y220..360; collision at x>=280.
      // C2.9 empirical verification (design's flagged open question):
      // a full reference route was run through the REAL scheduler (Node
      // harness, same method as C1.1's empirical approach — not reasoning
      // alone): avanzar(900) -> repetir_hasta(hayObstaculo){avanzar(100)}
      // (reaches x=224) -> si_sino(hayObstaculo){derecha(500)} (turns to
      // face south) -> avanzar(750) (reaches y=390, confirming design's
      // "pass at y≈390" assumption) -> izquierda(500) (re-faces east) ->
      // avanzar(2200). Real result: x=488, y=390, evalsSensor=5,
      // limiteSeguridad=null, run ends idle (no collision). The pinned
      // x>=480 threshold holds exactly as design assumed — NOT adjusted.
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var x = snapshot.estado.x;
          var m = snapshot.metricas;
          return x >= 480 && m.evalsSensor >= 1 && m.limiteSeguridad === null;
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var m = snapshot.metricas || { evalsSensor: 0, limiteSeguridad: null };
          if (ok) {
            return 'El robot completó el recorrido, rodeó el obstáculo usando su sensor y llegó a x=' + x + 'px sin chocar.';
          }
          if (m.limiteSeguridad) {
            return 'El robot alcanzó el límite de seguridad de un bucle sin resolver la condición durante el recorrido.';
          }
          if (!m.evalsSensor) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor durante el recorrido.';
          }
          return 'El robot no completó el recorrido: se detuvo en x=' + x + 'px, sin llegar lo suficientemente lejos.';
        }
      }
    }
  ];
})(typeof window !== 'undefined' ? window : this);
