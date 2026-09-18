/**
 * RS.ui.sensorReadout — always-visible teaching readout of the robot's
 * live sensor values (distance in cm, hayObstaculo boolean). Updated every
 * frame from scheduler.js's loop while a run is 'running'; shows a dash
 * placeholder otherwise (idle/stopped/error, or before any run starts).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.ui = RS.ui || {};

  function crearSensorReadout() {
    var elDistancia = null;
    var elObstaculo = null;

    return {
      init: function (elementoDistancia, elementoObstaculo) {
        elDistancia = elementoDistancia;
        elObstaculo = elementoObstaculo;
      },

      actualizar: function (distanciaCm, hayObstaculo) {
        if (elDistancia) elDistancia.textContent = 'Distancia: ' + distanciaCm + ' cm';
        if (elObstaculo) elObstaculo.textContent = 'Obstáculo: ' + (hayObstaculo ? 'true' : 'false');
      },

      reset: function () {
        if (elDistancia) elDistancia.textContent = 'Distancia: —';
        if (elObstaculo) elObstaculo.textContent = 'Obstáculo: —';
      }
    };
  }

  RS.ui.sensorReadout = crearSensorReadout();
})(typeof window !== 'undefined' ? window : this);
