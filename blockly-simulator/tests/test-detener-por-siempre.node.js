/**
 * Headless Node test for `detener` as program exit and the `por siempre`
 * forever loop: interpreter (safety cap), scheduler (detener ends the run),
 * block shapes and toolbox gating. No browser, no test framework — run
 * directly:
 *
 *   node tests/test-detener-por-siempre.node.js
 *
 * Same `vm`-sandbox loading pattern as tests/test-lesson-solutions.node.js.
 * `window.Blockly` is a minimal stub: it only records the connection flags
 * and inputs each block's `init` declares, which is all the shape checks need.
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
  'runtime/scheduler', 'blocks/definitions', 'blocks/toolbox', 'generator/program-tree'
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
function acc(accion, id, valor) { return { tipo: 'accion', accion: accion, valor: valor || 16, blockId: id }; }
function det(id) { return { tipo: 'accion', accion: 'detener', blockId: id }; }
function siempre(id, cuerpo) { return { tipo: 'por_siempre', cuerpo: cuerpo, blockId: id }; }
function repetir(id, veces, cuerpo) { return { tipo: 'repetir', veces: veces, cuerpo: cuerpo, blockId: id }; }
function hasta(id, cuerpo) {
  // Condition that never becomes true (1 == 2), so only the cap ends the loop.
  return { tipo: 'repetir_hasta', condicion: { op: '==', izq: { k: 'numero', v: 1 }, der: { k: 'numero', v: 2 } }, cuerpo: cuerpo, blockId: id };
}
function siVerdadero(id, cuerpo) {
  return { tipo: 'si', condicion: { op: '==', izq: { k: 'numero', v: 1 }, der: { k: 'numero', v: 1 } }, cuerpo: cuerpo, blockId: id };
}

var CAP = RS.config.MAX_ITER_POR_SIEMPRE;

// ---------------------------------------------------------------------------
// Interpreter: por_siempre repetition and safety cap
// ---------------------------------------------------------------------------
function caminar(arbol) {
  return RS.runtime.interpreter.crear(arbol, RS.world, RS.robot.estado, null);
}

assertEquals(CAP, 1000, 'MAX_ITER_POR_SIEMPRE vale 1000');

var w = caminar([siempre('ps', [acc('avanzar', 'a')])]);
var cinco = [];
for (var i = 0; i < 5; i++) cinco.push(w.siguienteNodo().accion);
assertEquals(cinco, ['avanzar', 'avanzar', 'avanzar', 'avanzar', 'avanzar'], 'por_siempre { avanzar }: las 5 primeras hojas son avanzar');
assertEquals(w.limiteSeguridad(), null, 'por_siempre: sin trip antes de llegar al tope');

w = caminar([siempre('ps-vacio', []), acc('avanzar', 'despues')]);
var nVacio = w.siguienteNodo();
assertEquals(nVacio && nVacio.blockId, 'despues', 'por_siempre vacio: no se cuelga y continua con el bloque siguiente');
assertEquals(w.limiteSeguridad(), { blockId: 'ps-vacio', iteraciones: CAP }, 'por_siempre vacio: limiteSeguridad() = {blockId, iteraciones: 1000}');

w = caminar([siempre('ps-hoja', [acc('avanzar', 'a')]), acc('izquierda', 'g')]);
var avanzares = 0;
var nodo = w.siguienteNodo();
while (nodo && nodo.accion === 'avanzar') { avanzares++; nodo = w.siguienteNodo(); }
assertEquals(avanzares, CAP, 'por_siempre { avanzar }: se yieldean exactamente 1000 avanzar antes del tope');
assertEquals(nodo && nodo.blockId, 'g', 'por_siempre { avanzar } + izquierda: tras el tope la siguiente hoja es izquierda');
assertEquals(w.limiteSeguridad(), { blockId: 'ps-hoja', iteraciones: CAP }, 'por_siempre con cuerpo de hojas: el trip queda registrado');

w = caminar([siempre('ps-ultimo', [acc('avanzar', 'a')])]);
var cuenta = 0;
while (w.siguienteNodo() !== null) cuenta++;
assertEquals(cuenta, CAP, 'por_siempre como ultimo bloque: tras el tope no quedan mas nodos');
assert(w.terminado(), 'por_siempre como ultimo bloque: el interprete termina con normalidad');
assertEquals(w.limiteSeguridad(), { blockId: 'ps-ultimo', iteraciones: CAP }, 'por_siempre como ultimo bloque: el trip queda registrado');

w = caminar([siempre('externo', [siempre('interno', []), acc('avanzar', 'ext-avanzar')])]);
var nAnidado = w.siguienteNodo();
assertEquals(nAnidado && nAnidado.blockId, 'ext-avanzar', 'por_siempre anidado: el interno vacio dispara el trip, sale y el siguiente nodo es avanzar del externo');
assertEquals(w.limiteSeguridad(), { blockId: 'interno', iteraciones: CAP }, 'por_siempre anidado: el trip registrado es el del bucle interno');

// ---------------------------------------------------------------------------
// Scheduler: detener ends the run
// ---------------------------------------------------------------------------
var resaltados = [];
RS.ui = { resaltar: function (id) { if (id) resaltados.push(id); } };

/** Runs `arbol` through the real scheduler; returns {estado, ids, metricas}. */
function correr(arbol) {
  var sch = RS.runtime.scheduler;
  RS.world.cargarMapa({});
  sch.reiniciar();
  resaltados = [];
  sch.iniciarConArbol(arbol);
  for (var n = 0; n < 5000 && sch.obtenerEstado() === 'running'; n++) sch._procesarFrame(16);
  return { estado: sch.obtenerEstado(), ids: resaltados.slice(), metricas: sch.obtenerMetricas() };
}

