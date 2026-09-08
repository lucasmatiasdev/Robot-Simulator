/**
 * RS.runtime.scheduler — single requestAnimationFrame loop with delta time.
 * Run states: idle / running / error / stopped. AABB collision is tested
 * before committing each position update; a collision aborts immediately
 * into 'error' state (no further nodes run).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.runtime = RS.runtime || {};

  var FLASH_RAYO_MS = 400;

  function crearScheduler() {
    var estado = 'idle'; // idle | running | error | stopped
    var interpreter = null;
    var currentNode = null;
    var elapsedNode = 0;
    var lastTs = null;
    var ctx = null;
    var rayoFlashHasta = 0;
    var listeners = [];
    var evalsSensor = 0;
    var limiteSeguridad = null;

    function notificar() {
      listeners.forEach(function (fn) { fn(estado); });
    }

    function onCambioEstado(fn) {
      listeners.push(fn);
    }

    function girarSentido(accion) {
      return accion === 'derecha' ? 1 : -1;
    }

    function avanzarSiguienteNodo() {
      currentNode = interpreter.siguienteNodo();
      // Pick up a repetir_hasta safety-cap trip, if one just happened. D4:
      // this is a behavioral-failure signal on the run's metrics, never a
      // scheduler run-state change — the rest of the program (if any) keeps
      // executing and the run still ends in normal 'idle'.
      var trip = interpreter.limiteSeguridad ? interpreter.limiteSeguridad() : null;
      if (trip) limiteSeguridad = trip;
      elapsedNode = 0;
      if (currentNode === null) {
        estado = 'idle';
        if (RS.ui && RS.ui.resaltar) RS.ui.resaltar(null);
        notificar();
        return false;
      }
      if (RS.ui && RS.ui.resaltar) RS.ui.resaltar(currentNode.blockId);
      return true;
    }

    function abortarPorColision(obstaculoOLimite) {
      estado = 'error';
      // Highlight stays on the guilty block (do not clear it).
      if (RS.ui && RS.ui.feedback) {
        RS.ui.feedback.mostrarColision(currentNode, obstaculoOLimite);
      }
      notificar();
    }

    function procesarFrame(dt) {
      if (!currentNode) return;

      var accion = currentNode.accion;

      if (accion === 'detener') {
        avanzarSiguienteNodo();
        return;
      }

      if (accion === 'led') {
        RS.robot.setLed(currentNode.valor);
        avanzarSiguienteNodo();
        return;
      }

      var duracion = currentNode.valor || 0;
      var restante = Math.max(0, duracion - elapsedNode);
      var dtAplicado = Math.min(dt, restante);

      if (accion === 'avanzar' || accion === 'retroceder') {
        // A single rAF frame's dt is not bounded (backgrounded tab, GC pause,
        // slow device can all produce a large dt). Advancing the full
        // dtAplicado in one AABB check can jump clean over a thin obstacle
        // without any intermediate position ever overlapping it (tunneling).
        // Subdivide into MAX_SUBSTEP_MS-sized steps and re-check collision
        // after each one, so detection is independent of real frame timing.
        var maxSubstep = (RS.config && RS.config.MAX_SUBSTEP_MS) || 16;
        var restanteEnFrame = dtAplicado;
        while (restanteEnFrame > 0) {
          var paso = Math.min(maxSubstep, restanteEnFrame);
          var candidato = accion === 'avanzar'
            ? RS.robot.proponerAvance(paso)
            : RS.robot.proponerRetroceso(paso);
          var colision = RS.world.colisionEn(candidato.x, candidato.y);
          if (colision) {
            abortarPorColision(colision);
            return;
          }
          RS.robot.commitPosicion(candidato.x, candidato.y);
          restanteEnFrame -= paso;
        }
        elapsedNode += dtAplicado;
      } else if (accion === 'izquierda' || accion === 'derecha') {
        if (dtAplicado > 0) {
          RS.robot.girar(dtAplicado, girarSentido(accion));
        }
        elapsedNode += dtAplicado;
      } else if (accion === 'esperar') {
        // Accrues elapsed time without moving the robot or testing collision.
        elapsedNode += dtAplicado;
      } else {
        // Unknown action: skip defensively.
        avanzarSiguienteNodo();
        return;
      }

      if (elapsedNode >= duracion) {
        avanzarSiguienteNodo();
      }
    }

    function loop(ts) {
      if (lastTs === null) lastTs = ts;
      var dt = ts - lastTs;
      lastTs = ts;

      if (estado === 'running') {
        procesarFrame(dt);
      }

      if (ctx) {
        var rayoActivo = ts < rayoFlashHasta;
        var cfg = RS.config;
        var distPx = rayoActivo
          ? RS.sensors._castRayPx(RS.world, RS.robot.estado, cfg.RANGO_MAX * cfg.ESCALA)
          : 0;
        RS.renderer.dibujar(ctx, {
          rayoActivo: rayoActivo,
          distanciaRayoPx: isFinite(distPx) ? distPx : cfg.RANGO_MAX * cfg.ESCALA,
          error: estado === 'error'
        });
      }

      global.requestAnimationFrame(loop);
    }

    function onSensorEval() {
      rayoFlashHasta = (lastTs || 0) + FLASH_RAYO_MS;
      evalsSensor += 1;
    }

    return {
      iniciarBucle: function (canvasCtx) {
        ctx = canvasCtx;
        global.requestAnimationFrame(loop);
      },

      iniciar: function (workspace) {
        if (estado === 'running') return;
        var tree = RS.generator.buildProgramTree(workspace);
        this.iniciarConArbol(tree);
      },

      /**
       * Starts a run directly from an already-built program tree, bypassing
       * the workspace/generator step. Used by `iniciar()` above and, since
       * it needs no Blockly workspace, directly by the test harness to
       * reproduce scheduler-level scenarios (tunneling, collision feedback).
       */
      iniciarConArbol: function (tree) {
        if (estado === 'running') return;
        RS.robot.reset();
        if (RS.ui && RS.ui.feedback) RS.ui.feedback.limpiar();
        evalsSensor = 0;
        limiteSeguridad = null;
        interpreter = RS.runtime.interpreter.crear(tree, RS.world, RS.robot.estado, onSensorEval);
        estado = 'running';
        notificar();
        avanzarSiguienteNodo();
      },

      /**
       * obtenerMetricas() — observed-behavior counters used by lesson
       * criteria (see lessons/check.js). `limiteSeguridad` is null unless a
       * `repetir_hasta` loop tripped its MAX_ITER_REPETIR_HASTA safety cap
       * during this run, in which case it is {blockId, iteraciones}.
       */
      obtenerMetricas: function () {
        return { evalsSensor: evalsSensor, limiteSeguridad: limiteSeguridad };
      },

      /**
       * Test-only hook: applies a single simulated frame of `dt` ms directly,
       * without requestAnimationFrame. Lets tests inject an arbitrarily large
       * dt (simulating a backgrounded-tab/slow-device frame spike) to verify
       * collision detection never tunnels through an obstacle.
       */
      _procesarFrame: function (dt) { procesarFrame(dt); },

      detener: function () {
        if (estado !== 'running') return;
        estado = 'stopped';
        if (RS.ui && RS.ui.resaltar) RS.ui.resaltar(null);
        notificar();
      },

      reiniciar: function () {
        estado = 'idle';
        interpreter = null;
        currentNode = null;
        elapsedNode = 0;
        RS.robot.reset();
        if (RS.ui && RS.ui.resaltar) RS.ui.resaltar(null);
        if (RS.ui && RS.ui.feedback) RS.ui.feedback.limpiar();
        notificar();
      },

      obtenerEstado: function () { return estado; },
      onCambioEstado: onCambioEstado
    };
  }

  RS.runtime.scheduler = crearScheduler();
})(typeof window !== 'undefined' ? window : this);
