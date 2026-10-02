/**
 * RS.robot — robot pose (x, y, angulo), persistent motor state and kinematics.
 * VEL is px/ms (both wheels forward), GIRO is deg/ms (wheels opposed); both
 * are applied to the elapsed time by proponerPaso (no /4 divide).
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
      angulo: pose.angulo
    };
  }

  var estado = crearEstado();
  // Persistent differential-drive motor state: each wheel in {-1, 0, 1}.
  var motores = { izq: 0, der: 0 };

  function toRad(deg) { return (deg * Math.PI) / 180; }

  RS.robot = {
    estado: estado,
    motores: motores,

    /** Sets both wheels at once (zero time). Values are clamped to -1/0/1. */
    setMotores: function (izq, der) {
      motores.izq = izq > 0 ? 1 : (izq < 0 ? -1 : 0);
      motores.der = der > 0 ? 1 : (der < 0 ? -1 : 0);
    },

    /**
     * Returns the candidate pose {x, y, angulo} after running the current
     * motor state for ms, without committing it. Linear speed is
     * VEL*(izq+der)/2 along the current heading; the turn sense is
     * (izq-der)/2 (+1 = clockwise) times GIRO.
     */
    proponerPaso: function (ms) {
      var dist = cfg.VEL * ((motores.izq + motores.der) / 2) * ms;
      var sentido = (motores.izq - motores.der) / 2;
      var angulo = (estado.angulo + sentido * cfg.GIRO * ms) % 360;
      if (angulo < 0) angulo += 360;
      return {
        x: estado.x + Math.cos(toRad(estado.angulo)) * dist,
        y: estado.y + Math.sin(toRad(estado.angulo)) * dist,
        angulo: angulo
      };
    },

    /** Commits a pose returned by proponerPaso. */
    commitPaso: function (paso) {
      estado.x = paso.x;
      estado.y = paso.y;
      estado.angulo = paso.angulo;
    },

    reset: function () {
      motores.izq = 0;
      motores.der = 0;
      var fresh = crearEstado();
      estado.x = fresh.x;
      estado.y = fresh.y;
      estado.angulo = fresh.angulo;
      return estado;
    },

    commitPosicion: function (x, y) {
      estado.x = x;
      estado.y = y;
    }
  };
})(typeof window !== 'undefined' ? window : this);
