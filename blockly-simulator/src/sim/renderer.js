/**
 * RS.renderer — Canvas 2D drawing of robot, obstacles, and the sensor ray.
 * Fixed-size backing store (WORLD_WIDTH x WORLD_HEIGHT x devicePixelRatio),
 * scaled via CSS so sensor readings stay deterministic regardless of the
 * screen resolution.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};

  function toRad(deg) { return (deg * Math.PI) / 180; }

  /**
   * rectRedondeado(ctx, x, y, w, h, r) — rounded-rect path via arcTo.
   * Deliberately NOT using ctx.roundRect: unavailable in older classroom
   * browsers and this project has no polyfill step.
   */
  function rectRedondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * dibujarRobot(ctx, robot, opts) — chassis + 2 wheels + heading nose + LED,
   * drawn entirely inside the caller's already-translated/rotated frame.
   * Invariant (do not violate): every painted vertex satisfies
   * |x| <= 20 && |y| <= 20, so the visual never overlaps an obstacle that
   * the 40x40 AABB collision test has not already flagged. Position, angle,
   * AABB and collision logic are untouched by this function.
   */
  function dibujarRobot(ctx, robot, opts) {
    var paleta = (RS.config && RS.config.paleta) || {};
    var error = !!(opts && opts.error);

    // Chassis: rounded rect x -16..18, y -13..13
    rectRedondeado(ctx, -16, -13, 34, 26, 5);
    ctx.fillStyle = error ? (paleta.chasisError || '#c0392b') : (paleta.chasis || '#3477eb');
    ctx.fill();

    // Wheels: rounded rects x -10..10, y -19..-13 and y 13..19
    ctx.fillStyle = paleta.rueda || '#141c24';
    rectRedondeado(ctx, -10, -19, 20, 6, 3);
    ctx.fill();
    rectRedondeado(ctx, -10, 13, 20, 6, 3);
    ctx.fill();

    // Hub stripes: lighter inset stripe on each wheel, x -3..3
    ctx.fillStyle = paleta.ruedaHub || '#2b3948';
    rectRedondeado(ctx, -3, -18, 6, 4, 1);
    ctx.fill();
    rectRedondeado(ctx, -3, 14, 6, 4, 1);
    ctx.fill();

    // Heading "nose" triangle: (18,0) -> (9,-7) -> (9,7)
    ctx.fillStyle = paleta.nariz || '#0f1720';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(9, -7);
    ctx.lineTo(9, 7);
    ctx.closePath();
    ctx.fill();

    // LED dot: circle (6,0) r=4, glows amber when active
    ctx.beginPath();
    ctx.arc(6, 0, 4, 0, Math.PI * 2);
    if (robot.led) {
      ctx.save();
      ctx.shadowColor = paleta.ledOn || '#ffd54a';
      ctx.shadowBlur = 8;
      ctx.fillStyle = paleta.ledOn || '#ffd54a';
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = paleta.ledOff || '#4a5766';
      ctx.fill();
    }
  }

  RS.renderer = {
    /** Sizes the canvas backing store to WORLD size * devicePixelRatio. */
    ajustarCanvas: function (canvas) {
      var cfg = RS.config;
      var dpr = global.devicePixelRatio || 1;
      canvas.width = cfg.WORLD_WIDTH * dpr;
      canvas.height = cfg.WORLD_HEIGHT * dpr;
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    },

    /**
     * dibujar(ctx, opts)
     * opts: { rayoActivo: bool, distanciaRayoPx: number, error: bool }
     */
    dibujar: function (ctx, opts) {
      opts = opts || {};
      var cfg = RS.config;
      var world = RS.world;
      var robot = RS.robot.estado;

      ctx.clearRect(0, 0, cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT);

      // Background
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(0, 0, cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT);

      // World border
      ctx.strokeStyle = '#9aa5b1';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, cfg.WORLD_WIDTH - 2, cfg.WORLD_HEIGHT - 2);

      // Obstacles
      ctx.fillStyle = '#5c6b7a';
      world.obstaculos.forEach(function (o) {
        ctx.fillRect(o.x, o.y, o.w, o.h);
      });

      // Sensor ray (only while a sensor is actively being evaluated)
      if (opts.rayoActivo) {
        var dist = opts.distanciaRayoPx || 0;
        var dx = Math.cos(toRad(robot.angulo));
        var dy = Math.sin(toRad(robot.angulo));
        ctx.strokeStyle = '#e5533d';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(robot.x, robot.y);
        ctx.lineTo(robot.x + dx * dist, robot.y + dy * dist);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Robot — chassis + wheels + nose + LED, all within |x|<=20 && |y|<=20
      // (same 40x40 AABB as before; this only changes what is painted).
      ctx.save();
      ctx.translate(robot.x, robot.y);
      ctx.rotate(toRad(robot.angulo));
      dibujarRobot(ctx, robot, opts);
      ctx.restore();
    }
  };
})(typeof window !== 'undefined' ? window : this);
