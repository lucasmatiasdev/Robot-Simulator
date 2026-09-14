/**
 * RS.world — the active map (obstacles, start pose, goal) plus AABB
 * collision tests. `cargarMapa(mapa)` swaps the active map (used when
 * entering a lesson or the sandbox); `RS.world.obstaculos`/`poseInicial`/
 * `meta` are getters so every existing caller (robot.js, sensors.js,
 * scheduler.js) keeps reading the live active map with zero changes.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  var cfg = RS.config;

  var ROBOT_SIZE = cfg.ROBOT_SIZE; // 40

  // Default map: robot start pose facing east (angle 0deg) with >=40px free
  // corridor ahead, its start AABB not intersecting any obstacle. Used by
  // Sandbox and as the fallback for any field a lesson's mapa omits.
  var POSE_INICIAL_DEFECTO = { x: 80, y: 300, angulo: 0 };

  var OBSTACULOS_DEFECTO = [
    { x: 300, y: 220, w: 60, h: 140 },
    { x: 520, y: 80, w: 60, h: 60 },
    { x: 520, y: 420, w: 90, h: 70 },
    { x: 200, y: 470, w: 120, h: 40 },
    { x: 680, y: 220, w: 50, h: 160 }
  ];

  var poseInicialActiva = POSE_INICIAL_DEFECTO;
  var obstaculosActivos = OBSTACULOS_DEFECTO;
  var metaActiva = null;

  function aabbOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function robotAabb(x, y) {
    var half = ROBOT_SIZE / 2;
    return { x: x - half, y: y - half, w: ROBOT_SIZE, h: ROBOT_SIZE };
  }

  function fueraDeLimites(aabb) {
    return (
      aabb.x < 0 ||
      aabb.y < 0 ||
      aabb.x + aabb.w > cfg.WORLD_WIDTH ||
      aabb.y + aabb.h > cfg.WORLD_HEIGHT
    );
  }

  /**
   * Returns the colliding obstacle (or the string 'limite') if the robot's
   * AABB at (x, y) collides, otherwise null.
   */
  function colisionEn(x, y) {
    var aabb = robotAabb(x, y);
    if (fueraDeLimites(aabb)) return 'limite';
    for (var i = 0; i < obstaculosActivos.length; i++) {
      if (aabbOverlap(aabb, obstaculosActivos[i])) return obstaculosActivos[i];
    }
    return null;
  }

  /** True if the point (x, y) — the robot's center — falls inside the active goal rect. */
  function enMeta(x, y) {
    if (!metaActiva) return false;
    return x >= metaActiva.x && x <= metaActiva.x + metaActiva.w &&
      y >= metaActiva.y && y <= metaActiva.y + metaActiva.h;
  }

  /**
   * cargarMapa(mapa) — swaps the active obstacles/start pose/goal. Any
   * field left out of `mapa` falls back to the plain default (Sandbox
   * calls this with `{}` to reset to the unmodified default field).
   */
  function cargarMapa(mapa) {
    mapa = mapa || {};
    obstaculosActivos = mapa.obstaculos || OBSTACULOS_DEFECTO;
    poseInicialActiva = mapa.poseInicial || POSE_INICIAL_DEFECTO;
    metaActiva = mapa.meta || null;
  }

  RS.world = {
    get poseInicial() { return poseInicialActiva; },
    get obstaculos() { return obstaculosActivos; },
    get meta() { return metaActiva; },
    ancho: cfg.WORLD_WIDTH,
    alto: cfg.WORLD_HEIGHT,
    aabbOverlap: aabbOverlap,
    robotAabb: robotAabb,
    colisionEn: colisionEn,
    enMeta: enMeta,
    cargarMapa: cargarMapa
  };
})(typeof window !== 'undefined' ? window : this);
