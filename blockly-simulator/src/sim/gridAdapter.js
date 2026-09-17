/**
 * RS.gridAdapter — pure conversion between the cell-grid authoring/storage
 * format and the existing pixel map shape consumed by `world.cargarMapa`.
 *
 * A grid map looks like:
 *
 *   {
 *     version: 1, cols: 20, rows: 15,
 *     muros: [{ col, row, colSpan, rowSpan }],   // colSpan/rowSpan default to 1
 *     inicio: { col, row, angulo },
 *     meta:  { col, row, colSpan, rowSpan } | null
 *   }
 *
 * `aPixeles(gridMapa)` converts it into `{ obstaculos, poseInicial, meta }`
 * — the exact shape `world.cargarMapa` already accepts, with zero changes
 * required in `world.js`, `robot.js`, `sensors.js` or `check.js` (design D2).
 *
 * Conversion rule (design D2):
 * - Wall/goal regions emit one rect per region, directly, with no merging:
 *     x = col * CELL_SIZE
 *     y = row * CELL_SIZE
 *     w = (colSpan || 1) * CELL_SIZE
 *     h = (rowSpan || 1) * CELL_SIZE
 * - The start pose uses the CELL CENTER, so the robot's AABB lands exactly
 *   cell-aligned:
 *     x = (col + 0.5) * CELL_SIZE
 *     y = (row + 0.5) * CELL_SIZE
 *     angulo = inicio.angulo
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  var cfg = RS.config;

  /** Converts one grid region `{col,row,colSpan,rowSpan}` into a pixel rect `{x,y,w,h}`. */
  function regionARect(region, cellSize) {
    return {
      x: region.col * cellSize,
      y: region.row * cellSize,
      w: (region.colSpan || 1) * cellSize,
      h: (region.rowSpan || 1) * cellSize
    };
  }

  /**
   * Converts a grid map into the existing pixel map shape
   * `{ obstaculos: [{x,y,w,h}], poseInicial: {x,y,angulo}, meta: {x,y,w,h}|null }`.
   * Deterministic and idempotent: the same input always produces
   * byte-identical output (spec: grid-to-pixel-conversion).
   */
  function aPixeles(gridMapa) {
    var cellSize = (gridMapa && gridMapa.cellSize) || cfg.CELL_SIZE;
    var muros = (gridMapa && gridMapa.muros) || [];

    var obstaculos = muros.map(function (muro) {
      return regionARect(muro, cellSize);
    });

    var poseInicial = null;
    if (gridMapa && gridMapa.inicio) {
      poseInicial = {
        x: (gridMapa.inicio.col + 0.5) * cellSize,
        y: (gridMapa.inicio.row + 0.5) * cellSize,
        angulo: gridMapa.inicio.angulo || 0
      };
    }

    var meta = null;
    if (gridMapa && gridMapa.meta) {
      meta = regionARect(gridMapa.meta, cellSize);
    }

    return {
      obstaculos: obstaculos,
      poseInicial: poseInicial,
      meta: meta
    };
  }

  /**
   * Converts a pixel coordinate into its `{col, row}` grid cell, using
   * `CELL_SIZE` (design D5's hit-testing rule: divide, then floor).
   */
  function celdaDesdePixel(x, y) {
    var cellSize = cfg.CELL_SIZE;
    return {
      col: Math.floor(x / cellSize),
      row: Math.floor(y / cellSize)
    };
  }

  /** True if `region` is a well-formed `{col,row}` (+ optional positive spans). */
  function regionValida(region, cols, rows) {
    if (!region || typeof region.col !== 'number' || typeof region.row !== 'number') return false;
    if (region.col < 0 || region.row < 0) return false;
    if (region.colSpan !== undefined && (typeof region.colSpan !== 'number' || region.colSpan < 1)) return false;
    if (region.rowSpan !== undefined && (typeof region.rowSpan !== 'number' || region.rowSpan < 1)) return false;
    var colSpan = region.colSpan || 1;
    var rowSpan = region.rowSpan || 1;
    if (region.col + colSpan > cols || region.row + rowSpan > rows) return false;
    return true;
  }

  /**
   * Validates a grid map's structural shape. Returns `true` for a
   * well-formed map, `false` for anything malformed (missing/invalid
   * `cols`/`rows`, out-of-bounds regions, missing `inicio`).
   */
  function validar(gridMapa) {
    if (!gridMapa || typeof gridMapa !== 'object') return false;
    if (typeof gridMapa.cols !== 'number' || gridMapa.cols < 1) return false;
    if (typeof gridMapa.rows !== 'number' || gridMapa.rows < 1) return false;
    if (!gridMapa.inicio || !regionValida(gridMapa.inicio, gridMapa.cols, gridMapa.rows)) return false;

    var muros = gridMapa.muros;
    if (muros !== undefined) {
      if (!Array.isArray(muros)) return false;
      for (var i = 0; i < muros.length; i++) {
        if (!regionValida(muros[i], gridMapa.cols, gridMapa.rows)) return false;
      }
    }

    if (gridMapa.meta !== undefined && gridMapa.meta !== null) {
      if (!regionValida(gridMapa.meta, gridMapa.cols, gridMapa.rows)) return false;
    }

    return true;
  }

  RS.gridAdapter = {
    aPixeles: aPixeles,
    celdaDesdePixel: celdaDesdePixel,
    validar: validar
  };
})(typeof window !== 'undefined' ? window : this);
