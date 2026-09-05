/**
 * RS.sensors — single forward ray, ray-vs-AABB, deterministic (no RNG).
 * medirDistancia(): integer simulated cm, clamped to RANGO_MAX (=100, meaning
 * "nothing in range"). hayObstaculo(): medirDistancia() <= 20.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};

  function toRad(deg) { return (deg * Math.PI) / 180; }

  /**
   * Ray-vs-AABB slab test. Returns the intersection distance t (>=0) along
   * the ray, or Infinity if there is no intersection within [0, maxDist].
   */
  function rayAabb(ox, oy, dx, dy, aabb, maxDist) {
    var tmin = 0;
    var tmax = maxDist;

    // X slab
    if (Math.abs(dx) < 1e-9) {
      if (ox < aabb.x || ox > aabb.x + aabb.w) return Infinity;
    } else {
      var tx1 = (aabb.x - ox) / dx;
      var tx2 = (aabb.x + aabb.w - ox) / dx;
      if (tx1 > tx2) { var tmp = tx1; tx1 = tx2; tx2 = tmp; }
      tmin = Math.max(tmin, tx1);
      tmax = Math.min(tmax, tx2);
      if (tmin > tmax) return Infinity;
    }

    // Y slab
    if (Math.abs(dy) < 1e-9) {
      if (oy < aabb.y || oy > aabb.y + aabb.h) return Infinity;
    } else {
      var ty1 = (aabb.y - oy) / dy;
      var ty2 = (aabb.y + aabb.h - oy) / dy;
      if (ty1 > ty2) { var tmp2 = ty1; ty1 = ty2; ty2 = tmp2; }
      tmin = Math.max(tmin, ty1);
      tmax = Math.min(tmax, ty2);
      if (tmin > tmax) return Infinity;
    }

    if (tmin < 0) {
      if (tmax < 0) return Infinity;
      return 0;
    }
    return tmin;
  }

  /**
   * Casts the single forward ray from the robot's pose against world
   * obstacles and world bounds. Returns the nearest hit distance in px,
   * or Infinity if nothing is in range.
   */
  function castRayPx(world, robot, maxDistPx) {
    var ox = robot.x;
    var oy = robot.y;
    var dx = Math.cos(toRad(robot.angulo));
    var dy = Math.sin(toRad(robot.angulo));

    var mejor = Infinity;

    var obstaculos = world.obstaculos;
    for (var i = 0; i < obstaculos.length; i++) {
      var t = rayAabb(ox, oy, dx, dy, obstaculos[i], maxDistPx);
      if (t < mejor) mejor = t;
    }

    // World bounds act as obstacles too.
    var limites = { x: 0, y: 0, w: world.ancho, h: world.alto };
    // Test each boundary as a thin AABB strip so the ray can hit walls.
    var grosor = 2;
    var paredes = [
      { x: -grosor, y: -grosor, w: world.ancho + 2 * grosor, h: grosor }, // arriba
      { x: -grosor, y: world.alto, w: world.ancho + 2 * grosor, h: grosor }, // abajo
      { x: -grosor, y: -grosor, w: grosor, h: world.alto + 2 * grosor }, // izquierda
      { x: world.ancho, y: -grosor, w: grosor, h: world.alto + 2 * grosor } // derecha
    ];
    for (var j = 0; j < paredes.length; j++) {
      var tw = rayAabb(ox, oy, dx, dy, paredes[j], maxDistPx);
      if (tw < mejor) mejor = tw;
    }

    return mejor;
  }

  RS.sensors = {
    /** Returns integer simulated distance in cm, clamped to RANGO_MAX. */
    medirDistancia: function (world, robot) {
      var cfg = RS.config;
      var maxDistPx = cfg.RANGO_MAX * cfg.ESCALA;
      var distPx = castRayPx(world, robot, maxDistPx);
      if (!isFinite(distPx)) return cfg.RANGO_MAX;
      var distCm = Math.floor(distPx / cfg.ESCALA);
      return Math.min(distCm, cfg.RANGO_MAX);
    },

    hayObstaculo: function (world, robot) {
      var cfg = RS.config;
      return RS.sensors.medirDistancia(world, robot) <= cfg.UMBRAL_OBSTACULO;
    },

    _castRayPx: castRayPx // exposed for tests/renderer ray length
  };
})(typeof window !== 'undefined' ? window : this);
