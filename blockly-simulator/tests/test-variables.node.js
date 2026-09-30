/**
 * Headless Node test for the program-variables engine: interpreter semantics
 * (declarar/asignar/cambiar, flat environment, int truncation, ms clamp),
 * scheduler metric, C++ hoisting and pre-run validation. No browser, no test
 * framework — run directly:
 *
 *   node tests/test-variables.node.js
 *
 * Same `vm`-sandbox loading pattern as tests/test-detener-por-siempre.node.js.
 * `window.Blockly` is a minimal stub that records what each block's `init`
 * declares; it includes FieldTextInput, which the variable blocks use.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var sandbox = { window: {}, console: console };
vm.createContext(sandbox);

sandbox.window.Blockly = {
  Blocks: {},
  FieldNumber: function () {},
  FieldDropdown: function () {},
  FieldTextInput: function () {}
};

function cargar(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}
['config', 'sim/world', 'sim/gridAdapter', 'sim/robot', 'sim/sensors', 'runtime/interpreter',
  'runtime/scheduler', 'generator/cpp-view'
].forEach(function (m) { cargar('src/' + m + '.js'); });

var RS = sandbox.window.RS;
var total = 0;
var fallidos = 0;

function assert(cond, mensaje) {
  total++;
  if (!cond) fallidos++;
  console.log((cond ? 'PASS ' : 'FAIL ') + mensaje);
}

function assertEquals(actual, esperado, mensaje) {
  var ok = JSON.stringify(actual) === JSON.stringify(esperado);
  assert(ok, mensaje + (ok ? '' : ' - esperado ' + JSON.stringify(esperado) + ', obtuvo ' + JSON.stringify(actual)));
}

// Program-tree helpers (same node shapes as src/generator/program-tree.js).
function num(v) { return { k: 'numero', v: v }; }
function bool(v) { return { k: 'booleano', v: v }; }
function vr(nombre) { return { k: 'variable', nombre: nombre }; }
function acc(accion, id, valor) { return { tipo: 'accion', accion: accion, valor: valor, blockId: id }; }
function decl(nombre, tipoDato, valor, id) {
  return { tipo: 'declarar', nombre: nombre, tipoDato: tipoDato, valor: valor, blockId: id || 'd_' + nombre };
}
function asig(nombre, valor, id) { return { tipo: 'asignar', nombre: nombre, valor: valor, blockId: id || 'a_' + nombre }; }
function camb(nombre, delta, id) { return { tipo: 'cambiar', nombre: nombre, delta: delta, blockId: id || 'c_' + nombre }; }
function repetir(veces, cuerpo) { return { tipo: 'repetir', veces: veces, cuerpo: cuerpo, blockId: 'r' }; }
function siSinoVar(nombre, cuerpo, sino) {
  return { tipo: 'si_sino', condicion: vr(nombre), cuerpo: cuerpo, sino: sino, blockId: 'ss' };
}
function siVar(nombre, cuerpo) { return { tipo: 'si', condicion: vr(nombre), cuerpo: cuerpo, blockId: 'si' }; }

/** Walks `arbol` with the real interpreter; returns the leaf actions in order. */
function hojas(arbol) {
  var walker = RS.runtime.interpreter.crear(arbol, null, null, null);
  var out = [];
  var leaf;
  var guardia = 0;
  while ((leaf = walker.siguienteNodo()) !== null && guardia++ < 1000) out.push(leaf);
  return { hojas: out, walker: walker };
}

function valores(arbol) {
  return hojas(arbol).hojas.map(function (h) { return h.valor; });
}

// ---------------------------------------------------------------------
// Interpreter semantics
// ---------------------------------------------------------------------

// 5.2 Reset on redeclare inside a repetir body.
assertEquals(valores([
  repetir(3, [
    decl('t', 'int', num(10)),
    camb('t', 5),
    acc('avanzar', 'x', vr('t'))
  ])
]), [15, 15, 15], 'declarar dentro de repetir reinicia el valor en cada vuelta');

