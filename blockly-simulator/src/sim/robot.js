/**
 * RS.robot — robot state (x, y, angulo, led) and kinematics.
 * VEL is px/ms (avanzar/retroceder), GIRO is deg/ms (izquierda/derecha),
 * both consumed with the block's ms value unchanged (no /4 divide).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  var cfg = RS.config;

  function crearEstado() {
    var pose = RS.world.poseInicial;
    return {
      x: pose.x,
      y: pose.y,
      angulo: pose.angulo,
      led: 0
    };
  }

  var estado = crearEstado();

  function toRad(deg) { return (deg * Math.PI) / 180; }

  RS.robot = {
    estado: estado,

    reset: function () {
      var fresh = crearEstado();
      estado.x = fresh.x;
      estado.y = fresh.y;
      estado.angulo = fresh.angulo;
      estado.led = fresh.led;
      return estado;
    },

    /** Returns the candidate {x, y} after moving forward by dtMs, without committing it. */
    proponerAvance: function (dtMs) {
      var dist = cfg.VEL * dtMs;
      return {
        x: estado.x + Math.cos(toRad(estado.angulo)) * dist,
        y: estado.y + Math.sin(toRad(estado.angulo)) * dist
      };
    },

    /** Returns the candidate {x, y} after moving backward by dtMs, without committing it. */
    proponerRetroceso: function (dtMs) {
      var dist = cfg.VEL * dtMs;
      return {
        x: estado.x - Math.cos(toRad(estado.angulo)) * dist,
        y: estado.y - Math.sin(toRad(estado.angulo)) * dist
      };
    },

    commitPosicion: function (x, y) {
      estado.x = x;
      estado.y = y;
    },

    /** sentido: +1 = derecha (clockwise), -1 = izquierda (counter-clockwise) */
    girar: function (dtMs, sentido) {
      estado.angulo = (estado.angulo + sentido * cfg.GIRO * dtMs) % 360;
      if (estado.angulo < 0) estado.angulo += 360;
    },

    setLed: function (valor) {
      estado.led = valor ? 1 : 0;
    }
  };
})(typeof window !== 'undefined' ? window : this);
