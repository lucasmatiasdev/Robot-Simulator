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
   * dibujarRobot(ctx, robot, opts) — chassis + 2 wheels + heading nose,
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
  }

  /**
   * dibujarGrilla(ctx) — draws the CELL_SIZE grid overlay used by the
   * sandbox map editor (design D5). Only called from dibujar() when
   * RS.renderer.mostrarGrilla is true; does not touch obstacle/goal/robot
   * drawing or any collision/state logic.
   */
  function dibujarGrilla(ctx) {
    var cfg = RS.config;
    var cell = cfg.CELL_SIZE;

    ctx.save();
    ctx.strokeStyle = 'rgba(90, 110, 130, 0.35)';
    ctx.lineWidth = 1;

    for (var col = 1; col < cfg.GRID_COLS; col++) {
      var x = col * cell + 0.5; // +0.5 keeps 1px lines crisp on the canvas grid
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cfg.WORLD_HEIGHT);
      ctx.stroke();
    }

    for (var row = 1; row < cfg.GRID_ROWS; row++) {
      var y = row * cell + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cfg.WORLD_WIDTH, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  RS.renderer = {
    // Sandbox map editor toggles this on/off (design D5); false everywhere
    // else (lessons never draw the grid overlay).
    mostrarGrilla: false,

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

      // Grid overlay (sandbox map editor only, design D5) — after the
      // background, before obstacles, so obstacles/meta/robot draw on top.
      if (RS.renderer.mostrarGrilla) dibujarGrilla(ctx);

      // Obstacles
      ctx.fillStyle = '#5c6b7a';
      world.obstaculos.forEach(function (o) {
        ctx.fillRect(o.x, o.y, o.w, o.h);
      });

      // Goal marker (dashed, success-green — distinct from the gray
      // obstacles) plus a small flag at its center so it reads as an
      // "arrival point" rather than just another rectangle.
      if (world.meta) {
        ctx.save();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(world.meta.x, world.meta.y, world.meta.w, world.meta.h);
        ctx.fillStyle = 'rgba(22, 163, 74, 0.12)';
        ctx.fillRect(world.meta.x, world.meta.y, world.meta.w, world.meta.h);
        ctx.setLineDash([]);

        var cx = world.meta.x + world.meta.w / 2;
        var cy = world.meta.y + world.meta.h / 2;
        ctx.strokeStyle = '#12833c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx, cy + 14);
        ctx.stroke();
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 16, cy - 9);
        ctx.lineTo(cx, cy - 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

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

      // Robot — chassis + wheels + nose, all within |x|<=20 && |y|<=20
      // (same 40x40 AABB as before; this only changes what is painted).
      ctx.save();
      ctx.translate(robot.x, robot.y);
      ctx.rotate(toRad(robot.angulo));
      dibujarRobot(ctx, robot, opts);
      ctx.restore();
    }
  };
})(typeof window !== 'undefined' ? window : this);