// Declared before the loop: the value accumulates.
assertEquals(valores([
  decl('t', 'int', num(10)),
  repetir(3, [camb('t', 5), acc('avanzar', 'x', vr('t'))])
]), [15, 20, 25], 'declarar antes del repetir acumula entre vueltas');

// 5.3 Reassignment inside si_sino persists to later nodes.
assertEquals(valores([
  decl('activo', 'bool', bool(false)),
  siSinoVar('activo', [acc('avanzar', 'x', 111)], [asig('activo', bool(true)), acc('avanzar', 'x', 222)]),
  siSinoVar('activo', [acc('avanzar', 'x', 333)], [acc('avanzar', 'x', 444)])
]), [222, 333], 'asignar dentro de si_sino persiste para el si_sino siguiente');

assertEquals(valores([
  decl('lados', 'int', num(0)),
  repetir(2, [
    siVar('ignorada', [acc('avanzar', 'x', 1)]),
    camb('lados', 2)
  ]),
  acc('avanzar', 'x', vr('lados'))
]), [4], 'cambiar dentro de repetir es visible fuera del bucle');

// 5.4 Int truncation and zero default for an unexecuted declare.
assertEquals(valores([
  decl('a', 'int', num(7.9)),
  acc('avanzar', 'x', vr('a'))
]), [7], 'un int trunca su valor inicial decimal');

assertEquals(valores([
  decl('b', 'int', num(-2.7)),
  acc('avanzar', 'x', vr('b'))
]), [0], 'un int negativo usado como ms se recorta a 0');

assertEquals(valores([
  siVar('nunca', [decl('z', 'int', num(9))]),
  acc('avanzar', 'x', vr('z'))
]), [0], 'un declarar que nunca se ejecuta deja el valor en cero');

assertEquals(valores([
  decl('flag', 'bool', num(0)),
  siSinoVar('flag', [acc('avanzar', 'x', 1)], [acc('avanzar', 'x', 2)])
]), [2], 'un bool coacciona un valor numerico 0 a falso');

// 5.5 max(0, ...) clamp on variable-driven action ms.
assertEquals(valores([
  decl('p', 'int', num(5)),
  camb('p', -20),
  acc('avanzar', 'x', vr('p'))
]), [0], 'una duracion de accion negativa proveniente de una variable se recorta a 0');

assertEquals(valores([acc('avanzar', 'x', 250)]), [250], 'una duracion numerica literal no cambia');

// cambiosVariable counts asignar + cambiar, not declarar.
(function () {
  var r = hojas([
    decl('n', 'int', num(0)),
    asig('n', num(3)),
    camb('n', 1),
    acc('avanzar', 'x', vr('n'))
  ]);
  assertEquals(r.hojas.map(function (h) { return h.valor; }), [4], 'asignar y luego cambiar acumulan sobre la misma variable');
  assertEquals(r.walker.cambiosVariable(), 2, 'cambiosVariable cuenta asignar y cambiar pero no declarar');
})();

// Variable-only comparisons are not sensor readings.
(function () {
  var evals = 0;
  var walker = RS.runtime.interpreter.crear([
    decl('lados', 'int', num(0)),
    { tipo: 'repetir_hasta', condicion: { op: '>=', izq: vr('lados'), der: num(2) },
      cuerpo: [camb('lados', 1), acc('avanzar', 'x', 10)], blockId: 'rh' }
  ], null, null, function () { evals++; });
  var n = 0;
  while (walker.siguienteNodo() !== null && n++ < 50) { /* drain */ }
  assertEquals(n, 2, 'repetir_hasta con variable itera hasta cumplir la condicion');
  assertEquals(evals, 0, 'una comparacion solo con variables no dispara onSensorEval');
})();

