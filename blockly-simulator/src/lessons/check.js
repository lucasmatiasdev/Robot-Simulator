/**
 * RS.lessons.check.evaluar(leccion, snapshot) — objective success/failure
 * for a lesson's Criterio de éxito, sized to the pilot only (per design's
 * lesson-success-check capability).
 *
 * `snapshot` shape: { estado, inicial, resultadoRun: 'idle'|'error'|'stopped', colision, metricas }
 *   estado    — RS.robot.estado at the moment the run ended (idle/error/stopped)
 *   inicial   — RS.world.poseInicial (for feedback wording)
 *   resultadoRun — the scheduler state the run ended in
 *   colision  — the colliding obstacle/'limite' when resultadoRun === 'error', else null
 *   metricas  — RS.runtime.scheduler.obtenerMetricas(): { evalsSensor, limiteSeguridad }.
 *               `evalsSensor` counts sensor/comparator evaluations during the
 *               run (used by lessons whose criterion requires the student to
 *               actually consult the sensor, not just reach a position).
 *               `limiteSeguridad` stays null until a later slice wires the
 *               `repetir_hasta` safety-bound trip.
 *
 * Returns { ok, observado }. `observado` describes ONLY observed robot
 * behavior — it never names which block to add/change/remove (see
 * ui/feedback.js for the same "describe the behavior, never the fix" rule).
 * A lesson's `criterio` MAY expose an optional `describir(snapshot, ok)`
 * hook returning a lesson-specific `observado` string; when absent, the
 * generic x-position wording below is used (keeps Lessons 1-2 unchanged).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.lessons = RS.lessons || {};

  function describirPosicionFinal(snapshot) {
    var x = snapshot && snapshot.estado ? Math.round(snapshot.estado.x) : null;
    return x === null ? 'una posición desconocida' : ('x = ' + x + 'px');
  }

  function evaluar(leccion, snapshot) {
    if (!leccion || !leccion.criterio || typeof leccion.criterio.evaluar !== 'function') {
      return { ok: false, observado: 'Esta lección no tiene un criterio de éxito evaluable.' };
    }

    if (snapshot && snapshot.resultadoRun === 'error') {
      return {
        ok: false,
        observado: 'El robot chocó y la ejecución se detuvo en ' + describirPosicionFinal(snapshot) + '.'
      };
    }

    if (snapshot && snapshot.resultadoRun === 'stopped') {
      return {
        ok: false,
        observado: 'La ejecución fue detenida manualmente en ' + describirPosicionFinal(snapshot) + '.'
      };
    }

    var ok = !!leccion.criterio.evaluar(snapshot);

    if (typeof leccion.criterio.describir === 'function') {
      var descripcion = leccion.criterio.describir(snapshot, ok);
      if (typeof descripcion === 'string' && descripcion.length > 0) {
        return { ok: ok, observado: descripcion };
      }
    }

    return {
      ok: ok,
      observado: ok
        ? 'El robot terminó en ' + describirPosicionFinal(snapshot) + ', cumpliendo el criterio de éxito.'
        : 'El robot terminó en ' + describirPosicionFinal(snapshot) + ', sin alcanzar el criterio de éxito.'
    };
  }

  RS.lessons.check = {
    evaluar: evaluar
  };
})(typeof window !== 'undefined' ? window : this);
