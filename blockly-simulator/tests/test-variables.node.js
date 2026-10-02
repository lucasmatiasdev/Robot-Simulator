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
  FieldTextInput: function (valor, validador) { this.valor = valor; this.validador = validador; }
};

function cargar(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}
['config', 'sim/world', 'sim/gridAdapter', 'sim/robot', 'sim/sensors', 'runtime/interpreter',
  'runtime/scheduler', 'blocks/definitions', 'generator/cpp-view', 'generator/program-tree'
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
  while ((leaf = walker.siguienteNodo()) !== null && guardia++ < 1000) {
    if (leaf.tipo !== 'tick') out.push(leaf); // implicit loop ticks are not program leaves
  }
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
    acc('esperar', 'x', vr('t'))
  ])
]), [15, 15, 15], 'declarar dentro de repetir reinicia el valor en cada vuelta');

// Declared before the loop: the value accumulates.
assertEquals(valores([
  decl('t', 'int', num(10)),
  repetir(3, [camb('t', 5), acc('esperar', 'x', vr('t'))])
]), [15, 20, 25], 'declarar antes del repetir acumula entre vueltas');

// 5.3 Reassignment inside si_sino persists to later nodes.
assertEquals(valores([
  decl('activo', 'bool', bool(false)),
  siSinoVar('activo', [acc('esperar', 'x', 111)], [asig('activo', bool(true)), acc('esperar', 'x', 222)]),
  siSinoVar('activo', [acc('esperar', 'x', 333)], [acc('esperar', 'x', 444)])
]), [222, 333], 'asignar dentro de si_sino persiste para el si_sino siguiente');

assertEquals(valores([
  decl('lados', 'int', num(0)),
  repetir(2, [
    siVar('ignorada', [acc('esperar', 'x', 1)]),
    camb('lados', 2)
  ]),
  acc('esperar', 'x', vr('lados'))
]), [4], 'cambiar dentro de repetir es visible fuera del bucle');

// 5.4 Int truncation and zero default for an unexecuted declare.
assertEquals(valores([
  decl('a', 'int', num(7.9)),
  acc('esperar', 'x', vr('a'))
]), [7], 'un int trunca su valor inicial decimal');

assertEquals(valores([
  decl('b', 'int', num(-2.7)),
  acc('esperar', 'x', vr('b'))
]), [0], 'un int negativo usado como ms se recorta a 0');

assertEquals(valores([
  siVar('nunca', [decl('z', 'int', num(9))]),
  acc('esperar', 'x', vr('z'))
]), [0], 'un declarar que nunca se ejecuta deja el valor en cero');

assertEquals(valores([
  decl('flag', 'bool', num(0)),
  siSinoVar('flag', [acc('esperar', 'x', 1)], [acc('esperar', 'x', 2)])
]), [2], 'un bool coacciona un valor numerico 0 a falso');

// 5.5 max(0, ...) clamp on variable-driven action ms.
assertEquals(valores([
  decl('p', 'int', num(5)),
  camb('p', -20),
  acc('esperar', 'x', vr('p'))
]), [0], 'una duracion de accion negativa proveniente de una variable se recorta a 0');

assertEquals(valores([acc('esperar', 'x', 250)]), [250], 'una duracion numerica literal no cambia');

