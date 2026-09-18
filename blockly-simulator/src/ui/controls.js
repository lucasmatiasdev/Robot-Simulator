/**
 * RS.ui.controls — Ejecutar / Detener / Reiniciar buttons wired to
 * runtime/scheduler.js. Disables Ejecutar while running; re-enables on
 * stop/error/reset. Snapshots the code panel on Ejecutar and re-syncs it
 * whenever a run stops being 'running' (finished, stopped, or errored).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.ui = RS.ui || {};

  RS.ui.initControls = function (workspace, botones) {
    var btnEjecutar = botones.ejecutar;
    var btnDetener = botones.detener;
    var btnReiniciar = botones.reiniciar;
    var scheduler = RS.runtime.scheduler;

    function actualizarBotones(estado) {
      var enEjecucion = estado === 'running';
      btnEjecutar.disabled = enEjecucion;
      btnDetener.disabled = !enEjecucion;
      btnReiniciar.disabled = enEjecucion;
    }

    scheduler.onCambioEstado(function (estado) {
      actualizarBotones(estado);
      if (estado !== 'running' && RS.ui.codePanel) {
        RS.ui.codePanel.resync();
      }
    });

    btnEjecutar.addEventListener('click', function () {
      var validacion = RS.generator.validarPrograma(workspace);
      if (!validacion.ok) {
        if (RS.ui.feedback) RS.ui.feedback.mostrarError(validacion.mensaje);
        return;
      }
      if (RS.ui.feedback) RS.ui.feedback.limpiar();
      if (RS.ui.codePanel) RS.ui.codePanel.snapshot();
      scheduler.iniciar(workspace);
    });

    btnDetener.addEventListener('click', function () {
      scheduler.detener();
    });

    btnReiniciar.addEventListener('click', function () {
      scheduler.reiniciar();
    });

    actualizarBotones(scheduler.obtenerEstado());
  };
})(typeof window !== 'undefined' ? window : this);
