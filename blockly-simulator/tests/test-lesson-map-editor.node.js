/**
 * Headless Node test for the lesson map authoring tool's PURE core
 * (src/ui/lessonMapEditor.js's `_pure` functions): region-aware erase,
 * covered-cell wall paint, rectangle goal, and the `GRID_LECCION_N`
 * code exporter. No browser, no test framework — run directly:
 *
 *   node tests/test-lesson-map-editor.node.js
 *
 * Same `vm`-sandbox loading pattern as tests/test-map-editor.node.js.
 * The DOM controller is NOT covered here (no headless browser harness).
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
cargar('src/ui/mapEditor.js');
cargar('src/lessons/content.js');

// Any access to `document` while loading the module under test is a failure:
// the sandbox has none, and this getter records the attempt.
var documentTocado = false;
Object.defineProperty(sandbox, 'document', {
  get: function () { documentTocado = true; throw new Error('document tocado al cargar'); }
});
var cargaLanzo = false;
try {
  cargar('src/ui/lessonMapEditor.js');
} catch (e) {
  cargaLanzo = true;
}

var RS = sandbox.window.RS;
var pure = RS.ui.lessonMapEditor._pure;
var contenido = RS.lessons.CONTENIDO;
var contentFuente = fs.readFileSync(path.join(ROOT, 'src/lessons/content.js'), 'utf8');

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

/** Every (col,row) covered by a list of wall regions, as a sorted "c,r" list. */
function celdasCubiertas(muros) {
  var conjunto = {};
  muros.forEach(function (m) {
    for (var c = m.col; c < m.col + (m.colSpan || 1); c++) {
      for (var r = m.row; r < m.row + (m.rowSpan || 1); r++) conjunto[c + ',' + r] = true;
    }
  });
  return Object.keys(conjunto).sort();
}

/** Grid map with spans made explicit, so specs compare semantically. */
function normalizar(grid) {
  function reg(r) { return r ? [r.col, r.row, r.colSpan || 1, r.rowSpan || 1] : null; }
  return {
    version: grid.version, cols: grid.cols, rows: grid.rows,
    muros: grid.muros.map(reg),
    inicio: grid.inicio ? [grid.inicio.col, grid.inicio.row, grid.inicio.angulo || 0] : null,
    meta: reg(grid.meta)
  };
}

function mapaCon(muros, meta) {
  return { version: 1, cols: 20, rows: 15, muros: muros, inicio: { col: 1, row: 7, angulo: 0 }, meta: meta || null };
}

// ---- 0. Loading ----
assert(!cargaLanzo && !documentTocado, 'cargar lessonMapEditor.js no toca document');
assertEquals(Object.keys(RS.ui.lessonMapEditor).sort(),
  ['_pure', 'abrir', 'cargarLeccion', 'cerrar', 'estaActivo', 'init'],
  'el modulo expone _pure y la API del controlador');
assert(RS.ui.lessonMapEditor.estaActivo() === false, 'el controlador arranca inactivo (sin DOM)');

// ---- 1. partirRegion / borrarCeldaRegion: corner, edge, center ----
var region = { col: 2, row: 3, colSpan: 5, rowSpan: 4 }; // cols 2-6, rows 3-6
var todas = celdasCubiertas([region]);

function borrarYComparar(celda, nombre) {
  var mapa = mapaCon([copiaRegion(region)]);
  pure.borrarCeldaRegion(mapa, celda);
  var esperadas = todas.filter(function (k) { return k !== celda.col + ',' + celda.row; });
  assertEquals(celdasCubiertas(mapa.muros), esperadas, nombre + ': cubiertas = original menos la celda');
  return mapa;
}

function copiaRegion(r) { return JSON.parse(JSON.stringify(r)); }

var esquina = borrarYComparar({ col: 2, row: 3 }, 'esquina superior izquierda');
assertEquals(esquina.muros, [{ col: 3, row: 3, colSpan: 4 }, { col: 2, row: 4, colSpan: 5, rowSpan: 3 }],
  'esquina: sin banda superior ni left, right + banda inferior completa');
borrarYComparar({ col: 6, row: 6 }, 'esquina inferior derecha');
var borde = borrarYComparar({ col: 4, row: 3 }, 'borde superior');
assertEquals(borde.muros.length, 3, 'borde superior: left + right + banda inferior');
var centro = borrarYComparar({ col: 4, row: 5 }, 'centro');
assertEquals(centro.muros, [
  { col: 2, row: 3, colSpan: 5, rowSpan: 2 },
  { col: 2, row: 5, colSpan: 2 },
  { col: 5, row: 5, colSpan: 2 },
  { col: 2, row: 6, colSpan: 5 }
], 'centro: orden guillotina top, left, right, bottom');