// Scheduler exposes the metric.
(function () {
  var sch = RS.runtime.scheduler;
  RS.world.cargarMapa({ obstaculos: [], limites: { x: 0, y: 0, w: 800, h: 600 } });
  sch.reiniciar();
  sch.iniciarConArbol([decl('c', 'int', num(0)), camb('c', 1), asig('c', num(5)), acc('esperar', 'e', 16)]);
  for (var i = 0; i < 50 && sch.obtenerEstado() === 'running'; i++) sch._procesarFrame(16);
  assertEquals(sch.obtenerMetricas().cambiosVariable, 2, 'scheduler.obtenerMetricas().cambiosVariable refleja el recorrido');
  sch.reiniciar();
})();

// ---------------------------------------------------------------------
// C++ generator
// ---------------------------------------------------------------------
var arbolCpp = [
  decl('lados', 'int', num(0), 'B1'),
  decl('activo', 'bool', bool(true), 'B2'),
  repetir(4, [
    decl('lados', 'int', num(1), 'B3'),
    camb('lados', 1, 'B4'),
    camb('lados', -2, 'B5'),
    asig('activo', bool(false), 'B6'),
    acc('avanzar', 'B7', vr('lados'))
  ])
];
var cpp = RS.cppView.render(arbolCpp);
var cppTexto = RS.cppView.renderTexto(arbolCpp);

// 5.6 Hoisting: one global per name, placed after the header, in pre-order.
assertEquals((cppTexto.match(/^int lados;$/gm) || []).length, 1, 'C++: una sola declaracion global por nombre (aunque haya dos declarar)');
assertEquals((cppTexto.match(/^bool activo;$/gm) || []).length, 1, 'C++: variable bool declarada una vez como global');
assert(cppTexto.indexOf('int lados;') < cppTexto.indexOf('bool activo;'), 'C++: los globales siguen el orden de primera aparicion');
assert(cppTexto.indexOf('const int VELOCIDAD') < cppTexto.indexOf('int lados;') &&
  cppTexto.indexOf('int lados;') < cppTexto.indexOf('void detener()'), 'C++: los globales van despues de la cabecera y antes de las funciones');
assert(cpp.lineas.filter(function (l) { return l.seccion === 'variables'; })
  .every(function (l) { return l.blockId === null; }), 'C++: las lineas de la seccion variables no llevan blockId');

function lineaDe(id) {
  var ns = cpp.lineasPorBloque[id];
  return ns && cpp.lineas[ns[0] - 1];
}
assertEquals(lineaDe('B1').texto, 'lados = 0;', 'C++: declarar emite la asignacion inicial en su posicion');
assertEquals(lineaDe('B2').texto, 'activo = true;', 'C++: declarar bool emite true/false');
assertEquals(lineaDe('B3').texto, 'lados = 1;', 'C++: declarar dentro del bucle reinicia la variable en cada vuelta');
assertEquals(lineaDe('B4').texto, 'lados += 1;', 'C++: cambiar con delta positivo usa +=');
assertEquals(lineaDe('B5').texto, 'lados -= 2;', 'C++: cambiar con delta negativo usa -=');
assertEquals(lineaDe('B6').texto, 'activo = false;', 'C++: asignar emite una asignacion real');
assertEquals(lineaDe('B7').texto, 'avanzar(max(0, lados));', 'C++: duracion desde variable se recorta con max(0, x)');
assert(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'].every(function (id) {
  return cpp.lineasPorBloque[id] && cpp.lineasPorBloque[id].length === 1 &&
    cpp.bloquePorLinea[cpp.lineasPorBloque[id][0]] === id;
}), 'C++: cada blockId de variable mapea a exactamente una linea (paridad bloque-linea)');
assert(cppTexto.indexOf('  lados = 1;') > cppTexto.indexOf('int lados;'), 'C++: la asignacion del declarar aparece despues del global');

