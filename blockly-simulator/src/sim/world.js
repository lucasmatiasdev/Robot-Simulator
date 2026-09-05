/**
 * RS.world — the single fixed 800x600 map: static obstacles, world bounds,
 * and AABB collision tests. No scenario selector exists.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  var cfg = RS.config;

  var ROBOT_SIZE = cfg.ROBOT_SIZE; // 40

  // Robot start pose: facing east (angle 0deg), with >=40px free corridor
  // ahead and its start AABB not intersecting any obstacle.
  var POSE_INICIAL = { x: 80, y: 300, angulo: 0 };

  // Static obstacles chosen so the start AABB (60..100, 280..320) does not
  // intersect any of them, and x in [100,140) stays clear (>=40px corridor).
  var OBSTACULOS = [
    { x: 300, y: 220, w: 60, h: 140 },
    { x: 520, y: 80, w: 60, h: 60 },
    { x: 520, y: 420, w: 90, h: 70 },
    { x: 200, y: 470, w: 120, h: 40 },
    { x: 680, y: 220, w: 50, h: 160 }
  ];

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
    for (var i = 0; i < OBSTACULOS.length; i++) {
      if (aabbOverlap(aabb, OBSTACULOS[i])) return OBSTACULOS[i];
    }
    return null;
  }

  RS.world = {
    poseInicial: POSE_INICIAL,
    obstaculos: OBSTACULOS,
    ancho: cfg.WORLD_WIDTH,
    alto: cfg.WORLD_HEIGHT,
    aabbOverlap: aabbOverlap,
    robotAabb: robotAabb,
    colisionEn: colisionEn
  };
})(typeof window !== 'undefined' ? window : this);
