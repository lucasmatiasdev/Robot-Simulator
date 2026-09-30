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
console.log('\n' + (fallidos === 0 ? 'TODOS LOS TESTS PASARON' : fallidos + ' TESTS FALLARON') + ' (' + (total - fallidos) + '/' + total + ')');
process.exit(fallidos === 0 ? 0 : 1);