// Conditions and comparisons rendered from variables.
var cppCond = RS.cppView.renderTexto([
  decl('n1', 'int', num(0)),
  decl('b1', 'bool', bool(false)),
  { tipo: 'repetir_hasta', condicion: { op: '>=', izq: vr('n1'), der: num(3) }, cuerpo: [camb('n1', 1)], blockId: 'h' },
  { tipo: 'si', condicion: vr('b1'), cuerpo: [], blockId: 's' },
  { tipo: 'si_sino', condicion: bool(true), cuerpo: [], sino: [], blockId: 'ss' },
  decl('b2', 'bool', { k: 'comparar', op: '<', izq: { k: 'medirDistancia' }, der: vr('n1') })
]);
assert(cppCond.indexOf('!(n1 >= 3)') !== -1, 'C++: repetir_hasta renderiza una comparacion con variable');
assert(cppCond.indexOf('if (b1) {') !== -1, 'C++: una variable bool sola funciona como condicion');
assert(cppCond.indexOf('if (true) {') !== -1, 'C++: un literal booleano funciona como condicion');
assert(cppCond.indexOf('b2 = (medirDistancia() < n1);') !== -1, 'C++: un comparar como valor se renderiza entre parentesis');

// Variable-free output carries no variables section at all.
assert(RS.cppView.render([acc('avanzar', 'x', 100)]).lineas.every(function (l) { return l.seccion !== 'variables'; }),
  'C++: sin variables no se emite la seccion variables');

// Reserved names.
['i', 'j', 'k', 'm', 'n', 'i5', 'i12', 'ENA', 'VELOCIDAD', 'setup', 'loop', 'delay', 'max', 'int', 'bool', 'true',
  'avanzar', 'girarIzquierda', 'detener', 'medirDistancia', 'hayObstaculo', 'HIGH'].forEach(function (nombre) {
  assert(RS.cppView.esNombreReservado(nombre) === true, 'esNombreReservado rechaza "' + nombre + '"');
});
['lados', 'contador', 'bandera', 'I', 'Loop', 'i_2', 'iter'].forEach(function (nombre) {
  assert(RS.cppView.esNombreReservado(nombre) === false, 'esNombreReservado acepta "' + nombre + '" (sensible a mayusculas)');
});

// 5.7 usaSensor is true via an Expr-only sensor reference (no si/repetir_hasta).
var sinSensor = RS.cppView.renderTexto([decl('d', 'int', num(3)), acc('avanzar', 'x', vr('d'))]);
assert(sinSensor.indexOf('medirDistancia') === -1, 'usaSensor: un programa con variables pero sin sensor no emite el driver');
var viaDeclarar = RS.cppView.renderTexto([decl('dist', 'int', { k: 'medirDistancia' }), acc('avanzar', 'x', vr('dist'))]);
assert(viaDeclarar.indexOf('int medirDistancia()') !== -1, 'usaSensor: declarar con medirDistancia() emite el driver del sensor');
var viaAsignar = RS.cppView.renderTexto([decl('ob', 'bool', bool(false)), asig('ob', { k: 'hayObstaculo' })]);
assert(viaAsignar.indexOf('bool hayObstaculo()') !== -1, 'usaSensor: asignar con hayObstaculo() emite el driver del sensor');
var viaAnidado = RS.cppView.renderTexto([repetir(2, [decl('dd', 'int', { k: 'medirDistancia' })])]);
assert(viaAnidado.indexOf('int medirDistancia()') !== -1, 'usaSensor: detecta el sensor dentro de un repetir');
var viaComparar = RS.cppView.renderTexto([decl('q', 'bool', { k: 'comparar', op: '<', izq: { k: 'medirDistancia' }, der: num(30) })]);
assert(viaComparar.indexOf('int medirDistancia()') !== -1, 'usaSensor: detecta el sensor dentro de un comparar anidado');

// ---------------------------------------------------------------------
console.log('\n' + (fallidos === 0 ? 'TODOS LOS TESTS PASARON' : fallidos + ' TESTS FALLARON') + ' (' + (total - fallidos) + '/' + total + ')');
process.exit(fallidos === 0 ? 0 : 1);