// S3.1-S3.2: 1-row span
var franja = mapaCon([{ col: 2, row: 4, colSpan: 5 }]);
pure.borrarCeldaRegion(franja, { col: 4, row: 4 });
assertEquals(franja.muros, [{ col: 2, row: 4, colSpan: 2 }, { col: 5, row: 4, colSpan: 2 }], 'S3.1: borrar (4,4) deja cols 2-3 y 5-6');
var franjaExtremo = mapaCon([{ col: 2, row: 4, colSpan: 5 }]);
pure.borrarCeldaRegion(franjaExtremo, { col: 2, row: 4 });
assertEquals(franjaExtremo.muros, [{ col: 3, row: 4, colSpan: 4 }], 'S3.2: borrar la primera celda deja una franja mas corta');
var franjaUltima = mapaCon([{ col: 2, row: 4, colSpan: 5 }]);
pure.borrarCeldaRegion(franjaUltima, { col: 6, row: 4 });
assertEquals(franjaUltima.muros, [{ col: 2, row: 4, colSpan: 4 }], 'S3.2: borrar la ultima celda deja una franja mas corta');

// S3.3: 1x1
var unica = mapaCon([{ col: 9, row: 9 }]);
pure.borrarCeldaRegion(unica, { col: 9, row: 9 });
assertEquals(unica.muros, [], 'S3.3: borrar un muro 1x1 no deja muro');

// S3.4: empty cell no-op
var noop = mapaCon([{ col: 2, row: 3, colSpan: 5, rowSpan: 4 }, { col: 12, row: 1 }]);
var antes = JSON.stringify(noop);
pure.borrarCeldaRegion(noop, { col: 10, row: 10 });
assert(JSON.stringify(noop) === antes, 'S3.4: borrar una celda vacia no cambia el mapa');

// Overlapping regions + order/index kept
var solapado = mapaCon([
  { col: 0, row: 0 },
  { col: 2, row: 2, colSpan: 3 },
  { col: 3, row: 2, colSpan: 3 },
  { col: 15, row: 12 }
]);
pure.borrarCeldaRegion(solapado, { col: 3, row: 2 });
assertEquals(solapado.muros, [
  { col: 0, row: 0 },
  { col: 2, row: 2 },
  { col: 4, row: 2 },
  { col: 4, row: 2, colSpan: 2 },
  { col: 15, row: 12 }
], 'regiones solapadas: cada una se parte en su indice; el resto conserva orden');
assert(pure.celdaCubierta(solapado.muros, { col: 3, row: 2 }) === false, 'regiones solapadas: la celda borrada queda vacia');

// ---- 2. colocarMuro on covered cell is a no-op; on empty cell adds 1x1 ----
var cubierto = mapaCon([{ col: 2, row: 3, colSpan: 5, rowSpan: 4 }]);
pure.colocarMuro(cubierto, { col: 4, row: 4 });
assertEquals(cubierto.muros, [{ col: 2, row: 3, colSpan: 5, rowSpan: 4 }], 'colocarMuro sobre una celda cubierta es no-op');
pure.colocarMuro(cubierto, { col: 10, row: 10 });
assertEquals(cubierto.muros[1], { col: 10, row: 10 }, 'colocarMuro sobre una celda libre agrega un muro 1x1');

// ---- 3. establecerMetaRect ----
var metaMapa = mapaCon([]);
pure.establecerMetaRect(metaMapa, { col: 3, row: 2 }, { col: 6, row: 4 });
assertEquals(metaMapa.meta, { col: 3, row: 2, colSpan: 4, rowSpan: 3 }, 'S5.1: arrastre (3,2)->(6,4)');
pure.establecerMetaRect(metaMapa, { col: 6, row: 4 }, { col: 3, row: 2 });
assertEquals(metaMapa.meta, { col: 3, row: 2, colSpan: 4, rowSpan: 3 }, 'S5.2: arrastre inverso (6,4)->(3,2)');
pure.establecerMetaRect(metaMapa, { col: 3, row: 4 }, { col: 6, row: 2 });
assertEquals(metaMapa.meta, { col: 3, row: 2, colSpan: 4, rowSpan: 3 }, 'S5.2: arrastre en diagonal opuesta (3,4)->(6,2)');
pure.establecerMetaRect(metaMapa, { col: 5, row: 5 }, { col: 5, row: 5 });
assertEquals(metaMapa.meta, { col: 5, row: 5 }, 'S5.3: un click produce una meta 1x1');
pure.establecerMetaRect(metaMapa, { col: -3, row: -1 }, { col: 25, row: 20 });
assertEquals(metaMapa.meta, { col: 0, row: 0, colSpan: 20, rowSpan: 15 }, 'la meta se acota a los limites de la grilla');
assert(RS.gridAdapter.validar(metaMapa) === true, 'la meta acotada deja un mapa valido');

