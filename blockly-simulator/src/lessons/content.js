/**
 * RS.lessons.CONTENIDO — lesson data as a plain JS array (no JSON, no fetch:
 * the app is opened over file:// and fetch() would be CORS-blocked).
 *
 * Each record follows the mandatory 13-section structure from
 * data/Modulo_Aprendizaje.odt section 15 ("Formato de salida para generar
 * una lección"): objetivo, concepto, ejemplo, bloques, comoFunciona, prueba,
 * modificacion, desafio, criterioTexto, pista, competencias, resultados,
 * nivel.
 *
 * `criterio` is null only for lessons with no run-derived success check.
 * Every lesson (1-7) now has a real, run-checkable `criterio` — Lesson 1's
 * identification-focused text is paired with a pre-loaded program (see
 * main.js's irALeccion) so it still has a goal to run toward. Lesson 2's
 * `criterio.evaluar(snapshot)` checks `dentroDeMeta(...)` (see check.js for
 * the snapshot shape).
 *
 * Lessons 3-4 (this slice) introduce no new block types: Lesson 3
 * (Secuencias) uses only movement blocks; Lesson 4 (Sensores) uses only the
 * pre-existing `rs_si_obstaculo`/`rs_hay_obstaculo`/`rs_comparar` sensor
 * blocks. A lesson's `criterio` may also expose an optional
 * `describir(snapshot, ok)` hook for lesson-specific behavioral feedback
 * text (see check.js).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.lessons = RS.lessons || {};

  // Shared field order for full-lesson rendering (home.js's current-lesson
  // screen and panel.js's in-workspace side panel both read from here, so
  // the two stay in sync).
  RS.lessons.SECCIONES = [
    { clave: 'objetivo', titulo: 'Objetivo' },
    { clave: 'concepto', titulo: 'Concepto' },
    { clave: 'ejemplo', titulo: 'Ejemplo' },
    { clave: 'bloques', titulo: 'Bloques utilizados' },
    { clave: 'comoFunciona', titulo: '¿Cómo funciona?' },
    { clave: 'prueba', titulo: 'Prueba en el simulador' },
    { clave: 'modificacion', titulo: 'Modificación' },
    { clave: 'desafio', titulo: 'Desafío' },
    { clave: 'criterioTexto', titulo: 'Criterio de éxito' },
    { clave: 'pista', titulo: 'Pista' },
    { clave: 'competencias', titulo: 'Competencias' },
    { clave: 'resultados', titulo: 'Resultados de aprendizaje' },
    { clave: 'nivel', titulo: 'Nivel de dificultad' }
  ];

  // v3 (cell-grid redesign): every lesson map is now authored as a grid
  // spec (`{col,row,colSpan,rowSpan}` regions, per design D1/D2) and
  // converted to the pixel shape `world.cargarMapa` already accepts via
  // `RS.gridAdapter.aPixeles(...)` — zero changes required in `world.js`,
  // `robot.js`, `sensors.js` or `check.js` (design D6). `CELL_SIZE=40`,
  // `GRID_COLS=20`, `GRID_ROWS=15` (src/config.js). Start cells (cell CENTER,
  // design D2): lessons 1-4 and 6 start at `{col:1,row:7}` = pixel `(60,300)`,
  // lesson 5 at `{col:1,row:3}` = `(60,140)`, lesson 7 at `{col:2,row:2}` =
  // `(100,100)`. Every `avanzar(ms)` value in the lesson text is derived from
  // the map geometry as `round(px / 0.12)` (`VEL = 0.12` px/ms) and aimed at
  // the middle of its goal window; `tests/test-lesson-solutions.node.js`
  // re-verifies one reference solution per lesson against the real scheduler
  // (Node harness driving `RS.runtime.scheduler` via `iniciarConArbol` /
  // `_procesarFrame`), so a map edit that breaks a lesson fails that test.

  // Single source for Lesson 1's pre-loaded program: main.js's iniciar() reads
  // this for the workspace preload and the `ejemplo` text below quotes it, so
  // the two can never drift. Valid range for this map: 2167-3667 ms.
  RS.lessons.MS_PRECARGA_LECCION_1 = 3000;
  var MS_PRECARGA_LECCION_1 = RS.lessons.MS_PRECARGA_LECCION_1;

  // Lesson 1 keeps its pure-identification teaching goal (no block-building
  // required) but now has a real, run-checkable goal too: a small program is
  // pre-loaded into the workspace by main.js's irALeccion(1) (INICIO ->
  // avanzar(MS_PRECARGA_LECCION_1) -> detener()), so the student presses
  // Ejecutar and watches the robot reach the marked meta while reading the
  // identification content. The map is a closed room: the meta covers
  // cols8-12,rows5-9 (x320-520,y200-400), the whole end zone, and col13 (x520)
  // is the back wall. At 3000 ms the robot stops at x=420 — mid-window, with
  // 100px of margin on either side. Overshooting past ~3667 ms (x>500)
  // collides with the back wall, so the wall is genuinely load-bearing.
   var GRID_LECCION_1 = {
    version: 1, cols: 20, rows: 15,
    muros: [
      { col: 0, row: 3 },
      { col: 1, row: 3 },
      { col: 2, row: 3 },
      { col: 0, row: 4 },
      { col: 1, row: 4 },
      { col: 2, row: 4 },
      { col: 3, row: 4 },
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 6, row: 4 },
      { col: 7, row: 4 },
      { col: 8, row: 4 },
      { col: 9, row: 4 },
      { col: 10, row: 4 },
      { col: 11, row: 4 },
      { col: 12, row: 4 },
      { col: 12, row: 10 },
      { col: 11, row: 10 },
      { col: 10, row: 10 },
      { col: 9, row: 10 },
      { col: 8, row: 10 },
      { col: 7, row: 10 },
      { col: 6, row: 10 },
      { col: 5, row: 10 },
      { col: 4, row: 10 },
      { col: 3, row: 10 },
      { col: 2, row: 10 },
      { col: 1, row: 10 },
      { col: 0, row: 10 },
      { col: 0, row: 11 },
      { col: 0, row: 12 },
      { col: 0, row: 13 },
      { col: 0, row: 14 },
      { col: 1, row: 14 },
      { col: 1, row: 13 },
      { col: 1, row: 12 },
      { col: 1, row: 11 },
      { col: 3, row: 11 },
      { col: 3, row: 12 },
      { col: 3, row: 13 },
      { col: 2, row: 13 },
      { col: 2, row: 14 },
      { col: 2, row: 12 },
      { col: 2, row: 11 },
      { col: 4, row: 13 },
      { col: 5, row: 13 },
      { col: 6, row: 13 },
      { col: 3, row: 14 },
      { col: 4, row: 14 },
      { col: 5, row: 14 },
      { col: 7, row: 13 },
      { col: 8, row: 13 },
      { col: 8, row: 14 },
      { col: 9, row: 14 },
      { col: 10, row: 14 },
      { col: 11, row: 14 },
      { col: 12, row: 14 },
      { col: 7, row: 14 },
      { col: 6, row: 14 },
      { col: 9, row: 13 },
      { col: 10, row: 13 },
      { col: 11, row: 13 },
      { col: 12, row: 13 },
      { col: 13, row: 13 },
      { col: 13, row: 14 },
      { col: 14, row: 14 },
      { col: 15, row: 14 },
      { col: 15, row: 13 },
      { col: 14, row: 13 },
      { col: 16, row: 14 },
      { col: 17, row: 14 },
      { col: 18, row: 14 },
      { col: 19, row: 14 },
      { col: 19, row: 13 },
      { col: 18, row: 13 },
      { col: 18, row: 12 },
      { col: 17, row: 12 },
      { col: 17, row: 13 },
      { col: 16, row: 13 },
      { col: 19, row: 12 },
      { col: 19, row: 11 },
      { col: 18, row: 11 },
      { col: 17, row: 11 },
      { col: 18, row: 10 },
      { col: 18, row: 9 },
      { col: 17, row: 9 },
      { col: 16, row: 10 },
      { col: 16, row: 11 },
      { col: 16, row: 12 },
      { col: 17, row: 8 },
      { col: 16, row: 9 },
      { col: 15, row: 10 },
      { col: 15, row: 11 },
      { col: 15, row: 12 },
      { col: 17, row: 10 },
      { col: 16, row: 8 },
      { col: 15, row: 9 },
      { col: 14, row: 10 },
      { col: 14, row: 11 },
      { col: 13, row: 11 },
      { col: 13, row: 12 },
      { col: 12, row: 12 },
      { col: 14, row: 12 },
      { col: 12, row: 11 },
      { col: 11, row: 11 },
      { col: 11, row: 12 },
      { col: 10, row: 12 },
      { col: 10, row: 11 },
      { col: 9, row: 12 },
      { col: 8, row: 12 },
      { col: 7, row: 12 },
      { col: 6, row: 12 },
      { col: 8, row: 11 },
      { col: 9, row: 11 },
      { col: 5, row: 12 },
      { col: 4, row: 12 },
      { col: 6, row: 11 },
      { col: 7, row: 11 },
      { col: 5, row: 11 },
      { col: 4, row: 11 },
      { col: 13, row: 10 },
      { col: 13, row: 9 },
      { col: 13, row: 8 },
      { col: 13, row: 7 },
      { col: 14, row: 6 },
      { col: 13, row: 6 },
      { col: 13, row: 5 },
      { col: 14, row: 5 },
      { col: 14, row: 4 },
      { col: 14, row: 3 },
      { col: 14, row: 2 },
      { col: 15, row: 3 },
      { col: 15, row: 4 },
      { col: 16, row: 5 },
      { col: 16, row: 6 },
      { col: 16, row: 7 },
      { col: 15, row: 7 },
      { col: 15, row: 5 },
      { col: 15, row: 2 },
      { col: 15, row: 1 },
      { col: 15, row: 0 },
      { col: 16, row: 0 },
      { col: 15, row: 8 },
      { col: 14, row: 7 },
      { col: 14, row: 8 },
      { col: 14, row: 9 },
      { col: 15, row: 6 },
      { col: 16, row: 4 },
      { col: 16, row: 3 },
      { col: 16, row: 2 },
      { col: 18, row: 8 },
      { col: 18, row: 7 },
      { col: 18, row: 6 },
      { col: 18, row: 5 },
      { col: 18, row: 4 },
      { col: 18, row: 3 },
      { col: 17, row: 4 },
      { col: 17, row: 5 },
      { col: 16, row: 1 },
      { col: 17, row: 0 },
      { col: 17, row: 1 },
      { col: 17, row: 2 },
      { col: 17, row: 3 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 0 },
      { col: 2, row: 0 },
      { col: 4, row: 0 },
      { col: 5, row: 0 },
      { col: 6, row: 0 },
      { col: 7, row: 0 },
      { col: 8, row: 0 },
      { col: 6, row: 1 },
      { col: 5, row: 1 },
      { col: 4, row: 1 },
      { col: 3, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
      { col: 3, row: 0 },
      { col: 3, row: 2 },
      { col: 3, row: 3 },
      { col: 4, row: 3 },
      { col: 5, row: 3 },
      { col: 6, row: 3 },
      { col: 7, row: 3 },
      { col: 8, row: 3 },
      { col: 4, row: 2 },
      { col: 5, row: 2 },
      { col: 6, row: 2 },
      { col: 7, row: 2 },
      { col: 8, row: 2 },
      { col: 9, row: 2 },
      { col: 10, row: 2 },
      { col: 7, row: 1 },
      { col: 10, row: 3 },
      { col: 11, row: 3 },
      { col: 9, row: 3 },
      { col: 12, row: 3 },
      { col: 13, row: 3 },
      { col: 13, row: 4 },
      { col: 12, row: 2 },
      { col: 11, row: 1 },
      { col: 10, row: 1 },
      { col: 9, row: 1 },
      { col: 13, row: 2 },
      { col: 11, row: 2 },
      { col: 14, row: 1 },
      { col: 12, row: 1 },
      { col: 8, row: 1 },
      { col: 9, row: 0 },
      { col: 10, row: 0 },
      { col: 11, row: 0 },
      { col: 13, row: 0 },
      { col: 14, row: 0 },
      { col: 12, row: 0 },
      { col: 13, row: 1 },
      { col: 18, row: 1 },
      { col: 18, row: 0 },
      { col: 19, row: 0 },
      { col: 19, row: 1 },
      { col: 19, row: 2 },
      { col: 18, row: 2 },
      { col: 19, row: 3 },
      { col: 19, row: 4 },
      { col: 19, row: 5 },
      { col: 19, row: 6 },
      { col: 19, row: 7 },
      { col: 19, row: 8 },
      { col: 19, row: 9 },
      { col: 19, row: 10 },
      { col: 17, row: 7 },
      { col: 17, row: 6 }
    ],
    inicio: { col: 1, row: 7, angulo: 0 },
    meta: { col: 8, row: 5, colSpan: 5, rowSpan: 5 }
  };
  var MAPA_SIN_DESAFIO = RS.gridAdapter.aPixeles(GRID_LECCION_1);

  // Every criterio.evaluar below tests goal-arrival via RS.world.enMeta-
  // equivalent point-in-rect math against ITS OWN `meta` (closed over here,
  // not read from the live RS.world — this keeps criterio.evaluar a pure
  // function of `snapshot` alone, exactly like every other check in this
  // file, and lets tests call it directly with synthetic snapshots without
  // first loading the lesson's map into RS.world). `meta` now comes from
  // `RS.gridAdapter.aPixeles(...)`, but it is still a plain `{x,y,w,h}`
  // pixel rect, so this helper — and every existing call site — is
  // unchanged (design D6).
  function dentroDeMeta(meta, x, y) {
    return x >= meta.x && x <= meta.x + meta.w && y >= meta.y && y <= meta.y + meta.h;
  }

  // True when `y` is within 60px of the lesson's start row. Reads the start
  // pose from the snapshot (not a hard-coded row) so describir() feedback
  // stays correct on maps whose start is not y=300 (e.g. Lesson 5, y=140).
  // Without `snapshot.inicial` it returns false (falls through to the
  // generic message instead of throwing).
  function mismaAlturaQueInicio(snapshot, y) {
    return !!snapshot.inicial && Math.abs(y - snapshot.inicial.y) < 60;
  }

  // Each lesson's grid map is hoisted into a named `GRID_LECCION_N`
  // constant, converted once via `RS.gridAdapter.aPixeles` into the pixel
  // map used both by `mapa` and by `criterio.evaluar` — a single source of
  // truth for the goal rect, so the visual marker and the actual pass/fail
  // zone can never silently drift apart. Every obstacle is a real,
  // collidable AABB; decorative pieces (dressing that never blocks the
  // intended path) are called out per lesson, every other obstacle is
  // load-bearing.
   var GRID_LECCION_2 = {
    version: 1, cols: 20, rows: 15,
    muros: [
      { col: 0, row: 3 },
      { col: 1, row: 3 },
      { col: 2, row: 3 },
      { col: 0, row: 4 },
      { col: 1, row: 4 },
      { col: 2, row: 4 },
      { col: 3, row: 4 },
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 6, row: 4 },
      { col: 7, row: 4 },
      { col: 8, row: 4 },
      { col: 9, row: 4 },
      { col: 10, row: 4 },
      { col: 11, row: 4 },
      { col: 12, row: 4 },
      { col: 12, row: 10 },
      { col: 11, row: 10 },
      { col: 10, row: 10 },
      { col: 9, row: 10 },
      { col: 8, row: 10 },
      { col: 7, row: 10 },
      { col: 6, row: 10 },
      { col: 5, row: 10 },
      { col: 4, row: 10 },
      { col: 3, row: 10 },
      { col: 2, row: 10 },
      { col: 1, row: 10 },
      { col: 0, row: 10 },
      { col: 0, row: 11 },
      { col: 0, row: 12 },
      { col: 0, row: 13 },
      { col: 0, row: 14 },
      { col: 1, row: 14 },
      { col: 1, row: 13 },
      { col: 1, row: 12 },
      { col: 1, row: 11 },
      { col: 3, row: 11 },
      { col: 3, row: 12 },
      { col: 3, row: 13 },
      { col: 2, row: 13 },
      { col: 2, row: 14 },
      { col: 2, row: 12 },
      { col: 2, row: 11 },
      { col: 4, row: 13 },
      { col: 5, row: 13 },
      { col: 6, row: 13 },
      { col: 3, row: 14 },
      { col: 4, row: 14 },
      { col: 5, row: 14 },
      { col: 7, row: 13 },
      { col: 8, row: 13 },
      { col: 8, row: 14 },
      { col: 9, row: 14 },
      { col: 10, row: 14 },
      { col: 11, row: 14 },
      { col: 12, row: 14 },
      { col: 7, row: 14 },
      { col: 6, row: 14 },
      { col: 9, row: 13 },
      { col: 10, row: 13 },
      { col: 11, row: 13 },
      { col: 12, row: 13 },
      { col: 13, row: 13 },
      { col: 13, row: 14 },
      { col: 14, row: 14 },
      { col: 15, row: 14 },
      { col: 15, row: 13 },
      { col: 14, row: 13 },
      { col: 16, row: 14 },
      { col: 17, row: 14 },
      { col: 18, row: 14 },
      { col: 19, row: 14 },
      { col: 19, row: 13 },
      { col: 18, row: 13 },
      { col: 18, row: 12 },
      { col: 17, row: 12 },
      { col: 17, row: 13 },
      { col: 16, row: 13 },
      { col: 19, row: 12 },
      { col: 19, row: 11 },
      { col: 18, row: 11 },
      { col: 17, row: 11 },
      { col: 18, row: 10 },
      { col: 18, row: 9 },
      { col: 17, row: 9 },
      { col: 16, row: 10 },
      { col: 16, row: 11 },
      { col: 16, row: 12 },
      { col: 17, row: 8 },
      { col: 16, row: 9 },
      { col: 15, row: 10 },
      { col: 15, row: 11 },
      { col: 15, row: 12 },
      { col: 17, row: 10 },
      { col: 16, row: 8 },
      { col: 15, row: 9 },
      { col: 14, row: 10 },
      { col: 14, row: 11 },
      { col: 13, row: 11 },
      { col: 13, row: 12 },
      { col: 12, row: 12 },
      { col: 14, row: 12 },
      { col: 12, row: 11 },
      { col: 11, row: 11 },
      { col: 11, row: 12 },
      { col: 10, row: 12 },
      { col: 10, row: 11 },
      { col: 9, row: 12 },
      { col: 8, row: 12 },
      { col: 7, row: 12 },
      { col: 6, row: 12 },
      { col: 8, row: 11 },
      { col: 9, row: 11 },
      { col: 5, row: 12 },
      { col: 4, row: 12 },
      { col: 6, row: 11 },
      { col: 7, row: 11 },
      { col: 5, row: 11 },
      { col: 4, row: 11 },
      { col: 13, row: 10 },
      { col: 13, row: 9 },
      { col: 13, row: 8 },
      { col: 13, row: 7 },
      { col: 14, row: 6 },
      { col: 13, row: 6 },
      { col: 13, row: 5 },
      { col: 14, row: 5 },
      { col: 14, row: 4 },
      { col: 14, row: 3 },
      { col: 14, row: 2 },
      { col: 15, row: 3 },
      { col: 15, row: 4 },
      { col: 16, row: 5 },
      { col: 16, row: 6 },
      { col: 16, row: 7 },
      { col: 15, row: 7 },
      { col: 15, row: 5 },
      { col: 15, row: 2 },
      { col: 15, row: 1 },
      { col: 15, row: 0 },
      { col: 16, row: 0 },
      { col: 15, row: 8 },
      { col: 14, row: 7 },
      { col: 14, row: 8 },
      { col: 14, row: 9 },
      { col: 15, row: 6 },
      { col: 16, row: 4 },
      { col: 16, row: 3 },
      { col: 16, row: 2 },
      { col: 18, row: 8 },
      { col: 18, row: 7 },
      { col: 18, row: 6 },
      { col: 18, row: 5 },
      { col: 18, row: 4 },
      { col: 18, row: 3 },
      { col: 17, row: 4 },
      { col: 17, row: 5 },
      { col: 16, row: 1 },
      { col: 17, row: 0 },
      { col: 17, row: 1 },
      { col: 17, row: 2 },
      { col: 17, row: 3 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 0 },
      { col: 2, row: 0 },
      { col: 4, row: 0 },
      { col: 5, row: 0 },
      { col: 6, row: 0 },
      { col: 7, row: 0 },
      { col: 8, row: 0 },
      { col: 6, row: 1 },
      { col: 5, row: 1 },
      { col: 4, row: 1 },
      { col: 3, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
      { col: 3, row: 0 },
      { col: 3, row: 2 },
      { col: 3, row: 3 },
      { col: 4, row: 3 },
      { col: 5, row: 3 },
      { col: 6, row: 3 },
      { col: 7, row: 3 },
      { col: 8, row: 3 },
      { col: 4, row: 2 },
      { col: 5, row: 2 },
      { col: 6, row: 2 },
      { col: 7, row: 2 },
      { col: 8, row: 2 },
      { col: 9, row: 2 },
      { col: 10, row: 2 },
      { col: 7, row: 1 },
      { col: 10, row: 3 },
      { col: 11, row: 3 },
      { col: 9, row: 3 },
      { col: 12, row: 3 },
      { col: 13, row: 3 },
      { col: 13, row: 4 },
      { col: 12, row: 2 },
      { col: 11, row: 1 },
      { col: 10, row: 1 },
      { col: 9, row: 1 },
      { col: 13, row: 2 },
      { col: 11, row: 2 },
      { col: 14, row: 1 },
      { col: 12, row: 1 },
      { col: 8, row: 1 },
      { col: 9, row: 0 },
      { col: 10, row: 0 },
      { col: 11, row: 0 },
      { col: 13, row: 0 },
      { col: 14, row: 0 },
      { col: 12, row: 0 },
      { col: 13, row: 1 },
      { col: 18, row: 1 },
      { col: 18, row: 0 },
      { col: 19, row: 0 },
      { col: 19, row: 1 },
      { col: 19, row: 2 },
      { col: 18, row: 2 },
      { col: 19, row: 3 },
      { col: 19, row: 4 },
      { col: 19, row: 5 },
      { col: 19, row: 6 },
      { col: 19, row: 7 },
      { col: 19, row: 8 },
      { col: 19, row: 9 },
      { col: 19, row: 10 },
      { col: 17, row: 7 },
      { col: 17, row: 6 }
    ],
    inicio: { col: 1, row: 7, angulo: 0 },
    meta: { col: 8, row: 5, colSpan: 5, rowSpan: 5 }
  };
  var MAPA_LECCION_2 = RS.gridAdapter.aPixeles(GRID_LECCION_2);
  // NOTE: the comment inside the literal below predates the map redesign; the
  // current route needs 4 turns (south, east, north, east) around 2 piers.
  var GRID_LECCION_3 = {
    version: 1, cols: 20, rows: 15,
    muros: [
      { col: 0, row: 0, colSpan: 20, rowSpan: 5 },
      { col: 0, row: 10, colSpan: 20, rowSpan: 5 },
      { col: 7, row: 5, colSpan: 2, rowSpan: 3 },
      { col: 13, row: 7, colSpan: 2, rowSpan: 3 },
      { col: 15, row: 7 },
      { col: 16, row: 7 },
      { col: 17, row: 7 },
      { col: 18, row: 7 },
      { col: 19, row: 7 },
      { col: 19, row: 8 },
      { col: 19, row: 9 },
      { col: 18, row: 9 },
      { col: 18, row: 8 },
      { col: 17, row: 8 },
      { col: 17, row: 9 },
      { col: 16, row: 9 },
      { col: 15, row: 9 },
      { col: 16, row: 8 },
      { col: 15, row: 8 }
    ],
    inicio: { col: 1, row: 6, angulo: 0 },
    meta: { col: 17, row: 5, colSpan: 3, rowSpan: 2 }
  };
  var MAPA_LECCION_3 = RS.gridAdapter.aPixeles(GRID_LECCION_3);
  var GRID_LECCION_4 = {
    version: 1, cols: 20, rows: 15,
    muros: [
      { col: 0, row: 0, colSpan: 20, rowSpan: 5 },
      { col: 0, row: 10, colSpan: 20, rowSpan: 5 },
      { col: 18, row: 5 },
      { col: 17, row: 5 },
      { col: 17, row: 6 },
      { col: 17, row: 7 },
      { col: 17, row: 8 },
      { col: 17, row: 9 },
      { col: 18, row: 9 },
      { col: 18, row: 8 },
      { col: 18, row: 7 },
      { col: 18, row: 6 },
      { col: 19, row: 6 },
      { col: 19, row: 7 },
      { col: 19, row: 8 },
      { col: 19, row: 9 },
      { col: 19, row: 5 }
    ],
    inicio: { col: 1, row: 7, angulo: 0 },
    meta: { col: 13, row: 6, colSpan: 3, rowSpan: 3 }
  };
  var MAPA_LECCION_4 = RS.gridAdapter.aPixeles(GRID_LECCION_4);
  // Start cell (1,3) = pixel (60,140): the robot begins in the upper corridor
  // and must turn south into the shaft above the meta.
  var GRID_LECCION_5 = {
    version: 1, cols: 20, rows: 15,
    muros: [
      { col: 0, row: 0, colSpan: 20 },
      { col: 1, row: 1 },
      { col: 3, row: 1, colSpan: 17 },
      { col: 16, row: 2, colSpan: 4 },
      { col: 14, row: 3 },
      { col: 16, row: 3, colSpan: 4 },
      { col: 14, row: 4, colSpan: 6 },
      { col: 0, row: 10, colSpan: 2 },
      { col: 0, row: 11 },
      { col: 0, row: 12, colSpan: 6, rowSpan: 3 },
      { col: 16, row: 10, colSpan: 4 },
      { col: 17, row: 11, colSpan: 3 },
      { col: 16, row: 12, colSpan: 4 },
      { col: 14, row: 13, colSpan: 6 },
      { col: 14, row: 14, colSpan: 6 },
      { col: 1, row: 11 },
      { col: 2, row: 11 },
      { col: 3, row: 11 },
      { col: 4, row: 11 },
      { col: 3, row: 10 },
      { col: 2, row: 10 },
      { col: 4, row: 10 },
      { col: 5, row: 10 },
      { col: 5, row: 11 },
      { col: 7, row: 14 },
      { col: 7, row: 13 },
      { col: 7, row: 12 },
      { col: 7, row: 11 },
      { col: 7, row: 10 },
      { col: 6, row: 10 },
      { col: 6, row: 11 },
      { col: 6, row: 12 },
      { col: 6, row: 13 },
      { col: 6, row: 14 },
      { col: 14, row: 10 },
      { col: 15, row: 10 },
      { col: 16, row: 11 },
      { col: 15, row: 12 },
      { col: 15, row: 11 },
      { col: 14, row: 12 },
      { col: 14, row: 11 },
      { col: 2, row: 1 },
      { col: 0, row: 1 },
      { col: 0, row: 5 },
      { col: 1, row: 5 },
      { col: 2, row: 5 },
      { col: 3, row: 5 },
      { col: 4, row: 5 },
      { col: 5, row: 5 },
      { col: 6, row: 5 },
      { col: 7, row: 5 },
      { col: 8, row: 5 },
      { col: 9, row: 5 },
      { col: 9, row: 6 },
      { col: 9, row: 7 },
      { col: 9, row: 8 },
      { col: 9, row: 9 },
      { col: 9, row: 10 },
      { col: 9, row: 11 },
      { col: 9, row: 12 },
      { col: 9, row: 13 },
      { col: 9, row: 14 },
      { col: 8, row: 14 },
      { col: 8, row: 13 },
      { col: 8, row: 12 },
      { col: 8, row: 11 },
      { col: 8, row: 10 },
      { col: 8, row: 9 },
      { col: 8, row: 8 },
      { col: 8, row: 7 },
      { col: 8, row: 6 },
      { col: 7, row: 6 },
      { col: 6, row: 6 },
      { col: 5, row: 6 },
      { col: 4, row: 6 },
      { col: 3, row: 6 },
      { col: 2, row: 6 },
      { col: 1, row: 6 },
      { col: 0, row: 6 },
      { col: 0, row: 7 },
      { col: 0, row: 8 },
      { col: 0, row: 9 },
      { col: 1, row: 8 },
      { col: 1, row: 7 },
      { col: 2, row: 7 },
      { col: 2, row: 8 },
      { col: 2, row: 9 },
      { col: 1, row: 9 },
      { col: 3, row: 7 },
      { col: 3, row: 8 },
      { col: 3, row: 9 },
      { col: 4, row: 8 },
      { col: 4, row: 7 },
      { col: 5, row: 7 },
      { col: 4, row: 9 },
      { col: 5, row: 9 },
      { col: 5, row: 8 },
      { col: 6, row: 8 },
      { col: 6, row: 7 },
      { col: 7, row: 7 },
      { col: 7, row: 8 },
      { col: 6, row: 9 },
      { col: 7, row: 9 },
      { col: 14, row: 9 },
      { col: 14, row: 8 },
      { col: 14, row: 7 },
      { col: 14, row: 6 },
      { col: 14, row: 5 },
      { col: 14, row: 2 },
      { col: 15, row: 2 },
      { col: 15, row: 3 },
      { col: 15, row: 5 },
      { col: 15, row: 6 },
      { col: 15, row: 7 },
      { col: 15, row: 8 },
      { col: 16, row: 8 },
      { col: 16, row: 9 },
      { col: 17, row: 7 },
      { col: 17, row: 6 },
      { col: 17, row: 5 },
      { col: 16, row: 5 },
      { col: 16, row: 6 },
      { col: 16, row: 7 },
      { col: 15, row: 9 },
      { col: 17, row: 8 },
      { col: 18, row: 7 },
      { col: 17, row: 9 },
      { col: 18, row: 9 },
      { col: 18, row: 8 },
      { col: 18, row: 6 },
      { col: 18, row: 5 },
      { col: 19, row: 9 },
      { col: 19, row: 8 },
      { col: 19, row: 7 },
      { col: 19, row: 6 },
      { col: 19, row: 5 },
      { col: 13, row: 12 },
      { col: 12, row: 12 },
      { col: 11, row: 12 },
      { col: 10, row: 12 },
      { col: 10, row: 13 },
      { col: 11, row: 13 },
      { col: 12, row: 13 },
      { col: 13, row: 13 },
      { col: 10, row: 14 },
      { col: 11, row: 14 },
      { col: 12, row: 14 },
      { col: 13, row: 14 }
    ],
    inicio: { col: 1, row: 3, angulo: 0 },
    meta: { col: 10, row: 10, colSpan: 4, rowSpan: 2 }
  };
  var MAPA_LECCION_5 = RS.gridAdapter.aPixeles(GRID_LECCION_5);
  var GRID_LECCION_6 = {
    version: 1, cols: 20, rows: 15,
    muros: [
      { col: 0, row: 0, colSpan: 20, rowSpan: 5 },
      { col: 0, row: 10, colSpan: 20, rowSpan: 5 },
      { col: 19, row: 5 },
      { col: 19, row: 6 },
      { col: 19, row: 7 },
      { col: 18, row: 8 },
      { col: 18, row: 9 },
      { col: 18, row: 7 },
      { col: 18, row: 6 },
      { col: 18, row: 5 },
      { col: 17, row: 5 },
      { col: 17, row: 6 },
      { col: 17, row: 7 },
      { col: 17, row: 8 },
      { col: 19, row: 9 },
      { col: 19, row: 8 },
      { col: 17, row: 9 }
    ],
    inicio: { col: 1, row: 7, angulo: 0 },
    meta: { col: 13, row: 6, colSpan: 3, rowSpan: 3 }
  };
  var MAPA_LECCION_6 = RS.gridAdapter.aPixeles(GRID_LECCION_6);
  // Start cell (2,2) = pixel (100,100): a single-route ring (upper corridor,
  // right channel down, bottom corridor, left channel up, inner corridor)
  // ending in the meta pocket, which is entered only from the inner corridor.
  var GRID_LECCION_7 = {
    version: 1, cols: 20, rows: 15,
    muros: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
      { col: 4, row: 0 },
      { col: 5, row: 0 },
      { col: 6, row: 0 },
      { col: 7, row: 0 },
      { col: 10, row: 0 },
      { col: 9, row: 0 },
      { col: 8, row: 0 },
      { col: 11, row: 0 },
      { col: 12, row: 0 },
      { col: 16, row: 0 },
      { col: 15, row: 0 },
      { col: 14, row: 0 },
      { col: 13, row: 0 },
      { col: 17, row: 0 },
      { col: 18, row: 0 },
      { col: 19, row: 0 },
      { col: 19, row: 1 },
      { col: 19, row: 2 },
      { col: 19, row: 3 },
      { col: 19, row: 4 },
      { col: 19, row: 5 },
      { col: 19, row: 6 },
      { col: 19, row: 7 },
      { col: 19, row: 8 },
      { col: 19, row: 9 },
      { col: 19, row: 10 },
      { col: 19, row: 11 },
      { col: 19, row: 12 },
      { col: 19, row: 13 },
      { col: 19, row: 14 },
      { col: 18, row: 14 },
      { col: 17, row: 14 },
      { col: 16, row: 14 },
      { col: 15, row: 14 },
      { col: 14, row: 14 },
      { col: 13, row: 14 },
      { col: 12, row: 14 },
      { col: 11, row: 14 },
      { col: 10, row: 14 },
      { col: 9, row: 14 },
      { col: 8, row: 14 },
      { col: 7, row: 14 },
      { col: 6, row: 14 },
      { col: 5, row: 14 },
      { col: 4, row: 14 },
      { col: 3, row: 14 },
      { col: 2, row: 14 },
      { col: 1, row: 14 },
      { col: 0, row: 14 },
      { col: 0, row: 13 },
      { col: 0, row: 12 },
      { col: 0, row: 11 },
      { col: 0, row: 10 },
      { col: 0, row: 9 },
      { col: 0, row: 8 },
      { col: 0, row: 7 },
      { col: 0, row: 6 },
      { col: 0, row: 5 },
      { col: 0, row: 4 },
      { col: 1, row: 4 },
      { col: 2, row: 4 },
      { col: 3, row: 4 },
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 6, row: 4 },
      { col: 7, row: 4 },
      { col: 8, row: 4 },
      { col: 9, row: 4 },
      { col: 10, row: 4 },
      { col: 11, row: 4 },
      { col: 12, row: 4 },
      { col: 13, row: 4 },
      { col: 14, row: 4 },
      { col: 15, row: 4 },
      { col: 15, row: 5 },
      { col: 15, row: 6 },
      { col: 15, row: 7 },
      { col: 15, row: 8 },
      { col: 15, row: 9 },
      { col: 15, row: 10 },
      { col: 14, row: 10 },
      { col: 13, row: 10 },
      { col: 12, row: 10 },
      { col: 11, row: 10 },
      { col: 10, row: 10 },
      { col: 9, row: 10 },
      { col: 8, row: 10 },
      { col: 7, row: 10 },
      { col: 6, row: 10 },
      { col: 5, row: 10 },
      { col: 4, row: 10 },
      { col: 4, row: 9 },
      { col: 4, row: 8 },
      { col: 5, row: 8 },
      { col: 6, row: 8 },
      { col: 7, row: 8 },
      { col: 8, row: 8 },
      { col: 9, row: 8 },
      { col: 10, row: 8 },
      { col: 11, row: 8 },
      { col: 11, row: 9 },
      { col: 10, row: 9 },
      { col: 9, row: 9 },
      { col: 8, row: 9 },
      { col: 7, row: 9 },
      { col: 6, row: 9 },
      { col: 5, row: 9 },
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 3 }
    ],
    inicio: { col: 2, row: 2, angulo: 0 },
    meta: { col: 12, row: 8, colSpan: 3, rowSpan: 2 }
  };
  var MAPA_LECCION_7 = RS.gridAdapter.aPixeles(GRID_LECCION_7);

  RS.lessons.CONTENIDO = [
    {
      id: 1,
      nivel: 'Nivel 1 — Reconocimiento',
      titulo: '¿Qué es un robot?',
      objetivo: 'En esta lección aprenderás a identificar los componentes básicos de un robot móvil y a comprender su función dentro del simulador.',
      concepto: 'Un robot está compuesto por un sensor (percibe el entorno), un actuador (produce movimiento o acción), un controlador (decide qué hacer) y un entorno (el espacio donde el robot se mueve). En el simulador, estos cuatro elementos ya están presentes: el sensor de distancia, las ruedas como actuador, el programa de bloques como controlador y el mapa como entorno.',
      ejemplo: 'Ya hay un programa armado esperándote: INICIO → avanzar(' + MS_PRECARGA_LECCION_1 + ') → detener(). No necesitas construir nada todavía — mira el panel Simulador y presiona Ejecutar.',
      bloques: 'avanzar(ms), detener() — ya están armados como referencia; el objetivo de esta lección es identificarlos, no construirlos.',
      comoFunciona: 'El chasis azul es el cuerpo del robot. Las ruedas (actuador) permiten el movimiento. El sensor frontal mide la distancia a los obstáculos. El programa que armas con bloques cumple el rol de controlador: decide qué instrucción ejecutar.',
      prueba: 'Presiona Ejecutar y observa cómo el robot avanza y se detiene dentro de la zona de meta marcada en el panel Simulador. Mientras corre, relaciona lo que ves con los roles de la sección «¿Cómo funciona?»: el controlador (el programa) ordena avanzar, el actuador (las ruedas) produce el movimiento y el sensor sigue midiendo distancia aunque el programa no lo consulte todavía.',
      modificacion: 'No aplica en esta lección: no hay programa que modificar todavía.',
      desafio: 'Presiona Ejecutar y confirma que el robot llega y queda detenido dentro de la zona de meta marcada. Después, señala sobre el panel Simulador dónde ubicarías el sensor, el actuador y el controlador del robot.',
      criterioTexto: 'El robot debe llegar y quedar detenido dentro de la zona de meta marcada en el mapa, ejecutando el programa ya armado.',
      pista: 'Pista 1: recuerda que un robot siempre combina percepción (sensor), decisión (controlador) y acción (actuador).',
      competencias: 'C1 — Fundamentos de robótica',
      resultados: 'RA1 — Identificación',
      grid: GRID_LECCION_1,
      mapa: MAPA_SIN_DESAFIO,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado) return false;
          return dentroDeMeta(MAPA_SIN_DESAFIO.meta, snapshot.estado.x, snapshot.estado.y);
        }
      }
    },
    {
      id: 2,
      nivel: 'Nivel 2 — Aplicación guiada',
      titulo: 'Movimiento',
      objetivo: 'En esta lección aprenderás a utilizar los bloques de movimiento para hacer que el robot avance y se detenga.',
      concepto: 'El robot se mueve cuando su controlador ejecuta instrucciones de movimiento: avanzar, retroceder y girar. Cada instrucción tiene una duración (en milisegundos) que determina cuánto se desplaza o gira el robot antes de pasar a la siguiente instrucción.',
      ejemplo: 'INICIO → avanzar(2500) → detener()',
      bloques: 'avanzar(ms), detener()',
      comoFunciona: 'El bloque avanzar(2500) mueve el robot hacia adelante durante 2500 milisegundos. El bloque detener() lo detiene de inmediato al terminar. Juntos forman una secuencia: primero se ejecuta avanzar y, solo cuando termina, se ejecuta detener.',
      prueba: 'Arma la secuencia avanzar(2500) seguida de detener() en el editor y presiona Ejecutar. Observa cómo se desplaza el robot en el panel Simulador.',
      modificacion: 'Cambia el valor de avanzar(2500) por un número distinto y vuelve a ejecutar. Observa cómo cambia la distancia recorrida.',
      desafio: 'Haz que el robot avance durante un tiempo determinado y quede detenido dentro de la zona marcada al fondo de la sala, sin chocar contra la pared del fondo.',
      criterioTexto: 'El robot debe avanzar y quedar detenido dentro de la zona de meta marcada en el mapa (la zona al fondo de la sala), sin colisionar contra la pared del fondo.',
      pista: 'Pista 1: recuerda que avanzar(ms) mueve el robot un tiempo determinado; a mayor ms, mayor distancia. Pista 2: si el tiempo es muy corto, el robot no llega a la zona marcada; si es muy largo, choca contra la pared del fondo.',
      competencias: 'C2 — Movimiento y control',
      resultados: 'RA2 — Movimiento',
      // Geometry/verification: see MAPA_LECCION_2 above.
      grid: GRID_LECCION_2,
      mapa: MAPA_LECCION_2,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado) return false;
          return dentroDeMeta(MAPA_LECCION_2.meta, snapshot.estado.x, snapshot.estado.y);
        }
      }
    },
    {
      id: 3,
      nivel: 'Nivel 2 — Aplicación guiada',
      titulo: 'Secuencias',
      objetivo: 'En esta lección aprenderás que las acciones de un robot pueden ejecutarse en un orden determinado, y que ese orden cambia el resultado final del recorrido.',
      concepto: 'Un programa de robot es una secuencia: una lista de instrucciones que se ejecutan una después de la otra, en el orden en que fueron escritas. El robot no "decide" el orden por sí solo — recorre las instrucciones exactamente como el controlador las armó. Cambiar el orden de dos instrucciones cambia el camino que recorre el robot, aunque las instrucciones sean las mismas.',
      ejemplo: 'INICIO → avanzar(1250) → derecha(500) → avanzar(500)',
      bloques: 'avanzar(ms), derecha(ms), retroceder(ms), izquierda(ms), detener()',
      comoFunciona: 'Cada bloque se ejecuta completo antes de pasar al siguiente: primero avanzar(1250) desplaza al robot hacia adelante, luego derecha(500) lo gira sobre su lugar hacia el sur, y solo después avanzar(500) lo desplaza en la nueva dirección. Si se invirtiera el orden del giro y el segundo avance, el robot terminaría en un punto distinto.',
      prueba: 'Arma la secuencia avanzar(1250) → derecha(500) → avanzar(500) en el editor y presiona Ejecutar. Observa el camino en forma de "L" que recorre el robot en el panel Simulador: avanza hacia el este, gira y baja hacia el sur sin tocar el primer pilar.',
      modificacion: 'Cambia el orden de los dos últimos bloques (avanzar(500) antes de derecha(500)) y vuelve a ejecutar. Observa que ahora el robot choca contra el primer pilar: las instrucciones son las mismas, pero el camino final es distinto.',
      desafio: 'Arma una secuencia que rodee los dos pilares del pasillo — girando en el momento justo cada vez — y llegue a la zona de meta marcada al este. Vas a necesitar 4 giros.',
      criterioTexto: 'El robot debe girar a tiempo para esquivar el primer pilar, volver a girar para rodear el segundo, y terminar detenido dentro de la zona de meta marcada al este, sin colisionar en ningún tramo. El tramo hacia el norte es angosto (unos 20 px de margen), así que su duración debe ser precisa.',
      pista: 'Pista 1: recuerda que las instrucciones se ejecutan en el orden exacto en que las colocaste, una tras otra. Pista 2: si avanzas demasiado antes de girar, vas a chocar contra el primer pilar — el giro tiene que ocurrir antes de llegar a él. Pista 3: en total necesitas 4 giros: baja para pasar por debajo del primer pilar, vuelve a orientarte al este, sube para pasar por encima del segundo pilar y vuelve a orientarte al este. Pista 4: usa izquierda(ms) para los giros hacia la izquierda. El tramo hacia el norte es el más exigente: su margen es de unos 170 ms, así que ajusta esa duración con cuidado y prueba valores cercanos.',
      competencias: 'C3 — Secuenciación de instrucciones',
      resultados: 'RA3 — Secuencias',
      // Geometry/verification: see MAPA_LECCION_3 above.
      grid: GRID_LECCION_3,
      mapa: MAPA_LECCION_3,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado) return false;
          return dentroDeMeta(MAPA_LECCION_3.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var y = Math.round(snapshot.estado.y);
          if (ok) {
            return 'El robot rodeó los pilares y terminó en x=' + x + 'px, y=' + y + 'px, dentro de la zona de meta.';
          }
          if (mismaAlturaQueInicio(snapshot, y)) {
            return 'El robot terminó casi a la misma altura que al inicio (y=' + y + 'px): la secuencia no llegó a girar a tiempo.';
          }
          return 'El robot terminó en x=' + x + 'px, y=' + y + 'px, fuera de la zona de meta.';
        }
      }
    },
    {
      id: 4,
      nivel: 'Nivel 2 — Aplicación guiada',
      titulo: 'Sensores',
      objetivo: 'En esta lección aprenderás a usar la lectura del sensor de distancia del robot para tomar una decisión: detenerse al aproximarse a un obstáculo.',
      concepto: 'Un sensor es un componente que percibe una condición del entorno — en este caso, la distancia hasta el obstáculo más cercano frente al robot. Esa lectura permite que el controlador tome una decisión en lugar de seguir siempre la misma secuencia fija: por ejemplo, "si la distancia es menor a 20, entonces detener el robot".',
      ejemplo: 'INICIO → avanzar(4650) → si hayObstaculo() { detener() }',
      bloques: 'avanzar(ms), si (hayObstaculo) hacer, comparar (medirDistancia < número), detener()',
      comoFunciona: 'El bloque "si hayObstaculo()" consulta el sensor de distancia en el instante en que el robot llega a esa instrucción. Si detecta un obstáculo cerca, ejecuta lo que está dentro del bloque (por ejemplo, detener()); si no detecta nada, continúa de largo con la siguiente instrucción. La decisión depende de la lectura real del sensor en ese momento, no de un valor fijo escrito de antemano.',
      prueba: 'Arma avanzar(4650) seguido de un bloque "si hayObstaculo() { detener() }" y presiona Ejecutar. Observa que el robot se detiene solo, sin que hayas fijado a mano en qué punto exacto frenar.',
      modificacion: 'Reemplaza el sensor "hayObstaculo()" por un bloque comparar que evalúe medirDistancia() contra un número (por ejemplo, medirDistancia() < 20) y vuelve a ejecutar. Observa que la decisión de detenerse sigue dependiendo de una lectura del sensor, no de un valor de posición fijo.',
      desafio: 'Programa al robot para que avance por el pasillo y quede detenido dentro de la zona de meta marcada, cerca del muro del fondo, usando la lectura del sensor para decidir cuándo frenar — no una distancia fija adivinada de antemano.',
      criterioTexto: 'El robot debe quedar detenido dentro de la zona de meta marcada, cerca del muro del fondo, habiendo consultado el sensor al menos una vez durante la ejecución.',
      pista: 'Pista 1: recuerda que el sensor solo se consulta cuando el programa llega a un bloque que lo usa (por ejemplo, "si hayObstaculo()"). Pista 2: si el robot no llega a ejecutar ningún bloque de sensor, nunca tomará una decisión basada en lo que percibe. Pista 3: coloca el bloque de decisión con el sensor después del avance, para que la lectura ocurra mientras el robot ya se está acercando al muro. Pista 4: el sensor solo detecta el muro cuando el robot ya está cerca de él; si el avance es demasiado corto, la lectura todavía no lo detecta y el robot queda antes de la meta.',
      competencias: 'C4 — Sensores y decisión',
      resultados: 'RA4 — Sensores',
      // Geometry/verification: see MAPA_LECCION_4 above.
      grid: GRID_LECCION_4,
      mapa: MAPA_LECCION_4,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          if (snapshot.metricas.evalsSensor < 1) return false;
          return dentroDeMeta(MAPA_LECCION_4.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var evals = snapshot.metricas ? snapshot.metricas.evalsSensor : 0;
          if (ok) {
            return 'El robot consultó su sensor y se detuvo dentro de la zona de meta, cerca del muro del fondo (x=' + x + 'px).';
          }
          if (!evals) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor de distancia.';
          }
          return 'El robot terminó en x=' + x + 'px, fuera de la zona de meta.';
        }
      }
    },
    {
      id: 5,
      nivel: 'Nivel 2 — Aplicación guiada',
      titulo: 'Condicionales',
      objetivo: 'En esta lección aprenderás a hacer que el robot elija entre dos acciones distintas según se cumpla o no una condición.',
      concepto: 'Un condicional "si / si no" le permite al controlador elegir siempre una de dos acciones posibles: si la condición es verdadera, ejecuta la primera rama; si es falsa, ejecuta la segunda. A diferencia del bloque "si" (Lección 4), que solo agrega una acción cuando la condición se cumple y no hace nada en caso contrario, "si / si no" siempre ejecuta exactamente una de las dos ramas, nunca ambas ni ninguna.',
      ejemplo: 'INICIO → avanzar(3750) → si hayObstaculo() { derecha(500) } si no { } → avanzar(2400)',
      bloques: 'avanzar(ms), derecha(ms), si (hayObstaculo) / si no, comparar (medirDistancia < número)',
      comoFunciona: 'El bloque "si / si no" consulta la condición una sola vez, en el instante en que el robot llega a esa instrucción. Si la condición es verdadera, ejecuta únicamente lo que está en la primera rama; si es falsa, ejecuta únicamente lo que está en la rama "si no". Después de resolver esa decisión, el programa continúa con la siguiente instrucción de la secuencia, sin volver a consultar la condición.',
      prueba: 'Arma la secuencia avanzar(3750) → "si hayObstaculo() { derecha(500) } si no { }" → avanzar(2400) y presiona Ejecutar. Observa que el robot gira al detectar la pared del fondo del pasillo y luego continúa avanzando hacia el sur.',
      modificacion: 'Cambia el primer bloque por avanzar(1000) y ejecuta de nuevo: el robot todavía está lejos de la pared del fondo, así que la condición es falsa y se ejecuta la rama "si no". Observa que el robot no gira y termina lejos de la zona de meta.',
      desafio: 'Haz que el robot avance por el pasillo, detecte con el sensor la pared del fondo, gire y llegue a la zona de meta marcada al sur.',
      criterioTexto: 'El robot debe haber consultado su sensor al menos una vez durante la ejecución, y terminar detenido dentro de la zona de meta marcada al sur del punto de giro, sin colisionar.',
      pista: 'Pista 1: recuerda que "si / si no" siempre ejecuta una de las dos ramas, nunca ninguna ni ambas — piensa qué debería pasar en cada caso. Pista 2: para que el robot llegue a la zona de meta necesitas que, tras la decisión, siga habiendo un movimiento hacia adelante en la nueva dirección. Pista 3: revisa que la rama que gira esté conectada a la condición que detecta la pared del fondo, y que después de la decisión el robot siga avanzando. Pista 4: el sensor solo detecta la pared cuando el robot ya está cerca de ella; si el primer avance es demasiado corto, la condición es falsa y el robot no gira.',
      competencias: 'C5 — Condicionales',
      resultados: 'RA5 — Decisión de dos ramas',
      // Geometry/verification: see MAPA_LECCION_5 above.
      grid: GRID_LECCION_5,
      mapa: MAPA_LECCION_5,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          if (snapshot.metricas.evalsSensor < 1) return false;
          return dentroDeMeta(MAPA_LECCION_5.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var y = Math.round(snapshot.estado.y);
          var evals = snapshot.metricas ? snapshot.metricas.evalsSensor : 0;
          if (ok) {
            return 'El robot consultó su sensor, tomó la decisión correcta y terminó en x=' + x + 'px, y=' + y + 'px, dentro de la zona de meta.';
          }
          if (!evals) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor, por lo que nunca tomó una decisión basada en lo que percibe.';
          }
          if (mismaAlturaQueInicio(snapshot, y)) {
            return 'El robot consultó su sensor pero terminó casi a la misma altura que al inicio (y=' + y + 'px): la rama tomada no cambió su dirección de avance.';
          }
          return 'El robot terminó en x=' + x + 'px, y=' + y + 'px, fuera de la zona de meta.';
        }
      }
    },
    {
      id: 6,
      nivel: 'Nivel 3 — Autonomía',
      titulo: 'Repetición',
      objetivo: 'En esta lección aprenderás a hacer que el robot repita una acción de forma automática hasta que se cumpla una condición, en lugar de calcular a mano cuántas veces repetirla.',
      concepto: 'El bloque "repetir hasta" es un bucle de pre-verificación: antes de cada pasada, consulta la condición; si ya es verdadera, no ejecuta el cuerpo ni una sola vez. Si es falsa, ejecuta el cuerpo una vez y vuelve a consultar la condición, repitiendo este ciclo hasta que la condición se cumpla. A diferencia de "repetir N veces" (que siempre repite una cantidad fija conocida de antemano), "repetir hasta" no sabe cuántas veces va a repetir: depende de lo que perciba el sensor en cada vuelta. Por seguridad, el simulador impone un límite máximo de repeticiones: si la condición nunca llega a cumplirse, el bucle se corta solo al llegar a ese límite, en vez de quedar repitiendo para siempre.',
      ejemplo: 'INICIO → repetir hasta hayObstaculo() { avanzar(100) }',
      bloques: 'avanzar(ms), repetir hasta (hayObstaculo) hacer, comparar (medirDistancia < número)',
      comoFunciona: 'Antes de cada pasada del bucle, el bloque "repetir hasta" consulta la condición hayObstaculo(). Mientras sea falsa, ejecuta avanzar(100) y vuelve a preguntar. En cuanto hayObstaculo() se vuelve verdadera, el bucle termina sin ejecutar una pasada más, y el programa continúa con la siguiente instrucción (si hay alguna). Si la condición nunca se cumpliera, el simulador corta el bucle al alcanzar su límite de repeticiones de seguridad, para que el robot nunca quede repitiendo indefinidamente.',
      prueba: 'Arma "repetir hasta hayObstaculo() { avanzar(100) }" y presiona Ejecutar. Observa que el robot avanza en pasos cortos, deteniéndose solo cuando la condición se cumple, sin que hayas calculado a mano cuántos pasos hacían falta.',
      modificacion: 'Cambia el valor de avanzar(100) por un paso más pequeño (por ejemplo avanzar(50)) y vuelve a ejecutar. Observa que el robot necesita más repeticiones para llegar al mismo punto, y que el bucle sigue consultando la condición antes de cada paso.',
      desafio: 'Programa al robot para que se acerque al muro del fondo repitiendo un paso pequeño hasta detectarlo con el sensor, y quede detenido dentro de la zona de meta marcada.',
      criterioTexto: 'El robot debe quedar detenido dentro de la zona de meta marcada, cerca del muro del fondo, habiendo consultado el sensor al menos dos veces, y sin haber alcanzado el límite de seguridad del bucle.',
      pista: 'Pista 1: recuerda que "repetir hasta" consulta la condición antes de cada pasada, no solo al final. Pista 2: si el paso de avanzar es demasiado grande, el robot puede pasarse del punto donde el sensor detecta el muro; usa pasos pequeños. Pista 3: si el bucle nunca detecta el muro, va a terminar solo al llegar a su límite de repeticiones de seguridad — revisa que la condición del bucle sea realmente la que detecta el muro que tienes adelante.',
      competencias: 'C6 — Repetición condicionada',
      resultados: 'RA6 — Bucles de pre-verificación',
      // Geometry/verification: see MAPA_LECCION_6 above.
      grid: GRID_LECCION_6,
      mapa: MAPA_LECCION_6,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var m = snapshot.metricas;
          if (m.evalsSensor < 2 || m.limiteSeguridad !== null) return false;
          return dentroDeMeta(MAPA_LECCION_6.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var m = snapshot.metricas || { evalsSensor: 0, limiteSeguridad: null };
          if (ok) {
            return 'El robot repitió el paso hasta detectar el muro con su sensor y se detuvo en x=' + x + 'px, dentro de la zona de meta.';
          }
          if (m.limiteSeguridad) {
            return 'El robot alcanzó el límite de seguridad del bucle sin que la condición llegara a cumplirse.';
          }
          if (m.evalsSensor < 2) {
            return 'El robot terminó su ejecución habiendo consultado el sensor menos de dos veces: el bucle no llegó a repetirse lo suficiente.';
          }
          return 'El robot no se detuvo dentro de la zona de meta (x=' + x + 'px).';
        }
      }
    },
    {
      id: 7,
      nivel: 'Nivel 3 — Autonomía',
      titulo: 'Desafío integrado',
      objetivo: 'En esta lección vas a combinar todo lo aprendido — secuencias, sensores, "si / si no" y "repetir hasta" — para programar al robot de punta a punta, decidiendo tú mismo cómo recorrer un circuito con una sola ruta.',
      concepto: 'Un programa completo casi nunca usa una sola herramienta: combina una secuencia de pasos con decisiones ("si / si no") y repeticiones ("repetir hasta") que dependen de lo que el sensor va percibiendo en cada momento. No existe una única forma correcta de resolver un mismo problema: dos programas distintos, que usen bloques o combinaciones distintas, pueden lograr el mismo resultado si ambos hacen que el robot recorra el camino sin chocar.',
      ejemplo: 'INICIO → repetir hasta hayObstaculo() { avanzar(100) } → derecha(500) (el robot recorre el primer pasillo, se detiene junto a la pared del fondo y gira hacia el sur; a partir de ahí, eres tú quien decide cómo continuar el recorrido).',
      bloques: 'avanzar(ms), retroceder(ms), izquierda(ms), derecha(ms), detener(), si (hayObstaculo) hacer, si / si no, repetir hasta (hayObstaculo), comparar (medirDistancia < número)',
      comoFunciona: 'Cada herramienta cumple su rol dentro del programa completo: la secuencia ordena los pasos, el sensor te dice cuándo hay una pared cerca, "si / si no" elige entre dos acciones según lo que detecta el sensor, y "repetir hasta" repite un paso corto sin que calcules cuántas veces hace falta. Combinarlas te permite programar un recorrido que se adapta a las paredes, en vez de una ruta fija memorizada de antemano.',
      prueba: 'Arma el ejemplo (repetir hasta hayObstaculo() { avanzar(100) } → derecha(500)) y presiona Ejecutar. Observa que el robot se detiene junto a la pared del fondo del primer pasillo y gira hacia el sur, listo para que agregues el resto del recorrido.',
      modificacion: 'A partir del ejemplo, agrega otro "repetir hasta" y otro giro para recorrer el siguiente tramo del circuito, y sigue completando el recorrido paso a paso hasta lograr que el robot llegue a la zona de meta.',
      desafio: 'Programa al robot para que recorra el circuito completo — el pasillo superior, la bajada por el lado derecho, el regreso por abajo, la subida por el lado izquierdo y el pasillo interior — usando el sensor para decidir dónde girar en cada esquina, y llegue a la zona de meta que se abre al final del pasillo interior, sin chocar en ningún momento.',
      criterioTexto: 'El robot debe recorrer el circuito completo y quedar detenido dentro de la zona de meta marcada al final del pasillo interior, habiendo consultado el sensor al menos una vez durante la ejecución, sin haber chocado y sin haber alcanzado el límite de seguridad de ningún bucle. El circuito tiene una sola ruta, pero no existe un único programa correcto: cualquier combinación de bloques que lo recorra sin chocar es válida.',
      pista: 'Pista 1: piensa el desafío como varios tramos encadenados: cada pasillo termina en una pared, y allí hay que girar. Pista 2: usa el sensor (con "si / si no" o "repetir hasta") para acercarte a cada pared, en vez de adivinar una distancia fija. Pista 3: el circuito gira siempre hacia el mismo lado, así que cada esquina se resuelve con el mismo tipo de giro; después de cada giro, vuelve a acercarte a la siguiente pared. Pista 4: los pasillos del circuito son angostos — si el robot se desvía o toca una pared, la ejecución se detiene.',
      competencias: 'C7 — Integración de secuencias, sensores y control de flujo',
      resultados: 'RA7 — Programa autónomo completo',
      // Geometry/verification: see MAPA_LECCION_7 above.
      grid: GRID_LECCION_7,
      mapa: MAPA_LECCION_7,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var m = snapshot.metricas;
          if (m.evalsSensor < 1 || m.limiteSeguridad !== null) return false;
          return dentroDeMeta(MAPA_LECCION_7.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var m = snapshot.metricas || { evalsSensor: 0, limiteSeguridad: null };
          if (ok) {
            return 'El robot recorrió el circuito, usó su sensor para decidir dónde girar y llegó a la zona de meta (x=' + x + 'px) sin chocar.';
          }
          if (m.limiteSeguridad) {
            return 'El robot alcanzó el límite de seguridad de un bucle sin resolver la condición durante el recorrido.';
          }
          if (!m.evalsSensor) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor durante el recorrido.';
          }
          return 'El robot no completó el circuito: se detuvo en x=' + x + 'px, fuera de la zona de meta.';
        }
      }
    }
  ];
})(typeof window !== 'undefined' ? window : this);
