/**
 * RS.ui.feedback — top-bar error/feedback line. On collision, shows a
 * pedagogical message naming the action and obstacle/limit that caused it.
 * Clears on Reiniciar/Ejecutar.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.ui = RS.ui || {};

  function crearFeedback() {
    var contenedor = null;

    function describirObstaculo(obstaculoOLimite) {
      if (obstaculoOLimite === 'limite') {
        return 'el límite del mapa';
      }
      return 'un obstáculo en (' + Math.round(obstaculoOLimite.x) + ', ' + Math.round(obstaculoOLimite.y) + ')';
    }

    return {
      init: function (container) {
        contenedor = container;
      },

      mostrarColision: function (nodo, obstaculoOLimite) {
        if (!contenedor) return;
        var accion = nodo ? nodo.accion : 'una acción';
        var valor = nodo && Object.prototype.hasOwnProperty.call(nodo, 'valor') ? '(' + nodo.valor + ')' : '()';
        var mensaje = '¡Choque! ' + accion + valor + ' chocó contra ' + describirObstaculo(obstaculoOLimite) +
          '. La ejecución se detuvo. Ajustá el programa y probá de nuevo.';
        contenedor.textContent = mensaje;
        contenedor.classList.add('feedback-error');
      },

      limpiar: function () {
        if (!contenedor) return;
        contenedor.textContent = '';
        contenedor.classList.remove('feedback-error');
      }
    };
  }

  RS.ui.feedback = crearFeedback();
})(typeof window !== 'undefined' ? window : this);