// cambiosVariable counts asignar + cambiar, not declarar.
(function () {
  var r = hojas([
    decl('n', 'int', num(0)),
    asig('n', num(3)),
    camb('n', 1),
    acc('esperar', 'x', vr('n'))
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
      cuerpo: [camb('lados', 1), acc('esperar', 'x', 10)], blockId: 'rh' }
  ], null, null, function () { evals++; });
  var n = 0;
  var hoja;
  while ((hoja = walker.siguienteNodo()) !== null && n < 50) { if (hoja.tipo !== 'tick') n++; }
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
    acc('esperar', 'B7', vr('lados'))
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
assertEquals(lineaDe('B7').texto, 'delay(max(0, lados));', 'C++: duracion desde variable se recorta con max(0, x)');
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
// Blocks: shapes and the NOMBRE normaliser
// ---------------------------------------------------------------------
function bloqueStub(tipo) {
  var b = { campos: [], entradas: {}, checks: {}, salida: undefined, previo: false, siguiente: false };
  function entrada(nombre) {
    var e = {
      setCheck: function (c) { b.checks[nombre] = c; return e; },
      appendField: function () { return e; }
    };
    b.entradas[nombre] = e;
    return e;
  }
  b.appendValueInput = entrada;
  b.appendStatementInput = entrada;
  b.appendDummyInput = function () {
    var e = { appendField: function (campo, nombre) { if (nombre) b.campos.push(nombre); return e; } };
    return e;
  };
  b.setInputsInline = function () {};
  b.setPreviousStatement = function (v) { b.previo = v; };
  b.setNextStatement = function (v) { b.siguiente = v; };
  b.setOutput = function (v, c) { b.salida = c; };
  b.setColour = function (c) { b.color = c; };
  b.setTooltip = function () {};
  sandbox.window.Blockly.Blocks[tipo].init.call(b);
  return b;
}

RS.blocks.VARIABLES_TYPES.forEach(function (tipo) {
  assert(typeof sandbox.window.Blockly.Blocks[tipo] === 'object', 'bloque ' + tipo + ' esta definido y en VARIABLES_TYPES');
});
assertEquals(RS.blocks.VARIABLES_TYPES.length, 5, 'VARIABLES_TYPES lista los 5 bloques de variables');

var bDecl = bloqueStub('rs_declarar_variable');
assertEquals(bDecl.checks.VALOR, ['Number', 'Boolean'], 'declarar acepta Number y Boolean en VALOR');
assert(bDecl.previo === true && bDecl.siguiente === true && bDecl.color === 330, 'declarar es un bloque de sentencia encadenable color 330');
var bObt = bloqueStub('rs_obtener_variable');
assertEquals(bObt.salida, ['Number', 'Boolean'], 'obtener es un reporter Number/Boolean');
assertEquals(bloqueStub('rs_booleano').salida, 'Boolean', 'booleano es un reporter Boolean');
assertEquals(bloqueStub('rs_cambiar_variable').campos, ['NOMBRE', 'DELTA'], 'cambiar tiene campos NOMBRE y DELTA');
assert(bloqueStub('rs_asignar_variable').entradas.VALOR !== undefined, 'asignar tiene entrada VALOR');

var norm = RS.blocks.normalizarNombreVariable;
assertEquals(norm('lados'), 'lados', 'normalizar deja un nombre valido intacto');
assertEquals(norm('N\u00famero de lados'), 'Numero_de_lados', 'normalizar quita acentos y convierte espacios en _');
assertEquals(norm('a-b!c'), 'abc', 'normalizar descarta caracteres invalidos');
assertEquals(norm('1lado'), null, 'normalizar rechaza un nombre que empieza con digito');
assertEquals(norm(''), null, 'normalizar rechaza el vacio');
assertEquals(norm('   '), null, 'normalizar rechaza solo espacios');

// ---------------------------------------------------------------------
// Program tree: fake blocks -> nodes (same traversal API as Blockly)
// ---------------------------------------------------------------------
var idSeq = 0;
function fb(tipo, campos, entradas, siguiente) {
  idSeq += 1;
  return {
    type: tipo, id: 'fb' + idSeq, outputConnection: null,
    getFieldValue: function (n) { return campos && campos[n]; },
    getInputTargetBlock: function (n) { return (entradas && entradas[n]) || null; },
    getNextBlock: function () { return siguiente || null; }
  };
}
function reporter(tipo, campos) {
  var b = fb(tipo, campos);
  b.outputConnection = {};
  return b;
}
function encadenar(bloques) {
  // Re-creates each block linking to the next (fb() captures `siguiente` at creation).
  var next = null;
  for (var i = bloques.length - 1; i >= 0; i--) {
    var b = bloques[i];
    var campos = b._campos, entradas = b._entradas;
    next = fb(b.tipo, campos, entradas, next);
  }
  return next;
}
function spec(tipo, campos, entradas) { return { tipo: tipo, _campos: campos, _entradas: entradas }; }
function ws(raices) { return { getTopBlocks: function () { return raices; } }; }
function programa(sentencias) {
  return ws([encadenar([spec('rs_inicio')].concat(sentencias))]);
}
function nRep(n) { return reporter('rs_numero', { NUM: n }); }
function vget(nombre) { return reporter('rs_obtener_variable', { NOMBRE: nombre }); }

var comparador = fb('rs_comparar', { OP: '>=' }, { IZQ: vget('contador'), DER: nRep(3) });
comparador.outputConnection = {};
var cuerpoHasta = encadenar([spec('rs_cambiar_variable', { NOMBRE: 'contador', DELTA: 1 })]);
var wsArbol = programa([
  spec('rs_declarar_variable', { TIPO: 'int', NOMBRE: 'contador' }, { VALOR: nRep(0) }),
  spec('rs_repetir_hasta', {}, { COND: comparador, DO: cuerpoHasta }),
  spec('rs_espera', {}, { MS: vget('contador') }),
  spec('rs_avanzar', {}, { MS: vget('contador') })
]);
var arbolCons = RS.generator.buildProgramTree(wsArbol);
assertEquals(arbolCons[0].tipo, 'declarar', 'arbol: declarar produce un nodo declarar');
assertEquals([arbolCons[0].nombre, arbolCons[0].tipoDato, arbolCons[0].valor], ['contador', 'int', { k: 'numero', v: 0 }],
  'arbol: declarar lleva nombre, tipoDato y valor inicial');
assertEquals(arbolCons[1].condicion.izq, { k: 'variable', nombre: 'contador' }, 'arbol: un getter en IZQ del comparar produce {k:variable}');
assertEquals(arbolCons[1].cuerpo[0], { tipo: 'cambiar', nombre: 'contador', delta: 1, blockId: arbolCons[1].cuerpo[0].blockId },
  'arbol: cambiar produce un nodo cambiar dentro del cuerpo');
assertEquals(arbolCons[2].valor, { k: 'variable', nombre: 'contador' }, 'arbol: un getter en el MS de Delay resuelve en ejecucion, no en construccion');
assert(!Object.prototype.hasOwnProperty.call(arbolCons[3], 'valor'), 'arbol: un movimiento no lleva la clave valor (ni siquiera con un MS conectado)');
assertEquals(RS.generator.validarPrograma(wsArbol), { ok: true }, 'validarPrograma acepta un programa de variables valido');

// Empty declarar VALOR defaults to the type's zero value.
var arbolDefecto = RS.generator.buildProgramTree(programa([
  spec('rs_declarar_variable', { TIPO: 'int', NOMBRE: 'a' }, {}),
  spec('rs_declarar_variable', { TIPO: 'bool', NOMBRE: 'b' }, {}),
  spec('rs_asignar_variable', { NOMBRE: 'a' }, {})
]));
assertEquals(arbolDefecto[0].valor, { k: 'numero', v: 0 }, 'arbol: declarar int sin valor vale 0');
assertEquals(arbolDefecto[1].valor, { k: 'booleano', v: false }, 'arbol: declarar bool sin valor vale falso');
assertEquals(arbolDefecto[2].valor, null, 'arbol: asignar sin valor queda en null para que la validacion lo rechace');

// Bool getter / literal as COND; assign stays inside the si_sino branch.
var arbolCond = RS.generator.buildProgramTree(programa([
  spec('rs_declarar_variable', { TIPO: 'bool', NOMBRE: 'activo' }, { VALOR: reporter('rs_booleano', { BOOL: 'FALSE' }) }),
  spec('rs_si_sino', {}, {
    COND: vget('activo'),
    DO: encadenar([spec('rs_asignar_variable', { NOMBRE: 'activo' }, { VALOR: reporter('rs_booleano', { BOOL: 'TRUE' }) })]),
    ELSE: null
  }),
  spec('rs_si_obstaculo', {}, { COND: reporter('rs_booleano', { BOOL: 'TRUE' }), DO: null })
]));
assertEquals(arbolCond[1].condicion, { k: 'variable', nombre: 'activo' }, 'arbol: un getter como COND produce condicion {k:variable}');
assertEquals(arbolCond[1].cuerpo[0].tipo, 'asignar', 'arbol: asignar queda como hijo del cuerpo del si_sino (no se eleva)');
assertEquals(arbolCond[2].condicion, { k: 'booleano', v: true }, 'arbol: un literal booleano como COND produce condicion {k:booleano}');
assert(!('sensor' in arbolCond[1]) && !('sensor' in arbolCond[2]), 'arbol: una condicion de variable no deja el campo sensor');

// Default shadow still yields the legacy sensor shape.
var arbolLegacy = RS.generator.buildProgramTree(programa([
  spec('rs_si_obstaculo', {}, { COND: reporter('rs_hay_obstaculo'), DO: null })
]));
assertEquals(arbolLegacy[0].sensor, 'hayObstaculo', 'arbol: el shadow por defecto mantiene sensor:hayObstaculo');

// 5.8 validarVariables: every error path.
function validar(arbol) { return RS.generator.validarVariables(arbol); }
function fallaCon(arbol, fragmento, mensaje) {
  var r = validar(arbol);
  assert(r.ok === false && r.mensaje.indexOf(fragmento) !== -1, mensaje + (r.ok ? ' (paso sin error)' : ' [' + r.mensaje + ']'));
}
assertEquals(validar([decl('x', 'int', num(1)), camb('x', 1), acc('esperar', 'a', vr('x'))]), { ok: true }, 'validar: programa valido');
assertEquals(validar([acc('avanzar', 'a', 100)]), { ok: true }, 'validar: un programa sin variables es valido');
fallaCon([decl('1x', 'int', num(0))], 'no es válido', 'validar: identificador que empieza con digito');
fallaCon([decl('mi var', 'int', num(0))], 'no es válido', 'validar: identificador con espacios');
fallaCon([decl('', 'int', num(0))], 'no es válido', 'validar: identificador vacio');
fallaCon([decl('i', 'int', num(0))], 'reservado', 'validar: nombre reservado i (contador de bucle)');
fallaCon([decl('i7', 'int', num(0))], 'reservado', 'validar: nombre reservado i<profundidad>');
fallaCon([decl('delay', 'int', num(0))], 'reservado', 'validar: nombre reservado de Arduino');
fallaCon([decl('int', 'int', num(0))], 'reservado', 'validar: palabra clave de C++');
fallaCon([decl('x', 'int', num(0)), decl('x', 'int', num(1), 'otro')], 'más de una vez', 'validar: declarar duplicado');
fallaCon([decl('x', 'int', num(0)), repetir(2, [decl('x', 'int', num(1), 'otro')])], 'más de una vez', 'validar: declarar duplicado dentro de un bucle');
fallaCon([acc('esperar', 'a', vr('y'))], 'antes de declararla', 'validar: getter en Delay sin declarar');
fallaCon([asig('y', num(1))], 'antes de declararla', 'validar: asignar sin declarar');
fallaCon([camb('y', 1)], 'antes de declararla', 'validar: cambiar sin declarar');
fallaCon([asig('x', num(1)), decl('x', 'int', num(0))], 'antes de declararla', 'validar: usar antes de declarar en orden de documento');
fallaCon([decl('x', 'int', vr('x'))], 'antes de declararla', 'validar: una variable no puede inicializarse consigo misma');
fallaCon([decl('b', 'bool', num(3))], 'valor inicial', 'validar: declarar bool con valor int');
fallaCon([decl('num1', 'int', bool(true))], 'valor inicial', 'validar: declarar int con valor bool');
fallaCon([decl('num1', 'int', num(0)), asig('num1', bool(true))], 'No se puede asignar', 'validar: asignar bool a int');
fallaCon([decl('b', 'bool', bool(true)), asig('b', num(1))], 'No se puede asignar', 'validar: asignar int a bool');
fallaCon([decl('b', 'bool', bool(true)), camb('b', 1)], 'solo funciona con variables int', 'validar: cambiar sobre un bool');
fallaCon([decl('num1', 'int', num(0)), siVar('num1', [])], 'es int', 'validar: variable int como condicion');
fallaCon([decl('b', 'bool', bool(true)), acc('esperar', 'a', vr('b'))], 'es bool', 'validar: variable bool como duracion de Delay');
assertEquals(validar([decl('b', 'bool', bool(true)), { tipo: 'accion', accion: 'avanzar', blockId: 'a' }]), { ok: true }, 'validar: un movimiento sin duracion no revisa variables');
fallaCon([decl('b', 'bool', bool(true)),
  { tipo: 'si', condicion: { op: '<', izq: vr('b'), der: num(2) }, cuerpo: [], blockId: 's' }], 'comparar', 'validar: variable bool dentro de un comparar');
fallaCon([decl('num1', 'int', num(0)),
  { tipo: 'si', condicion: { op: '<', izq: bool(true), der: vr('num1') }, cuerpo: [], blockId: 's' }], 'comparar', 'validar: literal bool dentro de un comparar');
fallaCon([decl('b', 'bool', bool(false)), asig('b', null)], 'no tiene un valor', 'validar: asignar sin valor');

// validarPrograma wires the variable check in, after the root check.
assert(RS.generator.validarPrograma(programa([spec('rs_asignar_variable', { NOMBRE: 'zz' }, { VALOR: nRep(1) })])).ok === false,
  'validarPrograma rechaza un programa con una variable sin declarar');
assert(RS.generator.validarPrograma(ws([])).mensaje.indexOf('Inicio/evento') !== -1, 'validarPrograma sigue exigiendo el bloque Inicio/evento primero');

// ---------------------------------------------------------------------
console.log('\n' + (fallidos === 0 ? 'TODOS LOS TESTS PASARON' : fallidos + ' TESTS FALLARON') + ' (' + (total - fallidos) + '/' + total + ')');
process.exit(fallidos === 0 ? 0 : 1);