var r = correr([siVerdadero('si', [det('d')]), acc('esperar', 'nunca')]);
assertEquals(r.estado, 'idle', 'si(true){ detener } + bloque: el run termina en idle');
assert(r.ids.indexOf('nunca') === -1, 'si(true){ detener } + bloque: el bloque posterior a detener nunca se despacha');
assertEquals(r.ids, ['d'], 'si(true){ detener } + bloque: solo se despacha detener');

r = correr([repetir('rep', 3, [acc('esperar', 'a'), det('d'), acc('esperar', 'b')]), acc('esperar', 'nunca')]);
assertEquals(r.estado, 'idle', 'detener dentro de repetir: termina en idle');
assertEquals(r.ids, ['a', 'd'], 'detener dentro de repetir: no corren mas iteraciones ni bloques posteriores');

r = correr([hasta('rh', [acc('esperar', 'a'), det('d')]), acc('esperar', 'nunca')]);
assertEquals(r.estado, 'idle', 'detener dentro de repetir_hasta: termina en idle');
assertEquals(r.ids, ['a', 'd'], 'detener dentro de repetir_hasta: no corren mas iteraciones ni bloques posteriores');

r = correr([siempre('ps', [acc('esperar', 'a'), det('d')]), acc('esperar', 'nunca')]);
assertEquals(r.estado, 'idle', 'detener dentro de por_siempre: termina en idle');
assertEquals(r.ids, ['a', 'd'], 'detener dentro de por_siempre: no corren mas vueltas ni bloques posteriores');

r = correr([siVerdadero('si', [acc('esperar', 'a'), det('d'), acc('esperar', 'b')]), acc('esperar', 'nunca')]);
assertEquals(r.estado, 'idle', 'detener dentro de si: termina en idle');
assertEquals(r.ids, ['a', 'd'], 'detener dentro de si: no corre nada despues de detener');

r = correr([siempre('ps', [acc('esperar', 'a'), siVerdadero('si', [det('d')])])]);
assertEquals(r.estado, 'idle', 'por_siempre { esperar, si(true){ detener } }: termina en idle');
assertEquals(r.metricas.limiteSeguridad, null, 'por_siempre terminado por detener: limiteSeguridad() queda en null');
assertEquals(r.ids, ['a', 'd'], 'por_siempre terminado por detener: corre una sola vuelta');

r = correr([acc('avanzar', 'a', 100), det('d')]);
assertEquals(r.estado, 'idle', 'avanzar + detener como ultimo bloque de nivel superior (forma de la precarga de L1): termina en idle');
assertEquals(r.ids, ['a', 'd'], 'avanzar + detener final: se despachan ambos');

RS.runtime.scheduler.reiniciar();

// ---------------------------------------------------------------------------
// Program tree: rs_por_siempre maps to a por_siempre node
// ---------------------------------------------------------------------------
function bloqueFalso(type, id, hijoDo, siguiente) {
  return {
    type: type,
    id: id,
    getInputTargetBlock: function (nombre) { return nombre === 'DO' ? (hijoDo || null) : null; },
    getNextBlock: function () { return siguiente || null; },
    getFieldValue: function () { return null; },
    outputConnection: null
  };
}
var interior = bloqueFalso('rs_avanzar', 'int1', null, null);
var raiz = bloqueFalso('rs_por_siempre', 'ps1', interior, null);
var arbolGenerado = RS.generator.buildProgramTree({ getTopBlocks: function () { return [raiz]; } });
assertEquals(arbolGenerado, [{ tipo: 'por_siempre', cuerpo: [{ tipo: 'accion', accion: 'avanzar', blockId: 'int1', valor: 0 }], blockId: 'ps1' }],
  'buildProgramTree: rs_por_siempre produce {tipo:"por_siempre", cuerpo, blockId}');

