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
    }
  ];
})(typeof window !== 'undefined' ? window : this);
