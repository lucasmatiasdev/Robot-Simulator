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
 * Every lesson (1-8) now has a real, run-checkable `criterio` — Lesson 1's
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
  // `(100,100)`. Every `Delay(ms)` value after `avanzar` in the lesson text is derived from
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
  // avanzar -> Delay(MS_PRECARGA_LECCION_1) -> detener()), so the student presses
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
  // Serpentine: three east-west lanes (3 cells tall each, the minimum corridor
  // width) stacked top to bottom, joined alternately at the east and west ends
  // by a 4-cell gap in the wall between lanes. Start cell (2,2) = pixel
  // (100,100), facing east in the top lane (wide enough for the ejemplo's
  // small square). The meta pocket sits at the east end of the bottom lane.
  // Lane centers are 160px apart, so one lane change is avanzar(1333).
  var GRID_LECCION_7 = {
    version: 1, cols: 20, rows: 15,
    muros: [
      { col: 0, row: 0, colSpan: 20 },
      { col: 0, row: 12, colSpan: 20, rowSpan: 3 },
      { col: 0, row: 1, rowSpan: 11 },
      { col: 19, row: 1, rowSpan: 11 },
      { col: 1, row: 4, colSpan: 13 },
      { col: 18, row: 4 },
      { col: 1, row: 8 },
      { col: 6, row: 8, colSpan: 13 }
    ],
    inicio: { col: 2, row: 2, angulo: 0 },
    meta: { col: 15, row: 9, colSpan: 3, rowSpan: 3 }
  };
  var MAPA_LECCION_7 = RS.gridAdapter.aPixeles(GRID_LECCION_7);

  // Start cell (2,2) = pixel (100,100): a single-route ring (upper corridor,
  // right channel down, bottom corridor, left channel up, inner corridor)
  // ending in the meta pocket, which is entered only from the inner corridor.
  var GRID_LECCION_8 = {
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
  var MAPA_LECCION_8 = RS.gridAdapter.aPixeles(GRID_LECCION_8);

  RS.lessons.CONTENIDO = [
    {
      id: 1,
      nivel: 'Nivel 1 — Reconocimiento',
      titulo: '¿Qué es un robot?',
      objetivo: 'En esta lección aprenderás a identificar los componentes básicos de un robot móvil y a comprender su función dentro del simulador.',
      concepto: 'Un robot está compuesto por un sensor (percibe el entorno), un actuador (produce movimiento o acción), un controlador (decide qué hacer) y un entorno (el espacio donde el robot se mueve). En el simulador, estos cuatro elementos ya están presentes: el sensor de distancia, las ruedas como actuador, el programa de bloques como controlador y el mapa como entorno.',
      ejemplo: 'Ya hay un programa armado esperándote: INICIO → avanzar → Delay(' + MS_PRECARGA_LECCION_1 + ') → detener(). No necesitas construir nada todavía — mira el panel Simulador y presiona Ejecutar.',
      bloques: 'avanzar, Delay(ms), detener() — ya están armados como referencia; el objetivo de esta lección es identificarlos, no construirlos.',
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
      concepto: 'El robot se mueve cuando su controlador ejecuta instrucciones de movimiento: avanzar, retroceder y girar. Una instrucción de movimiento no tiene duración propia: enciende los motores y estos siguen encendidos hasta que otro bloque los cambie. El bloque Delay(ms) hace que el programa espere ese tiempo (en milisegundos) mientras los motores siguen en marcha, y detener() los apaga.',
      ejemplo: 'INICIO → avanzar → Delay(2500) → detener()',
      bloques: 'avanzar, Delay(ms), detener()',
      comoFunciona: 'El bloque avanzar enciende los motores hacia adelante, pero no espera: el robot sigue avanzando mientras el programa ejecuta Delay(2500), que espera 2500 milisegundos. Después, el bloque detener() apaga los motores. Juntos forman una secuencia: primero se ejecuta avanzar, luego Delay y, solo cuando este termina, se ejecuta detener.',
      prueba: 'Arma la secuencia avanzar → Delay(2500) → detener() en el editor y presiona Ejecutar. Observa cómo se desplaza el robot en el panel Simulador.',
      modificacion: 'Cambia el valor de Delay(2500) por un número distinto y vuelve a ejecutar. Observa cómo cambia la distancia recorrida.',
      desafio: 'Haz que el robot avance durante un tiempo determinado y quede detenido dentro de la zona marcada al fondo de la sala, sin chocar contra la pared del fondo.',
      criterioTexto: 'El robot debe avanzar y quedar detenido dentro de la zona de meta marcada en el mapa (la zona al fondo de la sala), sin colisionar contra la pared del fondo.',
      pista: 'Pista 1: recuerda que avanzar enciende los motores y Delay(ms) decide cuánto tiempo siguen encendidos; a mayor ms, mayor distancia. Pista 2: si el tiempo es muy corto, el robot no llega a la zona marcada; si es muy largo, choca contra la pared del fondo.',
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
      ejemplo: 'INICIO → avanzar → Delay(1250) → derecha → Delay(500) → avanzar → Delay(500) → detener()',
      bloques: 'avanzar, Delay(ms), derecha, retroceder, izquierda, detener()',
      comoFunciona: 'Cada bloque se ejecuta en orden, y cada Delay deja pasar el tiempo antes del siguiente: primero avanzar con Delay(1250) desplaza al robot hacia adelante, luego derecha con Delay(500) lo gira sobre su lugar hacia el sur, y solo después avanzar con Delay(500) lo desplaza en la nueva dirección. Si se invirtiera el orden del giro y el segundo avance, el robot terminaría en un punto distinto.',
      prueba: 'Arma la secuencia avanzar → Delay(1250) → derecha → Delay(500) → avanzar → Delay(500) → detener() en el editor y presiona Ejecutar. Observa el camino en forma de "L" que recorre el robot en el panel Simulador: avanza hacia el este, gira y baja hacia el sur sin tocar el primer pilar.',
      modificacion: 'Cambia el orden de los dos últimos tramos (avanzar → Delay(500) antes de derecha → Delay(500)) y vuelve a ejecutar. Observa que ahora el robot choca contra el primer pilar: las instrucciones son las mismas, pero el camino final es distinto.',
      desafio: 'Arma una secuencia que rodee los dos pilares del pasillo — girando en el momento justo cada vez — y llegue a la zona de meta marcada al este. Vas a necesitar 4 giros.',
      criterioTexto: 'El robot debe girar a tiempo para esquivar el primer pilar, volver a girar para rodear el segundo, y terminar detenido dentro de la zona de meta marcada al este, sin colisionar en ningún tramo. El tramo hacia el norte es angosto (unos 20 px de margen), así que su duración debe ser precisa.',
      pista: 'Pista 1: recuerda que las instrucciones se ejecutan en el orden exacto en que las colocaste, una tras otra. Pista 2: si avanzas demasiado antes de girar, vas a chocar contra el primer pilar — el giro tiene que ocurrir antes de llegar a él. Pista 3: en total necesitas 4 giros: baja para pasar por debajo del primer pilar, vuelve a orientarte al este, sube para pasar por encima del segundo pilar y vuelve a orientarte al este. Pista 4: usa izquierda para los giros hacia la izquierda. El tramo hacia el norte es el más exigente: su margen es de unos 170 ms, así que ajusta ese Delay con cuidado y prueba valores cercanos.',
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
      objetivo: 'En esta lección aprenderás a usar el bloque "repetir hasta" para hacer que el robot avance en pasos cortos hasta que el sensor detecte un obstáculo, sin calcular de antemano cuántas veces hace falta repetir.',
      concepto: 'Un sensor es un componente que percibe una condición del entorno — en este caso, la distancia hasta el obstáculo más cercano frente al robot. El bloque "repetir hasta" es un bucle de pre-verificación: antes de cada pasada, consulta esa lectura; si todavía es falsa, ejecuta el cuerpo una vez y vuelve a preguntar; en cuanto se vuelve verdadera, el bucle termina sin ejecutar una pasada más. Así el controlador no necesita calcular de antemano cuántos pasos hacen falta: el propio sensor le indica cuándo detenerse. Si la condición nunca llegara a cumplirse, el bucle seguiría repitiendo hasta que el robot choque o presiones Detener.',
      ejemplo: 'INICIO → repetir hasta hayObstaculo() { avanzar → Delay(100) } → detener()',
      bloques: 'avanzar, Delay(ms), repetir hasta (hayObstaculo) hacer, comparar (medirDistancia < número), detener()',
      comoFunciona: 'Antes de cada pasada del bucle, el bloque "repetir hasta" consulta la condición hayObstaculo(). Mientras sea falsa, ejecuta avanzar → Delay(100) y vuelve a preguntar. En cuanto hayObstaculo() se vuelve verdadera, el bucle termina sin ejecutar una pasada más, y el programa continúa con la siguiente instrucción (si hay alguna). Si la condición nunca se cumpliera, el bucle seguiría repitiendo hasta que el robot choque o presiones Detener.',
      prueba: 'Arma "repetir hasta hayObstaculo() { avanzar → Delay(100) }" seguido de detener() en el editor y presiona Ejecutar. Observa que el robot avanza en pasos cortos y se detiene solo, sin que hayas calculado a mano cuántos pasos hacían falta.',
      modificacion: 'Reemplaza la condición hayObstaculo() del bucle por un bloque comparar que evalúe medirDistancia() contra un número (por ejemplo, medirDistancia() < 20) y vuelve a ejecutar. El robot se detiene en un punto ligeramente distinto (x=612px), pero sigue dentro de la zona de meta: la decisión de cuándo terminar el bucle sigue dependiendo de una lectura del sensor, no de un valor de posición fijo.',
      desafio: 'Programa al robot para que se acerque al muro del fondo repitiendo un paso pequeño hasta detectarlo con el sensor, y quede detenido dentro de la zona de meta marcada, sin calcular a mano una distancia fija de antemano.',
      criterioTexto: 'El robot debe quedar detenido dentro de la zona de meta marcada, cerca del muro del fondo, habiendo consultado el sensor al menos una vez durante la ejecución.',
      pista: 'Pista 1: recuerda que "repetir hasta" consulta la condición antes de cada pasada, no solo al final. Pista 2: si el paso de avanzar es demasiado grande, el robot puede pasarse del punto donde el sensor detecta el muro; usa pasos pequeños, como avanzar → Delay(100). Pista 3: si el bucle nunca detecta el muro, el robot seguirá avanzando hasta chocar — revisa que la condición del bucle sea realmente la que detecta el muro que tienes adelante. Pista 4: el sensor solo detecta el muro cuando el robot ya está cerca de él; con pasos de 100 ms, la última pasada se completa cuando el robot todavía está a una distancia segura.',
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
      objetivo: 'En esta lección vas a reutilizar el bucle "repetir hasta" de la Lección 4 y aprenderás a agregar una decisión de dos ramas: "si / si no" le permite al robot elegir entre dos acciones distintas en cada pasada, según lo que perciba el sensor en ese instante.',
      concepto: 'Un condicional "si / si no" le permite al controlador elegir siempre una de dos acciones posibles: si la condición es verdadera, ejecuta la primera rama; si es falsa, ejecuta la segunda — a diferencia de un bloque "si" simple, que solo agrega una acción cuando la condición se cumple y no hace nada en caso contrario, "si / si no" siempre ejecuta exactamente una de las dos ramas, nunca ambas ni ninguna. Colocado dentro de un bucle como "repetir N veces", esta decisión se vuelve a tomar en cada pasada, con una lectura nueva del sensor cada vez.',
      ejemplo: 'INICIO → repetir hasta hayObstaculo() { avanzar → Delay(100) } → derecha → Delay(500) → repetir 40 veces { si hayObstaculo() { Salir } si no { avanzar → Delay(100) } } → detener()',
      bloques: 'repetir hasta (hayObstaculo), derecha, repetir N veces, si (hayObstaculo) / si no, Salir, detener(), avanzar, Delay(ms)',
      comoFunciona: 'El programa primero repite avanzar → Delay(100) hasta que el sensor detecta la pared del fondo del primer pasillo, gira con derecha → Delay(500) y entra al segundo tramo. A partir de ahí, "repetir 40 veces" ejecuta hasta 40 pasadas; en cada una, "si / si no" consulta el sensor de nuevo: si detecta el muro, ejecuta Salir, que abandona el bucle de inmediato, y el bloque detener() final apaga los motores; si no lo detecta todavía, ejecuta avanzar → Delay(100) y pasa a la siguiente pasada. El número 40 es solo un límite superior — el bucle nunca llega a completar sus 40 pasadas porque Salir lo corta antes.',
      prueba: 'Arma la secuencia "repetir hasta hayObstaculo() { avanzar → Delay(100) }" → derecha → Delay(500) → "repetir 40 veces { si hayObstaculo() { Salir } si no { avanzar → Delay(100) } }" seguido de detener() y presiona Ejecutar. Observa que el robot se acerca a la primera pared, gira hacia el sur y avanza en pasos cortos, consultando el sensor en cada pasada, hasta detenerse solo frente a la segunda pared.',
      modificacion: 'Quita el bloque derecha → Delay(500) de la mitad del programa y ejecuta de nuevo: el primer bucle "repetir hasta" sigue deteniendo al robot junto a la pared del fondo del primer pasillo, pero como nunca gira hacia el sur, la primera pasada del segundo bucle ya encuentra esa misma pared y ejecuta Salir de inmediato. El robot consultó el sensor igual que antes, pero termina casi a la misma altura en la que empezó, lejos de la zona de meta.',
      desafio: 'Programa al robot para que se acerque a la pared del fondo del primer pasillo, gire hacia el sur y, dentro de un bucle, use "si / si no" en cada pasada para decidir si sigue avanzando o se detiene al detectar la segunda pared, hasta llegar a la zona de meta marcada al sur.',
      criterioTexto: 'El robot debe haber consultado su sensor al menos una vez durante la ejecución, y terminar detenido dentro de la zona de meta marcada al sur del punto de giro, sin colisionar.',
      pista: 'Pista 1: recuerda que "si / si no" siempre ejecuta una de las dos ramas, nunca ninguna ni ambas — piensa qué debería pasar en cada pasada del bucle. Pista 2: usa "repetir hasta" para el primer tramo, igual que en la Lección 4, y no olvides el giro con derecha → Delay(500) antes de entrar al segundo bucle. Pista 3: dentro de "repetir 40 veces", la rama que sale del bucle tiene que estar conectada a la condición que detecta la segunda pared; la otra rama debe seguir avanzando en pasos cortos. Pista 4: el número de repeticiones del segundo bucle es solo un límite superior — Salir corta el bucle antes de llegar a las 40 pasadas, así que no hace falta calcularlo con precisión.',
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
      objetivo: 'En esta lección vas a repasar y comparar las dos formas de repetición que ya conoces: "repetir hasta" (Lección 4), que repite según lo que percibe el sensor, y "repetir N veces" (Lección 5), que repite una cantidad fija decidida de antemano — sobre el mismo mapa que ya recorriste en la Lección 4.',
      concepto: 'Ya usaste "repetir hasta" en la Lección 4 para acercarte a una pared sin calcular a mano cuántos pasos hacían falta, y "repetir N veces" en la Lección 5 para acotar un bucle a una cantidad fija de pasadas. Ambos bloques pueden hacer que el robot termine en el mismo punto del mapa — pero solo "repetir hasta" decide cuándo detenerse usando lo que el sensor percibe en cada pasada; "repetir N veces" repite siempre la misma cantidad, se haya o no acercado a un obstáculo. Esta lección te invita a comparar ambos en el mismo recorrido.',
      ejemplo: 'INICIO → repetir hasta hayObstaculo() { avanzar → Delay(100) } → detener()',
      bloques: 'avanzar, Delay(ms), repetir hasta (hayObstaculo) hacer, comparar (medirDistancia < número), detener()',
      comoFunciona: 'Antes de cada pasada del bucle, el bloque "repetir hasta" consulta la condición hayObstaculo(). Mientras sea falsa, ejecuta avanzar → Delay(100) y vuelve a preguntar. En cuanto hayObstaculo() se vuelve verdadera, el bucle termina sin ejecutar una pasada más, y el programa continúa con la siguiente instrucción (si hay alguna). Si la condición nunca se cumpliera, el bucle seguiría repitiendo hasta que el robot choque o presiones Detener.',
      prueba: 'Arma "repetir hasta hayObstaculo() { avanzar → Delay(100) }" seguido de detener() y presiona Ejecutar. Observa que el robot avanza en pasos cortos, deteniéndose solo cuando la condición se cumple, sin que hayas calculado a mano cuántos pasos hacían falta.',
      modificacion: 'Cambia el bloque "repetir hasta hayObstaculo() { avanzar → Delay(100) }" por "repetir 45 veces { avanzar → Delay(100) }" y vuelve a ejecutar. El robot llega exactamente al mismo punto que antes (x=600px, dentro de la zona de meta), porque 45 pasos de 100 ms recorren la misma distancia — pero esta vez el criterio de éxito no se cumple: como el bucle nunca consultó el sensor, el simulador registra cero lecturas, y la lección exige al menos dos. Llegar al lugar correcto no alcanza si la decisión de detenerse no usó lo que el robot percibe.',
      desafio: 'Programa al robot para que se acerque al muro del fondo repitiendo un paso pequeño hasta detectarlo con el sensor, y quede detenido dentro de la zona de meta marcada.',
      criterioTexto: 'El robot debe quedar detenido dentro de la zona de meta marcada, cerca del muro del fondo, habiendo consultado el sensor al menos dos veces.',
      pista: 'Pista 1: recuerda que "repetir hasta" consulta la condición antes de cada pasada, no solo al final. Pista 2: si el paso de avanzar es demasiado grande, el robot puede pasarse del punto donde el sensor detecta el muro; usa pasos pequeños. Pista 3: si el bucle nunca detecta el muro, el robot seguirá avanzando hasta chocar — revisa que la condición del bucle sea realmente la que detecta el muro que tienes adelante.',
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
      titulo: 'Variables',
      objetivo: 'En esta lección aprenderás a guardar información en una variable — un contador y una bandera de dirección — y a usarla para que el robot decida cuántas veces repetir y hacia dónde girar en cada tramo de un recorrido en zigzag.',
      concepto: 'Una variable es un nombre que guarda un valor mientras el programa se ejecuta. Se declara una sola vez indicando su tipo: "int" guarda números enteros (por ejemplo, un contador) y "bool" guarda verdadero o falso (por ejemplo, una bandera que indica hacia qué lado avanza el robot). Después se puede leer su valor, asignarle uno nuevo con "asignar" o sumarle un número con "cambiar". Como el valor se conserva entre una pasada del bucle y la siguiente, una variable permite que el programa recuerde lo que ya hizo: cuántas vueltas dio o en qué dirección iba. Si el bloque "declarar" queda dentro del bucle, la variable vuelve a su valor inicial en cada pasada, así que conviene declararla antes.',
      ejemplo: 'INICIO → declarar int lados = 0 → repetir hasta (lados >= 4) { avanzar → Delay(300) → derecha → Delay(500) → cambiar lados en 1 } → detener() (el robot dibuja un cuadrado pequeño y cuenta cada lado con la variable).',
      bloques: 'declarar (int / bool), asignar, cambiar, valor de variable, verdadero / falso, comparar (variable >= número), si / si no con variable, repetir hasta, avanzar, Delay(ms), derecha, izquierda, detener()',
      comoFunciona: 'El bloque "declarar int lados = 0" crea la variable con valor inicial 0. En cada pasada, "repetir hasta" compara lados con 4 antes de empezar: mientras sea menor, el robot avanza, gira, y "cambiar lados en 1" suma uno al contador. Al llegar a 4 el bucle termina, sin ejecutar una pasada más. La comparación usa solo la variable, no el sensor del robot. Una variable bool funciona igual pero guarda verdadero o falso, y se puede usar directamente como condición de un "si / si no".',
      prueba: 'Arma el ejemplo (declarar int lados = 0 → repetir hasta lados >= 4 { avanzar → Delay(300) → derecha → Delay(500) → cambiar lados en 1 } → detener()) y presiona Ejecutar. Observa que el robot gira sobre un cuadrado pequeño y vuelve a su punto de partida: el bucle termina solo cuando el contador llega a 4, sin que el sensor intervenga.',
      modificacion: 'Cambia el 4 de la comparación por otro número (por ejemplo 2) y vuelve a ejecutar. El robot da menos lados, porque el contador llega antes al valor de la condición.',
      desafio: 'Programa al robot para que recorra el zigzag de tres pasillos: avanza por el primero hasta detectar la pared, baja al segundo pasillo y regresa por él, baja al tercero y avanza hasta la zona de meta. Usa una variable int para contar los tramos que faltan y una variable bool como bandera para recordar hacia qué lado giras en cada extremo.',
      criterioTexto: 'El robot debe recorrer los tres pasillos y quedar detenido dentro de la zona de meta marcada al final del último pasillo, habiendo consultado el sensor al menos una vez, y habiendo modificado alguna variable al menos dos veces (con "asignar" o "cambiar").',
      pista: 'Pista 1: declara antes del bucle el contador (int) y la bandera (bool); si los declaras dentro, vuelven a su valor inicial en cada pasada. Pista 2: dentro del bucle, primero avanza en pasos cortos hasta detectar la pared; luego gira, baja al siguiente pasillo y gira otra vez. Pista 3: usa "si / si no" con la bandera como condición: si es verdadera, los giros son hacia la derecha; si no, hacia la izquierda, y en cada rama asigna la bandera al valor contrario. Pista 4: no olvides "cambiar" el contador al final de cada pasada, o el bucle nunca llegará a su condición de salida.',
      competencias: 'C7 — Variables y estado del programa',
      resultados: 'RA7 — Uso de variables',
      // Geometry/verification: see MAPA_LECCION_7 above.
      grid: GRID_LECCION_7,
      mapa: MAPA_LECCION_7,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var m = snapshot.metricas;
          if (m.evalsSensor < 1 || m.limiteSeguridad !== null || m.cambiosVariable < 2) return false;
          return dentroDeMeta(MAPA_LECCION_7.meta, snapshot.estado.x, snapshot.estado.y);
        },
        describir: function (snapshot, ok) {
          if (!snapshot || !snapshot.estado) return null;
          var x = Math.round(snapshot.estado.x);
          var y = Math.round(snapshot.estado.y);
          var m = snapshot.metricas || { evalsSensor: 0, limiteSeguridad: null, cambiosVariable: 0 };
          if (ok) {
            return 'El robot recorrió los tres pasillos usando variables para recordar el tramo y la dirección, y llegó a la zona de meta (x=' + x + 'px, y=' + y + 'px).';
          }
          if (m.limiteSeguridad) {
            return 'El robot alcanzó el límite de seguridad de un bucle: revisa que el contador cambie en cada pasada para que la condición llegue a cumplirse.';
          }
          if (!m.evalsSensor) {
            return 'El robot terminó su ejecución sin haber consultado nunca su sensor para detectar el final de cada pasillo.';
          }
          if (!m.cambiosVariable || m.cambiosVariable < 2) {
            return 'El programa casi no modificó ninguna variable: usa "cambiar" o "asignar" para que el contador y la bandera se actualicen durante el recorrido.';
          }
          return 'El robot no llegó a la zona de meta: se detuvo en x=' + x + 'px, y=' + y + 'px.';
        }
      }
    },
    {
      id: 8,
      nivel: 'Nivel 3 — Autonomía',
      titulo: 'Desafío integrado',
      objetivo: 'En esta lección vas a combinar todo lo aprendido — secuencias, sensores, "si / si no" y "repetir hasta" — para programar al robot de punta a punta, decidiendo tú mismo cómo recorrer un circuito con una sola ruta.',
      concepto: 'Un programa completo casi nunca usa una sola herramienta: combina una secuencia de pasos con decisiones ("si / si no") y repeticiones ("repetir hasta") que dependen de lo que el sensor va percibiendo en cada momento. No existe una única forma correcta de resolver un mismo problema: dos programas distintos, que usen bloques o combinaciones distintas, pueden lograr el mismo resultado si ambos hacen que el robot recorra el camino sin chocar.',
      ejemplo: 'INICIO → repetir hasta hayObstaculo() { avanzar → Delay(100) } → derecha → Delay(500) → detener() (el robot recorre el primer pasillo, se detiene junto a la pared del fondo y gira hacia el sur; a partir de ahí, eres tú quien decide cómo continuar el recorrido).',
      bloques: 'avanzar, Delay(ms), retroceder, izquierda, derecha, detener(), si (hayObstaculo) hacer, si / si no, repetir hasta (hayObstaculo), comparar (medirDistancia < número)',
      comoFunciona: 'Cada herramienta cumple su rol dentro del programa completo: la secuencia ordena los pasos, el sensor te dice cuándo hay una pared cerca, "si / si no" elige entre dos acciones según lo que detecta el sensor, y "repetir hasta" repite un paso corto sin que calcules cuántas veces hace falta. Combinarlas te permite programar un recorrido que se adapta a las paredes, en vez de una ruta fija memorizada de antemano.',
      prueba: 'Arma el ejemplo (repetir hasta hayObstaculo() { avanzar → Delay(100) } → derecha → Delay(500) → detener()) y presiona Ejecutar. Observa que el robot se detiene junto a la pared del fondo del primer pasillo y gira hacia el sur, listo para que agregues el resto del recorrido.',
      modificacion: 'A partir del ejemplo, agrega otro "repetir hasta" y otro giro para recorrer el siguiente tramo del circuito, y sigue completando el recorrido paso a paso hasta lograr que el robot llegue a la zona de meta.',
      desafio: 'Programa al robot para que recorra el circuito completo — el pasillo superior, la bajada por el lado derecho, el regreso por abajo, la subida por el lado izquierdo y el pasillo interior — usando el sensor para decidir dónde girar en cada esquina, y llegue a la zona de meta que se abre al final del pasillo interior, sin chocar en ningún momento.',
      criterioTexto: 'El robot debe recorrer el circuito completo y quedar detenido dentro de la zona de meta marcada al final del pasillo interior, habiendo consultado el sensor al menos una vez durante la ejecución, y sin haber chocado. El circuito tiene una sola ruta, pero no existe un único programa correcto: cualquier combinación de bloques que lo recorra sin chocar es válida.',
      pista: 'Pista 1: piensa el desafío como varios tramos encadenados: cada pasillo termina en una pared, y allí hay que girar. Pista 2: usa el sensor (con "si / si no" o "repetir hasta") para acercarte a cada pared, en vez de adivinar una distancia fija. Pista 3: el circuito gira siempre hacia el mismo lado, así que cada esquina se resuelve con el mismo tipo de giro; después de cada giro, vuelve a acercarte a la siguiente pared. Pista 4: los pasillos del circuito son angostos — si el robot se desvía o toca una pared, la ejecución se detiene.',
      competencias: 'C8 — Integración de secuencias, sensores y control de flujo',
      resultados: 'RA8 — Programa autónomo completo',
      // Geometry/verification: see MAPA_LECCION_8 above.
      grid: GRID_LECCION_8,
      mapa: MAPA_LECCION_8,
      criterio: {
        evaluar: function (snapshot) {
          if (!snapshot || !snapshot.estado || !snapshot.metricas) return false;
          var m = snapshot.metricas;
          if (m.evalsSensor < 1 || m.limiteSeguridad !== null) return false;
          return dentroDeMeta(MAPA_LECCION_8.meta, snapshot.estado.x, snapshot.estado.y);
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
