/**
 * Headless Node test for the sandbox map editor's PURE logic
 * (src/ui/mapEditor.js's `_pure` functions): cell placement/clear and the
 * localStorage save/load round trip. No browser, no test framework — run
 * directly:
 *
 *   node tests/test-map-editor.node.js
 *
 * Follows the same `vm`-sandbox loading pattern as
 * tests/test-grid-adapter.node.js. DOM/canvas click-hit-testing (init/
 * getBoundingClientRect scaling) is intentionally NOT covered here: this
 * repo has no headless browser harness, and that logic needs a real
 * laid-out canvas element to be meaningful (documented limitation, not a
 * skipped requirement — see tasks.md 3.6).
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

/** Minimal in-memory localStorage stub — enough for guardar()/cargarGuardado(). */
function crearLocalStorageStub() {
  var datos = {};
  return {
    getItem: function (clave) { return Object.prototype.hasOwnProperty.call(datos, clave) ? datos[clave] : null; },
    setItem: function (clave, valor) { datos[clave] = String(valor); },
    removeItem: function (clave) { delete datos[clave]; }
  };
}

var localStorageStub = crearLocalStorageStub();
var sandbox = { window: { localStorage: localStorageStub }, console: console };
vm.createContext(sandbox);

function cargar(rel) {
  var codigo = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(codigo, sandbox, { filename: rel });
}

cargar('src/config.js');
cargar('src/sim/gridAdapter.js');
cargar('src/ui/mapEditor.js');

var RS = sandbox.window.RS;
var pure = RS.ui.mapEditor._pure;

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

// ---- 1. mapaVacio() shape ----
var vacio = pure.mapaVacio();
assertEquals(vacio.muros, [], 'mapaVacio() no tiene muros');
assertEquals(vacio.meta, null, 'mapaVacio() no tiene meta');
assert(RS.gridAdapter.validar(vacio) === true, 'mapaVacio() es un mapa de grilla valido');

// ---- 2. colocarMuro() places a wall cell, is idempotent ----
var mapa = pure.mapaVacio();
pure.colocarMuro(mapa, { col: 5, row: 3 });
assertEquals(mapa.muros, [{ col: 5, row: 3 }], 'colocarMuro() agrega la celda a muros');
pure.colocarMuro(mapa, { col: 5, row: 3 });
assertEquals(mapa.muros, [{ col: 5, row: 3 }], 'colocarMuro() sobre una celda ya-muro no duplica la entrada');

// ---- 3. borrarCelda() clears a wall cell ----
pure.borrarCelda(mapa, { col: 5, row: 3 });
assertEquals(mapa.muros, [], 'borrarCelda() quita la celda de muros');

// ---- 4. borrarCelda() clears a single-cell goal at that cell ----
pure.establecerMeta(mapa, { col: 8, row: 6 });
assertEquals(mapa.meta, { col: 8, row: 6 }, 'establecerMeta() fija la meta en la celda dada');
pure.borrarCelda(mapa, { col: 8, row: 6 });
assertEquals(mapa.meta, null, 'borrarCelda() sobre la celda de la meta la limpia');

// ---- 5. establecerInicio() moves the start, preserving angulo ----
mapa.inicio.angulo = 90;
pure.establecerInicio(mapa, { col: 2, row: 9 });
assertEquals(mapa.inicio, { col: 2, row: 9, angulo: 90 }, 'establecerInicio() mueve el inicio preservando el angulo previo');

// ---- 6. Editing preserves validity throughout ----
pure.colocarMuro(mapa, { col: 0, row: 0 });
pure.establecerMeta(mapa, { col: 19, row: 14 });
assert(RS.gridAdapter.validar(mapa) === true, 'un mapa editado (muro + inicio + meta) sigue siendo valido');

// ---- 7. guardar()/cargarGuardado() round trip survives a reload ----
var mapaGuardar = pure.mapaVacio();
pure.colocarMuro(mapaGuardar, { col: 4, row: 4 });
pure.establecerInicio(mapaGuardar, { col: 3, row: 3 });
pure.establecerMeta(mapaGuardar, { col: 12, row: 10 });
assert(pure.guardar(mapaGuardar) === true, 'guardar() reporta exito con localStorage disponible');
var recuperado = pure.cargarGuardado();
assertEquals(recuperado, mapaGuardar, 'cargarGuardado() recupera exactamente el mapa guardado (round trip)');

// ---- 8. cargarGuardado() returns null when nothing was saved ----
localStorageStub.removeItem('rs-sandbox-mapa-v1');
assert(pure.cargarGuardado() === null, 'cargarGuardado() devuelve null si no hay nada guardado');

// ---- 9. cargarGuardado() falls back to null on corrupted JSON ----
localStorageStub.setItem('rs-sandbox-mapa-v1', '{not valid json');
assert(pure.cargarGuardado() === null, 'cargarGuardado() devuelve null ante JSON corrupto (fallback a mapa por defecto)');

// ---- 10. cargarGuardado() falls back to null on a wrong/missing version ----
localStorageStub.setItem('rs-sandbox-mapa-v1', JSON.stringify({ version: 2, cols: 20, rows: 15, muros: [], inicio: { col: 0, row: 0 } }));
assert(pure.cargarGuardado() === null, 'cargarGuardado() devuelve null ante una version distinta a la esperada');

// ---- 11. cargarGuardado() falls back to null on a structurally invalid map ----
localStorageStub.setItem('rs-sandbox-mapa-v1', JSON.stringify({ version: 1, cols: 20, rows: 15, muros: [{ col: -1, row: 0 }], inicio: { col: 0, row: 0 } }));
assert(pure.cargarGuardado() === null, 'cargarGuardado() devuelve null ante un mapa que gridAdapter.validar() rechaza');

// ---- 12. cargarGuardado() degrades gracefully when localStorage throws ----
var sandboxSinStorage = { window: { localStorage: { getItem: function () { throw new Error('quota'); } } }, console: console };
vm.createContext(sandboxSinStorage);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8'), sandboxSinStorage);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/sim/gridAdapter.js'), 'utf8'), sandboxSinStorage);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ui/mapEditor.js'), 'utf8'), sandboxSinStorage);
assert(sandboxSinStorage.window.RS.ui.mapEditor._pure.cargarGuardado() === null,
  'cargarGuardado() devuelve null si localStorage.getItem() lanza (modo privado/cuota)');

// ---- 13. borrarGuardado() removes the stored map ----
pure.guardar(pure.mapaVacio());
pure.borrarGuardado();
assert(pure.cargarGuardado() === null, 'borrarGuardado() deja sin mapa guardado (cargarGuardado vuelve a null)');

console.log('');
console.log(total + ' pruebas, ' + fallidos + ' fallidas');
if (fallidos > 0) {
  process.exit(1);
}
