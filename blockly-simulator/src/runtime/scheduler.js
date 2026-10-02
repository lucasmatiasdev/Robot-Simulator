/**
 * RS.runtime.scheduler — single requestAnimationFrame loop with delta time.
 * Run states: idle / running / error / stopped. Owns time and physics: motor
 * leaves set RS.robot.motores in zero time; only `esperar` (Delay) and loop
 * `tick` leaves consume sim time, during which the current motor state is
 * integrated. AABB collision is tested before committing each position
 * update; a collision aborts immediately into 'error' state. A program that
 * ends with motors on keeps coasting (state stays 'running') until it
 * collides or, if only rotating, COAST_GIRO_MAX_MS elapses -> 'error'.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.runtime = RS.runtime || {};

  var FLASH_RAYO_MS = 400;

  function crearScheduler() {
    var estado = 'idle'; // idle | running | error | stopped
    var interpreter = null;
    var actual = null; // leaf in progress (esperar / tick) across frames
    var restanteActual = 0;
    var ultimoMotor = null; // last block that turned the motors on
    var finPrograma = false;
    var coastGiroMs = 0;
    var tiempoSim = 0;
    var ultimoResaltado = null;
    var lastTs = null;
    var ctx = null;
    var rayoFlashHasta = 0;
    var listeners = [];
    var evalsSensor = 0;
    var cambiosVariable = 0;

    function notificar() {
      listeners.forEach(function (fn) { fn(estado); });
    }

    function onCambioEstado(fn) {
      listeners.push(fn);
    }

    function resaltar(blockId) {
      if (blockId === ultimoResaltado) return;
      ultimoResaltado = blockId;
      if (RS.ui && RS.ui.resaltar) RS.ui.resaltar(blockId);
    }

    function motoresEncendidos() {
      var m = RS.robot.motores;
      return m.izq !== 0 || m.der !== 0;
    }

    function abortarPorColision(obstaculoOLimite) {
      estado = 'error';
      // Highlight stays on the block that turned the motors on.
      resaltar(ultimoMotor ? ultimoMotor.blockId : null);
      if (RS.ui && RS.ui.feedback) {
        RS.ui.feedback.mostrarColision(ultimoMotor, obstaculoOLimite, { finPrograma: finPrograma });
      }
      notificar();
    }

    /**
     * Runs the current motor state for `ms` of sim time, in
     * MAX_SUBSTEP_MS-sized collision-checked steps (a frame's dt is not
     * bounded, so one big step could tunnel through a thin obstacle).
     * Collision is tested only when the position changes (rotation stays
     * untested). Returns false when the run aborted.
     */
    function integrar(ms) {
      var maxSubstep = (RS.config && RS.config.MAX_SUBSTEP_MS) || 16;
      var restante = ms;
      while (restante > 0) {
        var paso = Math.min(maxSubstep, restante);
        tiempoSim += paso;
        restante -= paso;
        if (!motoresEncendidos()) continue;
        var est = RS.robot.estado;
        var candidato = RS.robot.proponerPaso(paso);
        var movio = candidato.x !== est.x || candidato.y !== est.y;
        if (movio) {
          var colision = RS.world.colisionEn(candidato.x, candidato.y);
          if (colision) {
            abortarPorColision(colision);
            return false;
          }
        }
        RS.robot.commitPaso(candidato);
        if (finPrograma && !movio) {
          coastGiroMs += paso;
          if (coastGiroMs >= RS.config.COAST_GIRO_MAX_MS) {
            abortarPorColision('giro');
            return false;
          }
        }
      }
      return true;
    }

    function procesarFrame(dt) {
      if (estado !== 'running' || !interpreter) return;

      var cfg = RS.config;
      var presupuesto = cfg.MAX_NODOS_POR_FRAME;
      var restanteDt = dt;
      var resaltado; // one highlight update per frame

      while (estado === 'running') {
        if (finPrograma) {
          // Coasting: motors keep running under the final state.
          resaltado = ultimoMotor ? ultimoMotor.blockId : null;
          integrar(restanteDt);
          break;
        }
        if (presupuesto-- <= 0) {
          // Yield guard: drop the remaining dt so the sim slows down
          // rather than advancing without program progress.
          break;
        }
        if (!actual) {
          var nodo = interpreter.siguienteNodo();
          if (interpreter.cambiosVariable) cambiosVariable = interpreter.cambiosVariable();
          if (nodo === null) {
            if (!motoresEncendidos()) {
              estado = 'idle';
              resaltar(null);
              notificar();
              return;
            }
            finPrograma = true;
            continue;
          }
          if (nodo.tipo === 'accion' && nodo.accion === 'detener') {
            RS.robot.setMotores(0, 0);
            continue;
          }
          if (nodo.tipo === 'accion' && cfg.MOTORES[nodo.accion]) {
            var m = cfg.MOTORES[nodo.accion];
            RS.robot.setMotores(m.izq, m.der);
            ultimoMotor = nodo;
            continue;
          }
          if (nodo.tipo === 'tick' || nodo.accion === 'esperar') {
            actual = nodo;
            restanteActual = Math.max(0, nodo.valor || 0);
          }
          // Unknown leaf: skipped defensively.
          if (!actual) continue;
        }

        if (actual.tipo !== 'tick') resaltado = actual.blockId;
        if (restanteActual > 0 && restanteDt <= 0) break;
        var consumo = Math.min(restanteDt, restanteActual);
        restanteDt -= consumo;
        restanteActual -= consumo;
        if (!integrar(consumo)) return;
        if (restanteActual > 0) break;
        actual = null;
      }

      if (estado === 'running' && resaltado !== undefined) resaltar(resaltado);
    }

    function loop(ts) {
      if (lastTs === null) lastTs = ts;
      var dt = ts - lastTs;
      lastTs = ts;

      if (estado === 'running') {
        procesarFrame(dt);
      }

      if (RS.ui && RS.ui.sensorReadout) {
        if (estado === 'running') {
          RS.ui.sensorReadout.actualizar(
            RS.sensors.medirDistancia(RS.world, RS.robot.estado),
            RS.sensors.hayObstaculo(RS.world, RS.robot.estado)
          );
        } else {
          RS.ui.sensorReadout.reset();
        }
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
        cambiosVariable = 0;
        actual = null;
        restanteActual = 0;
        ultimoMotor = null;
        finPrograma = false;
        coastGiroMs = 0;
        tiempoSim = 0;
        ultimoResaltado = null;
        interpreter = RS.runtime.interpreter.crear(tree, RS.world, RS.robot.estado, onSensorEval);
        estado = 'running';
        notificar();
      },

      /**
       * obtenerMetricas() — observed-behavior counters used by lesson
       * criteria (see lessons/check.js). `limiteSeguridad` is deprecated and
       * always null (loops are uncapped; kept so criterio code still reads
       * it). `cambiosVariable` counts executed asignar/cambiar nodes.
       * `finConMotores` is true when the program ended with motors on.
       */
      obtenerMetricas: function () {
        return {
          evalsSensor: evalsSensor,
          limiteSeguridad: null,
          cambiosVariable: cambiosVariable,
          finConMotores: finPrograma
        };
      },

      /**
       * Test-only hook: applies a single simulated frame of `dt` ms directly,
       * without requestAnimationFrame. Lets tests inject an arbitrarily large
       * dt (simulating a backgrounded-tab/slow-device frame spike) to verify
       * collision detection never tunnels through an obstacle.
       */
      _procesarFrame: function (dt) { procesarFrame(dt); },

      /** Test-only hook: total sim ms integrated since the run started. */
      _tiempoSim: function () { return tiempoSim; },

      detener: function () {
        if (estado !== 'running') return;
        estado = 'stopped';
        RS.robot.setMotores(0, 0);
        resaltar(null);
        notificar();
      },

      reiniciar: function () {
        estado = 'idle';
        interpreter = null;
        actual = null;
        restanteActual = 0;
        ultimoMotor = null;
        finPrograma = false;
        coastGiroMs = 0;
        RS.robot.reset();
        ultimoResaltado = null;
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
