/**
 * Headless Node test for the grid-to-pixel adapter (src/sim/gridAdapter.js).
 * No browser, no bundler, no test runner/framework dependency — run directly:
 *
 *   node tests/test-grid-adapter.node.js
 *
 * Follows the same `vm`-sandbox loading pattern as
 * tests/test-arduino-sketch.node.js — see that file's header comment for why.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var sandbox = { window: {}, console: console };
vm.createContext(sandbox);

function cargar(rel) {
  var codigo = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(codigo, sandbox, { filename: rel });
}

cargar('src/config.js');
cargar('src/sim/gridAdapter.js');

var RS = sandbox.window.RS;

var total = 0;
var fallidos = 0;

function assert(cond, mensaje) {
  total++;
  if (!cond) {
    fallidos++;
    console.log('FAIL ' + mensaje);
  } else {
    console.log('PASS ' + mensaje);
  }
}

function assertEquals(actual, esperado, mensaje) {
  var ok = JSON.stringify(actual) === JSON.stringify(esperado);
  assert(ok, mensaje + (ok ? '' : (' — esperado ' + JSON.stringify(esperado) + ', obtuvo ' + JSON.stringify(actual))));
}

var CELL_SIZE = RS.config.CELL_SIZE;

// ---- 1. Single-cell wall converts to a CELL_SIZE x CELL_SIZE rect ----
var mapaUnCelda = {
  version: 1, cols: 20, rows: 15,
  muros: [{ col: 5, row: 3 }],
  inicio: { col: 0, row: 0, angulo: 0 },
  meta: null
};
var pxUnCelda = RS.gridAdapter.aPixeles(mapaUnCelda);
assertEquals(pxUnCelda.obstaculos, [{ x: 5 * CELL_SIZE, y: 3 * CELL_SIZE, w: CELL_SIZE, h: CELL_SIZE }],
  'muro de 1 celda convierte a rect de CELL_SIZE x CELL_SIZE en la esquina de la celda');

// ---- 2. Multi-cell span converts to one merged rect (colSpan/rowSpan) ----
var mapaSpan = {
  version: 1, cols: 20, rows: 15,
  muros: [{ col: 10, row: 5, colSpan: 2, rowSpan: 4 }],
  inicio: { col: 0, row: 0, angulo: 0 },
  meta: { col: 8, row: 2, colSpan: 4, rowSpan: 11 }
};
var pxSpan = RS.gridAdapter.aPixeles(mapaSpan);
assertEquals(pxSpan.obstaculos, [{ x: 10 * CELL_SIZE, y: 5 * CELL_SIZE, w: 2 * CELL_SIZE, h: 4 * CELL_SIZE }],
  'muro con colSpan/rowSpan convierte a un unico rect que cubre el area del span');
assertEquals(pxSpan.meta, { x: 8 * CELL_SIZE, y: 2 * CELL_SIZE, w: 4 * CELL_SIZE, h: 11 * CELL_SIZE },
  'meta multi-celda (4x11, Leccion 7) convierte a un unico rect pixel');

// ---- 3. Start pose uses the cell CENTER, not the cell corner ----
var pxInicio = RS.gridAdapter.aPixeles({
  version: 1, cols: 20, rows: 15, muros: [],
  inicio: { col: 1, row: 7, angulo: 0 }, meta: null
});
assertEquals(pxInicio.poseInicial, { x: 1.5 * CELL_SIZE, y: 7.5 * CELL_SIZE, angulo: 0 },
  'poseInicial usa el centro de la celda ((col+0.5)*CELL_SIZE, (row+0.5)*CELL_SIZE)');

// ---- 4. Edge cells (col=0,row=0 and the last valid col/row) convert correctly ----
var pxEsquina0 = RS.gridAdapter.aPixeles({
  version: 1, cols: 20, rows: 15, muros: [{ col: 0, row: 0 }],
  inicio: { col: 0, row: 0, angulo: 0 }, meta: null
});
assertEquals(pxEsquina0.obstaculos[0], { x: 0, y: 0, w: CELL_SIZE, h: CELL_SIZE },
  'celda de borde (0,0) convierte a rect en el origen sin desplazamiento');

var pxEsquinaN = RS.gridAdapter.aPixeles({
  version: 1, cols: 20, rows: 15, muros: [{ col: 19, row: 14 }],
  inicio: { col: 0, row: 0, angulo: 0 }, meta: null
});
assertEquals(pxEsquinaN.obstaculos[0], { x: 19 * CELL_SIZE, y: 14 * CELL_SIZE, w: CELL_SIZE, h: CELL_SIZE },
  'celda de borde (ultima col/row) convierte a rect dentro de los limites del mundo');

// ---- 5. Conversion is deterministic and idempotent ----
var primeraConversion = RS.gridAdapter.aPixeles(mapaSpan);
var segundaConversion = RS.gridAdapter.aPixeles(mapaSpan);
assertEquals(primeraConversion, segundaConversion,
  'convertir el mismo mapa dos veces produce una salida pixel identica (deterministico/idempotente)');

// ---- 6. validar() accepts a well-formed grid map ----
assert(RS.gridAdapter.validar(mapaSpan) === true, 'validar() acepta un mapa de grilla bien formado');

// ---- 7. validar() rejects malformed input ----
assert(RS.gridAdapter.validar(null) === false, 'validar() rechaza null');
assert(RS.gridAdapter.validar({}) === false, 'validar() rechaza un objeto sin cols/rows/inicio');
assert(RS.gridAdapter.validar({ cols: 20, rows: 15, inicio: { col: -1, row: 0 } }) === false,
  'validar() rechaza inicio con coordenadas negativas');
assert(RS.gridAdapter.validar({
  cols: 20, rows: 15, inicio: { col: 0, row: 0 },
  muros: [{ col: 19, row: 0, colSpan: 5 }]
}) === false, 'validar() rechaza un muro cuyo span excede los limites de la grilla');
assert(RS.gridAdapter.validar({
  cols: 20, rows: 15, inicio: { col: 0, row: 0 },
  meta: { col: 25, row: 0 }
}) === false, 'validar() rechaza una meta fuera de los limites de la grilla');

// ---- 8. celdaDesdePixel() is the inverse of the corner-rect conversion ----
assertEquals(RS.gridAdapter.celdaDesdePixel(5 * CELL_SIZE + 3, 3 * CELL_SIZE + 7), { col: 5, row: 3 },
  'celdaDesdePixel() recupera {col,row} desde un punto dentro de la celda');

console.log('');
console.log(total + ' pruebas, ' + fallidos + ' fallidas');
if (fallidos > 0) {
  process.exit(1);
}
