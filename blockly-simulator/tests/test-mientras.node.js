/**
 * Headless Node test for the `mientras` (while) loop and the
 * `noHayObstaculo` sensor: block shapes, program-tree mapping, interpreter
 * semantics (pre-test, tick, salir unwinding), validarSalir and the C++ view.
 * Run directly:
 *
 *   node tests/test-mientras.node.js
 *
 * Same `vm`-sandbox loading pattern as tests/test-detener-por-siempre.node.js.
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
  FieldDropdown: function () {}
};

function cargar(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}
['config', 'sim/world', 'sim/gridAdapter', 'sim/robot', 'sim/sensors', 'runtime/interpreter',
  'runtime/scheduler', 'blocks/definitions', 'generator/program-tree', 'generator/cpp-view'
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
function mot(accion, id) { return { tipo: 'accion', accion: accion, blockId: id }; }
function esp(id, ms) { return { tipo: 'accion', accion: 'esperar', valor: ms, blockId: id }; }
function salir(id) { return { tipo: 'salir', blockId: id }; }
var VERDADERO = { k: 'booleano', v: true };
var FALSO = { k: 'booleano', v: false };
function mientras(id, condicion, cuerpo) { return { tipo: 'mientras', condicion: condicion, cuerpo: cuerpo, blockId: id }; }
function mientrasSensor(id, sensor, cuerpo) { return { tipo: 'mientras', sensor: sensor, cuerpo: cuerpo, blockId: id }; }
function siSino(id, sensor, cuerpo, sino) { return { tipo: 'si_sino', sensor: sensor, cuerpo: cuerpo, sino: sino, blockId: id }; }

function caminar(arbol) {
  return RS.runtime.interpreter.crear(arbol, RS.world, RS.robot.estado, null);
}

/** Drains up to `max` leaves as short labels: accion name, or "tick". */
function etiquetas(w, max) {
  var out = [];
  var n = w.siguienteNodo();
  while (n !== null && out.length < max) {
    out.push(n.tipo === 'tick' ? 'tick' : n.accion);
    n = w.siguienteNodo();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Block shapes
// ---------------------------------------------------------------------------
function inspeccionar(tipo) {
  var info = { prev: null, next: null, inputs: [], output: null };
  var entrada = { setCheck: function () { return entrada; }, appendField: function () { return entrada; } };
  var bloque = {
    appendValueInput: function (n) { info.inputs.push('valor:' + n); return entrada; },
    appendDummyInput: function () { return entrada; },
    appendStatementInput: function (n) { info.inputs.push('sentencia:' + n); return entrada; },
    setPreviousStatement: function (v) { info.prev = v; },
    setNextStatement: function (v) { info.next = v; },
    setOutput: function (v, t) { info.output = t; },
    setColour: function (c) { info.colour = c; },
    setTooltip: function () {},
    setInputsInline: function () {}
  };
  sandbox.window.Blockly.Blocks[tipo].init.call(bloque);
  return info;
}

var infoMientras = inspeccionar('rs_mientras');
assertEquals(infoMientras.inputs, ['valor:COND', 'sentencia:DO'], 'rs_mientras tiene la condicion COND y el cuerpo DO');
assert(infoMientras.prev === true && infoMientras.next === true, 'rs_mientras es encadenable');
assertEquals(infoMientras.colour, inspeccionar('rs_repetir').colour, 'rs_mientras usa el color de Repeticion');
assert(RS.blocks.REPETICION_TYPES.indexOf('rs_mientras') !== -1, 'rs_mientras pertenece a REPETICION_TYPES');
var infoNoHay = inspeccionar('rs_no_hay_obstaculo');
assertEquals(infoNoHay.output, 'Boolean', 'rs_no_hay_obstaculo es un reporter Boolean');
assertEquals(infoNoHay.colour, inspeccionar('rs_hay_obstaculo').colour, 'rs_no_hay_obstaculo usa el color de Sensores');
assert(RS.blocks.SENSOR_TYPES.indexOf('rs_no_hay_obstaculo') !== -1, 'rs_no_hay_obstaculo pertenece a SENSOR_TYPES');

// ---------------------------------------------------------------------------
// Program tree
// ---------------------------------------------------------------------------
function bloqueFalso(type, id, opciones) {
  opciones = opciones || {};
  return {
    type: type,
    id: id,
    getInputTargetBlock: function (nombre) {
      if (nombre === 'DO') return opciones.hijoDo || null;
      if (nombre === 'COND') return opciones.cond || null;
      return null;
    },
    getNextBlock: function () { return opciones.siguiente || null; },
    getFieldValue: function (campo) { return opciones.campos && opciones.campos[campo] !== undefined ? opciones.campos[campo] : null; },
    outputConnection: type.indexOf('rs_booleano') === 0 || /hay_obstaculo/.test(type) ? {} : null
  };
}
function arbolDe(raiz) { return RS.generator.buildProgramTree({ getTopBlocks: function () { return [raiz]; } }); }

var cuerpoFalso = bloqueFalso('rs_avanzar', 'a1');
var verdaderoFalso = bloqueFalso('rs_booleano', 'b1', { campos: { BOOL: 'TRUE' } });
assertEquals(arbolDe(bloqueFalso('rs_mientras', 'm1', { cond: verdaderoFalso, hijoDo: cuerpoFalso })),
  [{ tipo: 'mientras', cuerpo: [{ tipo: 'accion', accion: 'avanzar', blockId: 'a1' }], blockId: 'm1', condicion: { k: 'booleano', v: true } }],
  'buildProgramTree: mientras(verdadero) produce {tipo:"mientras", condicion, cuerpo}');
assertEquals(arbolDe(bloqueFalso('rs_mientras', 'm2', { cond: bloqueFalso('rs_no_hay_obstaculo', 'n1'), hijoDo: cuerpoFalso }))[0].sensor,
  'noHayObstaculo', 'buildProgramTree: mientras(noHayObstaculo) produce sensor:"noHayObstaculo"');
assertEquals(arbolDe(bloqueFalso('rs_mientras', 'm3', { cond: bloqueFalso('rs_hay_obstaculo', 'h1'), hijoDo: cuerpoFalso }))[0].sensor,
  'hayObstaculo', 'buildProgramTree: mientras(hayObstaculo) produce sensor:"hayObstaculo"');
assertEquals(arbolDe(bloqueFalso('rs_si_obstaculo', 's1', { cond: bloqueFalso('rs_no_hay_obstaculo', 'n2'), hijoDo: cuerpoFalso }))[0].sensor,
  'noHayObstaculo', 'buildProgramTree: si(noHayObstaculo) tambien usa el sensor noHayObstaculo');
var comparador = bloqueFalso('rs_comparar', 'c1', { campos: { OP: '==' } });
comparador.getInputTargetBlock = function (n) { return n === 'IZQ' ? bloqueFalso('rs_no_hay_obstaculo', 'n3') : null; };
assertEquals(arbolDe(bloqueFalso('rs_si_obstaculo', 's2', { cond: comparador }))[0].condicion.izq,
  { k: 'noHayObstaculo' }, 'buildProgramTree: noHayObstaculo como operando es {k:"noHayObstaculo"}');

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------
var w = caminar([mientras('m', VERDADERO, [mot('avanzar', 'a')])]);
assertEquals(etiquetas(w, 6), ['avanzar', 'tick', 'avanzar', 'tick', 'avanzar', 'tick'], 'mientras(true) { avanzar }: un tick tras cada pasada del cuerpo');
w = caminar([mientras('m', VERDADERO, []), mot('avanzar', 'despues')]);
assertEquals(etiquetas(w, 2000), Array(2000).fill('tick'), 'mientras(true) vacio: emite ticks sin tope y nunca devuelve null ni continua');
assertEquals(caminar([mientras('m', VERDADERO, [])]).siguienteNodo(), { tipo: 'tick', valor: 1, blockId: 'm' }, 'el tick del mientras lleva LOOP_TICK_MS y su blockId');
w = caminar([mientras('m', FALSO, [mot('avanzar', 'a')]), mot('izquierda', 'g')]);
assertEquals(etiquetas(w, 10), ['izquierda'], 'mientras(false): cero vueltas, sigue con el bloque siguiente');

// Salir unwinds mientras -> si_sino.
w = caminar([mientras('m', VERDADERO, [siSino('ss', 'hayObstaculo', [], [salir('s')]), mot('avanzar', 'x')]), mot('izquierda', 'g')]);
assertEquals(etiquetas(w, 10), ['izquierda'], 'Salir dentro de si_sino dentro de mientras: sale del mientras y sigue');
w = caminar([mientras('ext', VERDADERO, [mientras('int', VERDADERO, [salir('s')]), mot('avanzar', 'x')])]);
assertEquals(etiquetas(w, 6), ['avanzar', 'tick', 'avanzar', 'tick', 'avanzar', 'tick'], 'Salir anidado: solo sale el mientras interno');

// Sensor-driven conditions against a real wall.
function robotA(x, y, angulo) {
  RS.world.cargarMapa({});
  RS.robot.reset();
  RS.robot.estado.x = x;
  RS.robot.estado.y = y;
  RS.robot.estado.angulo = angulo;
}
function evaluarEn(x, y, angulo, arbol, max) {
  robotA(x, y, angulo);
  var vistos = [];
  var wk = RS.runtime.interpreter.crear(arbol, RS.world, RS.robot.estado, function (n, r) { vistos.push([n, r]); });
  return { etiquetas: etiquetas(wk, max), vistos: vistos };
}
var XPEGADO = RS.config.WORLD_WIDTH - 5;
robotA(XPEGADO, 300, 0);
assert(RS.sensors.hayObstaculo(RS.world, RS.robot.estado) === true, 'precondicion: pegado al borde derecho hayObstaculo() es true');
var lejos = evaluarEn(60, 300, 0, [mientrasSensor('m', 'noHayObstaculo', [mot('avanzar', 'a')]), mot('izquierda', 'g')], 4);
assertEquals(lejos.etiquetas.slice(0, 2), ['avanzar', 'tick'], 'mientras noHayObstaculo: itera con el camino libre');
assert(lejos.vistos.length > 0 && lejos.vistos[0][0] === 'noHayObstaculo' && lejos.vistos[0][1] === true, 'noHayObstaculo notifica onSensorEval con resultado true en campo libre');
var pegado = evaluarEn(XPEGADO, 300, 0, [mientrasSensor('m', 'noHayObstaculo', [mot('avanzar', 'a')]), mot('izquierda', 'g')], 4);
assertEquals(pegado.etiquetas, ['izquierda'], 'mientras noHayObstaculo: ante un obstaculo no entra y sigue');
assertEquals(pegado.vistos[0], ['noHayObstaculo', false], 'noHayObstaculo ante un obstaculo notifica false');

// ---------------------------------------------------------------------------
// validarSalir
// ---------------------------------------------------------------------------
assert(RS.generator.validarSalir([mientras('m', VERDADERO, [salir('s')])]).ok === true, 'validarSalir: Salir dentro de mientras es valido');
assert(RS.generator.validarSalir([mientras('m', VERDADERO, [siSino('ss', 'hayObstaculo', [salir('s')], [])])]).ok === true,
  'validarSalir: Salir dentro de si_sino dentro de mientras es valido');
var rFuera = RS.generator.validarSalir([salir('s')]);
assert(rFuera.ok === false && rFuera.mensaje.indexOf('mientras') !== -1, 'el mensaje de Salir fuera de un bucle nombra mientras');

// ---------------------------------------------------------------------------
// Variable validation sees mientras conditions and noHayObstaculo operands
// ---------------------------------------------------------------------------
var rVar = RS.generator.validarVariables([mientras('m', { k: 'variable', nombre: 'x' }, [])]);
assert(rVar.ok === false, 'validarVariables: una variable sin declarar en la condicion de mientras se rechaza');
assert(RS.generator.validarVariables([mientrasSensor('m', 'noHayObstaculo', [])]).ok === true, 'validarVariables: mientras noHayObstaculo es valido');

// ---------------------------------------------------------------------------
// C++ view
// ---------------------------------------------------------------------------
var cppTrue = RS.cppView.render([mientras('m', VERDADERO, [mot('avanzar', 'a')])]);
var lineaTrue = cppTrue.lineas.filter(function (l) { return l.blockId === 'm'; })[0];
assertEquals(lineaTrue.texto, 'while (true) {', 'C++: mientras(verdadero) se renderiza como while (true) {');
var cppNoHay = RS.cppView.render([mientrasSensor('m', 'noHayObstaculo', [mot('avanzar', 'a')])]);
var lineaNoHay = cppNoHay.lineas.filter(function (l) { return l.blockId === 'm'; })[0];
assertEquals(lineaNoHay.texto, 'while (!hayObstaculo()) {', 'C++: mientras noHayObstaculo se renderiza como while (!hayObstaculo()) {');
assert(RS.cppView.renderTexto([mientrasSensor('m', 'noHayObstaculo', [])]).indexOf('bool hayObstaculo()') !== -1, 'C++: mientras con sensor emite la seccion de sensores');
assert(RS.cppView.renderTexto([siSino('ss', 'noHayObstaculo', [], [])]).indexOf('if (!hayObstaculo()) {') !== -1, 'C++: si_sino noHayObstaculo se renderiza como if (!hayObstaculo()) {');
assert(RS.cppView.renderTexto([{ tipo: 'declarar', nombre: 'libre', tipoDato: 'bool', valor: { k: 'noHayObstaculo' }, blockId: 'd' }]).indexOf('libre = !hayObstaculo();') !== -1,
  'C++: noHayObstaculo como valor se renderiza como !hayObstaculo()');

console.log('\n' + (fallidos === 0 ? 'TODOS LOS TESTS PASARON (' + total + '/' + total + ')' : fallidos + ' de ' + total + ' tests fallaron'));
process.exit(fallidos === 0 ? 0 : 1);
