/**
 * RS.lessons.panel — renders the active lesson's sections, in the order
 * mandated by data/Modulo_Aprendizaje.odt section 15, into the 4th grid
 * panel (#leccion). Lesson selection itself now happens on the Home screen
 * (see lessons/home.js); this module only renders whichever single lesson
 * (or the sandbox message) main.js tells it to via mostrarLeccion/mostrarSandbox.
 *
 * Subscribes to the existing RS.runtime.scheduler.onCambioEstado (no new
 * scheduler state added). It tracks the previous state itself and derives
 * the run outcome from the transition:
 *   running -> idle    = completed
 *   running -> error   = collision
 *   running -> stopped = aborted (manual stop)
 * Only lessons with a non-null `criterio` (Lesson 2 onward) are evaluated —
 * Lesson 1 and the sandbox (leccionActiva === null) ignore every run outcome.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.lessons = RS.lessons || {};

  function crearPanel() {
    var contenedor = null;
    var leccionActiva = null;
    var resultadoEl = null;
    var estadoPrevio = null;

    function renderizarSandbox() {
      if (!contenedor) return;
      contenedor.innerHTML = '';

      var h2 = document.createElement('h2');
      h2.className = 'leccion-titulo';
      h2.textContent = 'Sandbox';
      contenedor.appendChild(h2);

      var p = document.createElement('p');
      p.className = 'leccion-sandbox-msg';
      p.textContent = 'Práctica libre: armá cualquier programa y ejecutalo. No hay objetivo ni criterio de éxito en este modo.';
      contenedor.appendChild(p);

      resultadoEl = null;
    }

    function renderizar(leccion) {
      if (!contenedor) return;
      contenedor.innerHTML = '';

      var h2 = document.createElement('h2');
      h2.className = 'leccion-titulo';
      h2.textContent = leccion.titulo;
      contenedor.appendChild(h2);

      RS.lessons.SECCIONES.forEach(function (seccion) {
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

      if (leccion.criterio) {
        resultadoEl = document.createElement('p');
        resultadoEl.className = 'leccion-resultado';
        contenedor.appendChild(resultadoEl);
      } else {
        resultadoEl = null;
        renderizarControlCompletado(leccion);
      }
    }

    // Lecciones sin criterio evaluable (hoy solo la 1: no hay programa que
    // ejecutar) no pueden auto-completarse por resultado de corrida — se
    // marcan a mano para desbloquear la siguiente.
    function renderizarControlCompletado(leccion) {
      if (!contenedor) return;

      if (RS.lessons.progress && RS.lessons.progress.estaCompletada(leccion.id)) {
        var msg = document.createElement('p');
        msg.className = 'leccion-resultado leccion-resultado-ok';
        msg.textContent = 'Lección completada.';
        contenedor.appendChild(msg);
        return;
      }

      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'leccion-completar-btn';
      boton.textContent = 'Marcar como completada';
      boton.addEventListener('click', function () {
        if (RS.lessons.progress) RS.lessons.progress.marcarCompletada(leccion.id);
        contenedor.removeChild(boton);
        renderizarControlCompletado(leccion);
      });
      contenedor.appendChild(boton);
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
      if (resultado.ok && RS.lessons.progress) {
        RS.lessons.progress.marcarCompletada(leccionActiva.id);
      }
    }

    return {
      init: function (el) {
        contenedor = el;
        if (RS.runtime && RS.runtime.scheduler) {
          estadoPrevio = RS.runtime.scheduler.obtenerEstado();
          RS.runtime.scheduler.onCambioEstado(alCambiarEstadoScheduler);
        }
      },
      mostrarLeccion: function (id) {
        var leccion = RS.lessons.CONTENIDO.filter(function (l) { return l.id === id; })[0];
        if (!leccion) return;
        leccionActiva = leccion;
        renderizar(leccion);
      },
      mostrarSandbox: function () {
        leccionActiva = null;
        renderizarSandbox();
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
