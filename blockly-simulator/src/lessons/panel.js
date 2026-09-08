/**
 * RS.lessons.panel — renders the active lesson's sections, in the order
 * mandated by data/Modulo_Aprendizaje.odt section 15, into the 4th grid
 * panel (#leccion).
 *
 * Subscribes to the existing RS.runtime.scheduler.onCambioEstado (no new
 * scheduler state added). It tracks the previous state itself and derives
 * the run outcome from the transition:
 *   running -> idle    = completed
 *   running -> error   = collision
 *   running -> stopped = aborted (manual stop)
 * Only lessons with a non-null `criterio` (Lesson 2 onward) are evaluated —
 * Lesson 1 is pure identification and ignores every run outcome.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.lessons = RS.lessons || {};

  var SECCIONES = [
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

  function crearPanel() {
    var contenedor = null;
    var leccionActiva = null;
    var resultadoEl = null;
    var estadoPrevio = null;

    function renderizarNav() {
      var nav = document.createElement('div');
      nav.className = 'leccion-nav';
      RS.lessons.CONTENIDO.forEach(function (leccion) {
        var boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'leccion-nav-btn';
        boton.textContent = 'Lección ' + leccion.id;
        if (leccion.id === leccionActiva.id) boton.classList.add('leccion-nav-btn-activa');
        boton.addEventListener('click', function () {
          seleccionarLeccion(leccion);
        });
        nav.appendChild(boton);
      });
      contenedor.appendChild(nav);
    }

    function seleccionarLeccion(leccion) {
      leccionActiva = leccion;
      renderizar(leccion);
    }

    function renderizar(leccion) {
      if (!contenedor) return;
      contenedor.innerHTML = '';

      renderizarNav();

      var h2 = document.createElement('h2');
      h2.className = 'leccion-titulo';
      h2.textContent = leccion.titulo;
      contenedor.appendChild(h2);

      SECCIONES.forEach(function (seccion) {
        var bloque = document.createElement('section');
        bloque.className = 'leccion-seccion';

        var h3 = document.createElement('h3');
        h3.textContent = seccion.titulo;
        bloque.appendChild(h3);

        var p = document.createElement('p');
        p.textContent = leccion[seccion.clave];
        bloque.appendChild(p);

        contenedor.appendChild(bloque);
      });

      resultadoEl = document.createElement('p');
      resultadoEl.className = 'leccion-resultado';
      contenedor.appendChild(resultadoEl);
    }

    function limpiarResultado() {
      if (!resultadoEl) return;
      resultadoEl.textContent = '';
      resultadoEl.classList.remove('leccion-resultado-ok', 'leccion-resultado-fail');
    }

    function mostrarResultado(resultado) {
      if (!resultadoEl) return;
      resultadoEl.textContent = resultado.observado;
      resultadoEl.classList.remove('leccion-resultado-ok', 'leccion-resultado-fail');
      resultadoEl.classList.add(resultado.ok ? 'leccion-resultado-ok' : 'leccion-resultado-fail');
    }

    /** Maps a running -> {idle|error|stopped} transition to a run snapshot. */
    function construirSnapshot(nuevoEstado) {
      return {
        estado: RS.robot ? RS.robot.estado : null,
        inicial: RS.world ? RS.world.poseInicial : null,
        resultadoRun: nuevoEstado,
        colision: nuevoEstado === 'error' ? true : null,
        metricas: (RS.runtime && RS.runtime.scheduler) ? RS.runtime.scheduler.obtenerMetricas() : { evalsSensor: 0, limiteSeguridad: null }
      };
    }

    function alCambiarEstadoScheduler(nuevoEstado) {
      var eraRunning = estadoPrevio === 'running';
      estadoPrevio = nuevoEstado;

      if (!eraRunning) return; // only react to a run that just ended
      if (!leccionActiva || !leccionActiva.criterio) return; // e.g. Lesson 1: no run-derived check

      var snapshot = construirSnapshot(nuevoEstado);
      var resultado = RS.lessons.check.evaluar(leccionActiva, snapshot);
      mostrarResultado(resultado);
    }

    return {
      init: function (el) {
        contenedor = el;
        leccionActiva = RS.lessons.CONTENIDO[0] || null;
        if (leccionActiva) renderizar(leccionActiva);
        if (RS.runtime && RS.runtime.scheduler) {
          estadoPrevio = RS.runtime.scheduler.obtenerEstado();
          RS.runtime.scheduler.onCambioEstado(alCambiarEstadoScheduler);
        }
      },
      leccionActual: function () {
        return leccionActiva;
      },
      // Test-only hooks: exercise the outcome-mapping/rendering logic without
      // needing a real scheduler run.
      _alCambiarEstadoScheduler: alCambiarEstadoScheduler,
      _limpiarResultado: limpiarResultado
    };
  }

  RS.lessons.panel = crearPanel();
})(typeof window !== 'undefined' ? window : this);