// ---------------------------------------------------------------------------
// Block shapes (Blockly stub records what init declares)
// ---------------------------------------------------------------------------
function inspeccionar(tipo) {
  var info = { prev: null, next: null, inputs: [] };
  var entrada = { setCheck: function () { return entrada; }, appendField: function () { return entrada; } };
  var bloque = {
    appendValueInput: function (n) { info.inputs.push('valor:' + n); return entrada; },
    appendDummyInput: function () { return entrada; },
    appendStatementInput: function (n) { info.inputs.push('sentencia:' + n); return entrada; },
    setPreviousStatement: function (v) { info.prev = v; },
    setNextStatement: function (v) { info.next = v; },
    setColour: function (c) { info.colour = c; },
    setTooltip: function () {},
    setInputsInline: function () {}
  };
  sandbox.window.Blockly.Blocks[tipo].init.call(bloque);
  return info;
}

var infoDetener = inspeccionar('rs_detener');
assertEquals(infoDetener.prev, true, 'rs_detener conserva su conexion previa');
assertEquals(infoDetener.next, false, 'rs_detener no tiene conexion siguiente (nada puede ir debajo)');

var infoSiempre = inspeccionar('rs_por_siempre');
assertEquals(infoSiempre.prev, true, 'rs_por_siempre tiene conexion previa');
assertEquals(infoSiempre.next, true, 'rs_por_siempre tiene conexion siguiente (encadenable)');
assertEquals(infoSiempre.inputs, ['sentencia:DO'], 'rs_por_siempre tiene una sola entrada de sentencias DO (el cuerpo)');
assertEquals(infoSiempre.colour, inspeccionar('rs_repetir').colour, 'rs_por_siempre usa el color de Repeticion');
assert(RS.blocks.REPETICION_TYPES.indexOf('rs_por_siempre') !== -1, 'rs_por_siempre pertenece al grupo REPETICION_TYPES');

// ---------------------------------------------------------------------------
// Toolbox gating
// ---------------------------------------------------------------------------
function tiposCategoria(toolbox, nombre) {
  var cat = toolbox.contents.filter(function (c) { return c.name === nombre; })[0];
  return cat ? cat.contents.map(function (b) { return b.type; }) : null;
}

function tiposRepeticion(toolbox) {
  return tiposCategoria(toolbox, 'Repetición');
}

function tiposSensor(toolbox) {
  return tiposCategoria(toolbox, 'Sensores/Decisión');
}

var l6 = tiposRepeticion(RS.toolbox.paraLeccion(6));
assert(l6 !== null && l6.indexOf('rs_por_siempre') === -1, 'L6: la categoria Repeticion NO contiene rs_por_siempre');
assert(l6 !== null && l6.indexOf('rs_repetir') !== -1 && l6.indexOf('rs_repetir_hasta') !== -1, 'L6: conserva rs_repetir y rs_repetir_hasta');
assert(tiposRepeticion(RS.toolbox.paraLeccion(7)).indexOf('rs_por_siempre') !== -1, 'L7: la categoria Repeticion contiene rs_por_siempre');
assert(tiposRepeticion(RS.toolbox).indexOf('rs_por_siempre') !== -1, 'RS.toolbox (sandbox) contiene rs_por_siempre');

[4, 5, 6].forEach(function (n) {
  var tipos = tiposRepeticion(RS.toolbox.paraLeccion(n));
  assert(tipos !== null, 'L' + n + ': la categoria Repeticion existe');
  assert(tipos !== null && tipos.indexOf('rs_repetir') !== -1 && tipos.indexOf('rs_repetir_hasta') !== -1,
    'L' + n + ': la categoria Repeticion contiene rs_repetir y rs_repetir_hasta');
  assert(tipos !== null && tipos.indexOf('rs_por_siempre') === -1, 'L' + n + ': la categoria Repeticion NO contiene rs_por_siempre todavia');
});

assert(tiposRepeticion(RS.toolbox.paraLeccion(3)) === null, 'L3: no hay categoria Repeticion todavia');

var sensorL4 = tiposSensor(RS.toolbox.paraLeccion(4));
assert(sensorL4 !== null && sensorL4.indexOf('rs_si_obstaculo') === -1 && sensorL4.indexOf('rs_si_sino') === -1,
  'L4: la categoria Sensores/Decisión NO contiene rs_si_obstaculo ni rs_si_sino');
var sensorL5 = tiposSensor(RS.toolbox.paraLeccion(5));
assert(sensorL5 !== null && sensorL5.indexOf('rs_si_obstaculo') !== -1 && sensorL5.indexOf('rs_si_sino') !== -1,
  'L5: la categoria Sensores/Decisión contiene rs_si_obstaculo y rs_si_sino');

console.log('\n' + (fallidos === 0 ? 'TODOS LOS TESTS PASARON' : (fallidos + ' TEST(S) FALLARON')) + ' (' + (total - fallidos) + '/' + total + ')');
process.exit(fallidos === 0 ? 0 : 1);