// ---- 4. erase interactions with goal and start ----
var interaccion = mapaCon([], { col: 4, row: 6, colSpan: 2, rowSpan: 2 });
pure.borrarCeldaRegion(interaccion, { col: 5, row: 7 });
assert(interaccion.meta === null, 'borrar dentro de la meta la deja en null');
var conInicio = mapaCon([{ col: 1, row: 7 }]);
pure.borrarCeldaRegion(conInicio, { col: 1, row: 7 });
assertEquals(conInicio.inicio, { col: 1, row: 7, angulo: 0 }, 'borrar nunca limpia el inicio');
pure.borrarCeldaRegion(conInicio, { col: 1, row: 7 });
assertEquals(conInicio.muros, [], 'borrar sobre la celda de inicio solo afecta muros');

// S4.1: start replaces (mapEditor's establecerInicio, reused by the tool)
var inicioMapa = mapaCon([]);
RS.ui.mapEditor._pure.establecerInicio(inicioMapa, { col: 8, row: 3 });
assertEquals(inicioMapa.inicio, { col: 8, row: 3, angulo: 0 }, 'S4.1: establecerInicio reemplaza el inicio anterior');

// ---- 5. aCodigoGrid ----
var grid1 = contenido[0].grid;
var codigo1 = pure.aCodigoGrid(grid1, 1);
assert(contentFuente.indexOf(codigo1) !== -1, 'S6.1: aCodigoGrid(L1) es un substring byte-identico de content.js');
assert(codigo1.indexOf('\r') === -1 && codigo1.charAt(codigo1.length - 1) === ';', 'export: \\n como fin de linea, sin salto final');

contenido.forEach(function (leccion) {
  var codigo = pure.aCodigoGrid(leccion.grid, leccion.id);
  var evaluado = vm.runInNewContext(codigo + '\nGRID_LECCION_' + leccion.id);
  assertEquals(normalizar(evaluado), normalizar(leccion.grid), 'S6.1: leccion ' + leccion.id + ' hace round trip (eval + deep-equal)');
});

var vacio = mapaCon([]);
vacio.inicio = null;
var codigoVacio = pure.aCodigoGrid(vacio, 9);
assert(codigoVacio.indexOf('muros: [],') !== -1, 'S6.2: grilla vacia imprime muros: [],');
assert(codigoVacio.indexOf('inicio: null,') !== -1, 'S6.2: sin inicio imprime inicio: null');
assert(/meta: null\n/.test(codigoVacio), 'S6.2: sin meta imprime meta: null');
var evaluadoVacio = vm.runInNewContext(codigoVacio + '\nGRID_LECCION_9');
assert(evaluadoVacio.inicio === null && evaluadoVacio.meta === null && evaluadoVacio.muros.length === 0,
  'S6.2: el codigo vacio evalua a muros [], inicio null, meta null');

var spans = pure.aCodigoGrid(mapaCon([{ col: 1, row: 1 }, { col: 3, row: 3, colSpan: 3 }]), 2);
assert(spans.indexOf('{ col: 1, row: 1 }') !== -1, 'S6.3: el muro de 1 celda no lleva spans');
assert(spans.indexOf('{ col: 3, row: 3, colSpan: 3 }') !== -1, 'S6.3: el muro de 3 celdas lleva su span');
assert(!/rowSpan/.test(spans) && (spans.match(/colSpan/g) || []).length === 1, 'S6.3: solo la entrada de 3 celdas contiene un span');

var raro = mapaCon([{ col: 0, row: 0, colSpan: 20, rowSpan: 15 }], { col: 19, row: 14 });
var textoRaro = null;
try { textoRaro = pure.aCodigoGrid(raro, 5); } catch (e) { textoRaro = null; }
assert(typeof textoRaro === 'string' && textoRaro.length > 0, 'S6.4: un mapa inalcanzable exporta igual, sin error');

// ---- 6. aPixeles(grid) matches lesson.mapa; the working copy is isolated ----
contenido.forEach(function (leccion) {
  assertEquals(RS.gridAdapter.aPixeles(leccion.grid), leccion.mapa, 'S2.2: aPixeles(leccion ' + leccion.id + '.grid) coincide con leccion.mapa');
});

var original = JSON.stringify(contenido[0].grid);
var copia = pure.copiaProfunda(contenido[0].grid);
pure.borrarCeldaRegion(copia, { col: 8, row: 6 });
pure.colocarMuro(copia, { col: 0, row: 0 });
pure.establecerMetaRect(copia, { col: 1, row: 1 }, { col: 2, row: 2 });
assert(JSON.stringify(contenido[0].grid) === original, 'S2.2: editar la copia no altera leccion.grid');
assert(copia !== contenido[0].grid && copia.muros !== contenido[0].grid.muros, 'copiaProfunda devuelve estructuras independientes');

console.log('');
console.log(total + ' pruebas, ' + fallidos + ' fallidas');
if (fallidos > 0) {
  process.exit(1);
}
