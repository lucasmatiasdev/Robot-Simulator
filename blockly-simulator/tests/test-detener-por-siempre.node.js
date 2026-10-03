/**
 * Headless Node test for the motor-state engine, `detener`, `salir` and the
 * uncapped `por siempre` loop: interpreter (ticks, salir unwinding, legacy
 * shim), scheduler (persistent motors, coasting, highlight), block shapes
 * and toolbox gating. No browser, no test framework — run
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
function mot(accion, id) { return { tipo: 'accion', accion: accion, blockId: id }; }
function esp(id, ms) { return { tipo: 'accion', accion: 'esperar', valor: ms, blockId: id }; }
function det(id) { return { tipo: 'accion', accion: 'detener', blockId: id }; }
function salir(id) { return { tipo: 'salir', blockId: id }; }
function siempre(id, cuerpo) { return { tipo: 'por_siempre', cuerpo: cuerpo, blockId: id }; }
function repetir(id, veces, cuerpo) { return { tipo: 'repetir', veces: veces, cuerpo: cuerpo, blockId: id }; }
function hasta(id, cuerpo) {
  // Condition that never becomes true (1 == 2): only `salir` could end the loop.
  return { tipo: 'repetir_hasta', condicion: { op: '==', izq: { k: 'numero', v: 1 }, der: { k: 'numero', v: 2 } }, cuerpo: cuerpo, blockId: id };
}
function siVerdadero(id, cuerpo) {
  return { tipo: 'si', condicion: { op: '==', izq: { k: 'numero', v: 1 }, der: { k: 'numero', v: 1 } }, cuerpo: cuerpo, blockId: id };
}

// ---------------------------------------------------------------------------
// Interpreter: ticks, salir, uncapped loops, legacy shim
// ---------------------------------------------------------------------------
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

assertEquals(RS.config.LOOP_TICK_MS, 1, 'LOOP_TICK_MS vale 1');
assertEquals(RS.config.MAX_NODOS_POR_FRAME, 5000, 'MAX_NODOS_POR_FRAME vale 5000');
assertEquals(RS.config.COAST_GIRO_MAX_MS, 2000, 'COAST_GIRO_MAX_MS vale 2000');

var w = caminar([siempre('ps', [mot('avanzar', 'a')])]);
assertEquals(etiquetas(w, 6), ['avanzar', 'tick', 'avanzar', 'tick', 'avanzar', 'tick'], 'por_siempre { avanzar }: cada vuelta emite un tick tras el cuerpo');
assertEquals(typeof w.limiteSeguridad, 'undefined', 'el interprete ya no expone limiteSeguridad');

w = caminar([siempre('ps-vacio', []), mot('avanzar', 'despues')]);
assertEquals(etiquetas(w, 2000), Array(2000).fill('tick'), 'por_siempre vacio: emite ticks sin tope (2000 vueltas) y nunca se cuelga ni continua');
var tick = caminar([siempre('ps-vacio', [])]).siguienteNodo();
assertEquals(tick, { tipo: 'tick', valor: 1, blockId: 'ps-vacio' }, 'el tick lleva LOOP_TICK_MS y el blockId del bucle');

w = caminar([repetir('rep', 2, [mot('avanzar', 'a')])]);
assertEquals(etiquetas(w, 10), ['avanzar', 'tick', 'avanzar', 'tick'], 'repetir(2): un tick por vuelta completada');

// The tick is returned before the loop condition is re-evaluated.
var evals = 0;
var cond = { op: '==', izq: { k: 'numero', v: 1 }, der: { k: 'numero', v: 2 } };
w = RS.runtime.interpreter.crear([{ tipo: 'repetir_hasta', condicion: cond, cuerpo: [mot('avanzar', 'a')], blockId: 'rh' }],
  RS.world, RS.robot.estado, function () { evals++; });
w.siguienteNodo(); // avanzar (condition evaluated once at encounter)
var evalsAntes = evals;
var t = w.siguienteNodo();
assertEquals(t && t.tipo, 'tick', 'repetir_hasta: tras el cuerpo llega el tick');
assertEquals(evals, evalsAntes, 'repetir_hasta: el tick sale antes de re-evaluar la condicion');
w.siguienteNodo();
assertEquals(evals, evalsAntes + 1, 'repetir_hasta: la condicion se re-evalua despues del tick');

// Salir unwinding.
w = caminar([siempre('ps', [mot('avanzar', 'a'), siVerdadero('si', [salir('s')])]), mot('izquierda', 'g')]);
assertEquals(etiquetas(w, 10), ['avanzar', 'izquierda'], 'por_siempre { avanzar, si(true){ salir } } + girar: sale del bucle desde dentro del si y sigue con girar');
w = caminar([repetir('rep', 5, [salir('s')]), mot('avanzar', 'a')]);
assertEquals(etiquetas(w, 10), ['avanzar'], 'repetir 5 { salir } + avanzar: el cuerpo corre una vez como mucho');
w = caminar([repetir('ext', 2, [siempre('int', [salir('s')]), mot('avanzar', 'x')])]);
assertEquals(etiquetas(w, 10), ['avanzar', 'tick', 'avanzar', 'tick'], 'salir anidado: solo sale el bucle interno, el externo sigue');
w = caminar([salir('s0'), siVerdadero('si', [salir('s1')]), mot('avanzar', 'a')]);
assertEquals(etiquetas(w, 10), ['avanzar'], 'salir huerfano: no hace nada (la validacion lo bloquea antes de ejecutar)');

// ---------------------------------------------------------------------------
// Robot kinematics: proponerPaso
// ---------------------------------------------------------------------------
RS.robot.reset();
RS.robot.setMotores(1, -1);
var giro = RS.robot.proponerPaso(500);
assert(Math.abs(giro.angulo - 90) < 1e-9 && giro.x === RS.robot.estado.x && giro.y === RS.robot.estado.y, 'proponerPaso: derecha 500 ms gira 90 grados sin desplazar');
RS.robot.setMotores(-1, -1);
assert(RS.robot.proponerPaso(100).x < RS.robot.estado.x, 'proponerPaso: retroceder va hacia atras');
RS.robot.reset();
assertEquals(RS.robot.motores, { izq: 0, der: 0 }, 'reset() apaga los motores');

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------
var resaltados = [];
var feedbackLlamadas = [];
RS.ui = {
  resaltar: function (id) { resaltados.push(id); },
  feedback: {
    limpiar: function () {},
    mostrarColision: function (nodo, obst, op) { feedbackLlamadas.push({ nodo: nodo && nodo.accion, obst: obst, fin: !!(op && op.finPrograma) }); }
  }
};

/** Runs `arbol` through the real scheduler in 16 ms frames; returns the outcome. */
function correr(arbol, frames) {
  var sch = RS.runtime.scheduler;
  RS.world.cargarMapa({});
  sch.reiniciar();
  resaltados = [];
  feedbackLlamadas = [];
  sch.iniciarConArbol(arbol);
  var x0 = RS.robot.estado.x;
  for (var n = 0; n < (frames || 5000) && sch.obtenerEstado() === 'running'; n++) sch._procesarFrame(16);
  return {
    estado: sch.obtenerEstado(), ids: resaltados.slice(), metricas: sch.obtenerMetricas(),
    t: sch._tiempoSim(), dx: RS.robot.estado.x - x0, angulo: RS.robot.estado.angulo
  };
}
function cerca(a, b) { return Math.abs(a - b) < 1e-6; }

var r = correr([det('d'), mot('avanzar', 'a'), esp('e', 100), det('d2')]);
assertEquals(r.estado, 'idle', 'detener no termina el programa: los bloques siguientes corren y el run termina en idle');
assert(cerca(r.dx, RS.config.VEL * 100), 'detener + avanzar + Delay(100): avanza durante el Delay');

r = correr([siVerdadero('si', [det('d')]), esp('e', 50)]);
assertEquals(r.estado, 'idle', 'si(true){ detener } + Delay: el run termina en idle');
assertEquals(r.t, 50, 'si(true){ detener } + Delay: el bloque posterior a detener se ejecuta');

// Zero-time set and state persistence.
var sch = RS.runtime.scheduler;
RS.world.cargarMapa({});
sch.reiniciar();
sch.iniciarConArbol([mot('avanzar', 'a'), esp('e', 100), det('d')]);
var xIni = RS.robot.estado.x;
sch._procesarFrame(0);
assertEquals(sch._tiempoSim(), 0, 'avanzar sin Delay: 0 ms de tiempo simulado');
assertEquals(RS.robot.estado.x, xIni, 'avanzar sin Delay: el robot no se movio todavia');
assertEquals(RS.robot.motores, { izq: 1, der: 1 }, 'avanzar enciende ambos motores');
sch.reiniciar();

r = correr([mot('avanzar', 'a'), esp('e1', 200), esp('e2', 300), det('d')]);
assert(r.estado === 'idle' && cerca(r.dx, RS.config.VEL * 500), 'el estado de motores persiste entre Delays consecutivos (500 ms)');
r = correr([mot('derecha', 'a'), esp('e', 500), det('d')]);
assert(r.estado === 'idle' && cerca(r.angulo, 90), 'girar derecha, Delay(500), detener: gira 90 grados');
r = correr([mot('avanzar', 'a'), mot('derecha', 'b'), det('d')]);
assert(r.estado === 'idle' && r.dx === 0 && r.t === 0, 'movimientos y detener sin Delay: ni desplazamiento ni tiempo');
r = correr([mot('avanzar', 'a'), esp('e', 100), det('d')]);
assertEquals(r.metricas.finConMotores, false, 'fin limpio: finConMotores es false');
assertEquals(r.metricas.limiteSeguridad, null, 'limiteSeguridad siempre es null');

// por_siempre without Delay progresses (ticks) until the wall.
r = correr([siempre('ps', [mot('avanzar', 'a')])]);
assertEquals(r.estado, 'error', 'por_siempre { avanzar } sin Delay: avanza por ticks hasta chocar con el limite');
assert(r.t > 0 && r.dx > 0, 'por_siempre { avanzar } sin Delay: el tiempo simulado avanza y el robot se mueve');
r = correr([siempre('ps', [])], 100);
assertEquals(r.estado, 'running', 'por_siempre vacio: sigue running sin colgarse');
assertEquals(r.t, 100 * 16, 'por_siempre vacio: el tiempo avanza un tick por vuelta (16 ms por frame)');

// Tick accounting and the per-frame node budget.
r = correr([repetir('rep', 3, [])]);
assertEquals([r.estado, r.t], ['idle', 3], 'repetir 3 vacio: 3 ticks de 1 ms y termina');
RS.world.cargarMapa({});
sch.reiniciar();
sch.iniciarConArbol([siempre('ps', [])]);
sch._procesarFrame(1e6);
assertEquals(sch._tiempoSim(), RS.config.MAX_NODOS_POR_FRAME, 'frame enorme: se corta a MAX_NODOS_POR_FRAME nodos y se descarta el dt restante');
assertEquals(sch.obtenerEstado(), 'running', 'el corte por presupuesto es un yield, no un error');
sch.reiniciar();

// Program end with motors on: coasting into error.
r = correr([mot('avanzar', 'a')]);
assertEquals(r.estado, 'error', 'avanzar como ultimo bloque: el robot sigue hasta chocar y termina en error');
assertEquals(r.metricas.finConMotores, true, 'fin con motores encendidos: finConMotores es true');
assert(feedbackLlamadas.length === 1 && feedbackLlamadas[0].nodo === 'avanzar' && feedbackLlamadas[0].obst !== 'giro' && feedbackLlamadas[0].fin,
  'la colision informa el bloque motor, un obstaculo/limite y finPrograma');

// Rotation-only coast times out; avanzar + turn still collides.
r = correr([mot('avanzar', 'a'), esp('e', 100), mot('derecha', 'g')]);
assertEquals(r.estado, 'error', 'programa que termina solo girando: error por tiempo de giro');
assert(r.t >= 2100 && r.t < 2100 + 16, 'el error de giro llega a los 2000 ms de giro continuo (+100 ms de avance previo); t=' + r.t);
assertEquals(feedbackLlamadas[0].obst, 'giro', 'el fin por giro se informa como giro, no como colision');
r = correr([mot('derecha', 'g'), esp('e', 100), mot('avanzar', 'a')]);
assert(feedbackLlamadas.length === 1 && feedbackLlamadas[0].obst !== 'giro', 'girar y luego avanzar termina chocando (no por tiempo de giro)');

// Highlight policy.
r = correr([mot('avanzar', 'm'), esp('e', 100), det('d')]);
assertEquals(r.ids, ['e', null], 'resaltado: el Delay mientras corre y se limpia al terminar');
r = correr([repetir('rep', 2, [mot('avanzar', 'm'), esp('e', 20), det('d')])]);
assertEquals(r.ids, ['e', null], 'resaltado: los ticks no mueven el resaltado del Delay');
r = correr([mot('avanzar', 'm')]);
assertEquals(r.ids, ['m'], 'resaltado: al avanzar con motores encendidos queda el ultimo bloque motor');
r = correr([mot('avanzar', 'm'), esp('e', 100000), det('d')]);
assertEquals(r.ids, ['e', 'm'], 'resaltado: en una colision queda el ultimo bloque motor');

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
assertEquals(arbolGenerado, [{ tipo: 'por_siempre', cuerpo: [{ tipo: 'accion', accion: 'avanzar', blockId: 'int1' }], blockId: 'ps1' }],
  'buildProgramTree: rs_por_siempre produce {tipo:"por_siempre", cuerpo, blockId}');

// ---------------------------------------------------------------------------
// Block shapes (Blockly stub records what init declares)
// ---------------------------------------------------------------------------
function inspeccionar(tipo) {
  var info = { prev: null, next: null, inputs: [], textos: [] };
  var entrada = { setCheck: function () { return entrada; }, appendField: function (f) { if (typeof f === 'string') info.textos.push(f); return entrada; } };
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
assertEquals(infoDetener.next, true, 'rs_detener tiene conexion siguiente (ya no termina el programa)');

['rs_avanzar', 'rs_retroceder', 'rs_izquierda', 'rs_derecha'].forEach(function (tipo) {
  var info = inspeccionar(tipo);
  assertEquals(info.inputs, [], tipo + ' no tiene entrada MS (solo fija el estado de los motores)');
  assert(info.prev === true && info.next === true, tipo + ' es encadenable');
});
var infoEspera = inspeccionar('rs_espera');
assertEquals(infoEspera.inputs, ['valor:MS'], 'rs_espera conserva su entrada MS');
assert(infoEspera.textos.indexOf('Delay(') !== -1 && infoEspera.textos.indexOf('esperar(') === -1, 'rs_espera se muestra como Delay(ms)');

var infoSalir = inspeccionar('rs_salir');
assertEquals(infoSalir.prev, true, 'rs_salir tiene conexion previa');
assertEquals(infoSalir.next, false, 'rs_salir no tiene conexion siguiente');
assertEquals(infoSalir.inputs, [], 'rs_salir no tiene entradas (rompe sin condicion)');
assertEquals(infoSalir.colour, inspeccionar('rs_repetir').colour, 'rs_salir usa el color de Repeticion');
assert(RS.blocks.REPETICION_TYPES.indexOf('rs_salir') !== -1, 'rs_salir pertenece al grupo REPETICION_TYPES');

// Tree shape: movement/detener nodes carry no `valor` key, Salir maps to {tipo:'salir'}.
var arbolMov = RS.generator.buildProgramTree({ getTopBlocks: function () {
  return [bloqueFalso('rs_avanzar', 'm1', null, bloqueFalso('rs_detener', 'm2', null, bloqueFalso('rs_salir', 'm3', null, null)))];
} });
assertEquals(arbolMov, [
  { tipo: 'accion', accion: 'avanzar', blockId: 'm1' },
  { tipo: 'accion', accion: 'detener', blockId: 'm2' },
  { tipo: 'salir', blockId: 'm3' }
], 'buildProgramTree: movimientos sin clave valor y rs_salir -> {tipo:"salir"}');
assert(!Object.prototype.hasOwnProperty.call(arbolMov[0], 'valor'), 'buildProgramTree: avanzar no tiene la clave valor');

// Orphan Salir validation (before the variable checks).
var MENSAJE_SALIR = 'Salir';
function salirOk(arbol) { return RS.generator.validarSalir(arbol); }
assert(salirOk([{ tipo: 'salir', blockId: 's' }]).ok === false && salirOk([{ tipo: 'salir', blockId: 's' }]).mensaje.indexOf(MENSAJE_SALIR) !== -1,
  'validarSalir: un Salir en el nivel superior bloquea con un mensaje que nombra Salir');
assert(salirOk([{ tipo: 'si', sensor: 'hayObstaculo', cuerpo: [{ tipo: 'salir', blockId: 's' }], blockId: 'x' }]).ok === false,
  'validarSalir: un Salir dentro de un si fuera de un bucle bloquea');
assert(salirOk([{ tipo: 'por_siempre', cuerpo: [{ tipo: 'si', sensor: 'hayObstaculo', cuerpo: [{ tipo: 'salir', blockId: 's' }], blockId: 'x' }], blockId: 'p' }]).ok === true,
  'validarSalir: un Salir dentro de un si dentro de por_siempre es valido');
assert(salirOk([{ tipo: 'repetir', veces: 2, cuerpo: [{ tipo: 'salir', blockId: 's' }], blockId: 'r' }]).ok === true, 'validarSalir: un Salir dentro de repetir es valido');
var wsOrfano = { getTopBlocks: function () { return [bloqueFalso('rs_inicio', 'i0', null, bloqueFalso('rs_salir', 's0', null, null))]; } };
var rOrfano = RS.generator.validarPrograma(wsOrfano);
assert(rOrfano.ok === false && rOrfano.mensaje.indexOf('Salir') !== -1, 'validarPrograma bloquea la ejecucion con un Salir huerfano');

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

var TABLA = RS.toolbox.DESBLOQUEOS_POR_LECCION;

/** Every distinct block type a toolbox offers, across all categories (presets share a type). */
function todosLosTipos(toolbox) {
  var out = [];
  toolbox.contents.forEach(function (c) {
    c.contents.forEach(function (b) { if (out.indexOf(b.type) === -1) out.push(b.type); });
  });
  return out;
}

/** Cumulative expected type set for lesson `n`, straight from the spec table. */
var ESPERADO = {
  1: ['rs_inicio', 'rs_avanzar', 'rs_detener', 'rs_espera'],
  3: ['rs_derecha', 'rs_izquierda', 'rs_retroceder'],
  4: ['rs_declarar_variable', 'rs_obtener_variable'],
  5: ['rs_repetir'],
  6: ['rs_mientras', 'rs_si_obstaculo', 'rs_si_sino', 'rs_hay_obstaculo', 'rs_salir'],
  7: ['rs_no_hay_obstaculo']
};
function acumulado(n) {
  var out = [];
  for (var id = 1; id <= n; id++) out = out.concat(ESPERADO[id] || []);
  return out.sort();
}

for (var n = 1; n <= 8; n++) {
  var tiposN = todosLosTipos(RS.toolbox.paraLeccion(n)).sort();
  assertEquals(tiposN, acumulado(n), 'L' + n + ': el toolbox ofrece exactamente el conjunto acumulado de bloques');
  assert(tiposN.indexOf('rs_repetir_hasta') === -1, 'L' + n + ': rs_repetir_hasta no esta en el toolbox');
  assert(RS.toolbox.paraLeccion(n).contents.every(function (c) { return c.contents.length > 0; }), 'L' + n + ': no hay categorias vacias');
}
assertEquals(Object.keys(TABLA), ['1', '2', '3', '4', '5', '6', '7', '8'], 'la tabla de desbloqueos cubre las lecciones 1..8');

// Category layout for the early lessons.
assertEquals(RS.toolbox.paraLeccion(1).contents.map(function (c) { return c.name; }), ['Inicio', 'Movimiento', 'Temporales'],
  'L1: categorias Inicio, Movimiento y Temporales');
assertEquals(tiposCategoria(RS.toolbox.paraLeccion(1), 'Movimiento'), ['rs_avanzar', 'rs_detener'], 'L1: Movimiento solo ofrece avanzar y detener');
assertEquals(RS.toolbox.paraLeccion(4).contents.map(function (c) { return c.name; }), ['Inicio', 'Movimiento', 'Temporales', 'Variables'],
  'L4: aparece la categoria Variables');
assertEquals(tiposCategoria(RS.toolbox.paraLeccion(6), 'Decisión'), ['rs_si_obstaculo', 'rs_si_sino'], 'L6: Decision ofrece si y si/si no');
assertEquals(tiposCategoria(RS.toolbox.paraLeccion(6), 'Sensores'), ['rs_hay_obstaculo'], 'L6: Sensores solo ofrece hayObstaculo');
assertEquals(tiposCategoria(RS.toolbox.paraLeccion(7), 'Sensores'), ['rs_hay_obstaculo', 'rs_no_hay_obstaculo'], 'L7: Sensores suma noHayObstaculo');
assertEquals(tiposCategoria(RS.toolbox.paraLeccion(8), 'Repetición'), ['rs_repetir', 'rs_mientras', 'rs_salir'], 'L8: Repeticion ofrece repetir, mientras y Salir');

// Temporales holds only Delay; movement blocks carry no shadow inputs.
assertEquals(tiposCategoria(RS.toolbox, 'Temporales'), ['rs_espera'], 'Temporales contiene solo rs_espera');
assertEquals(RS.blocks.TEMPORALES_TYPES, ['rs_espera'], 'RS.blocks.TEMPORALES_TYPES contiene solo rs_espera');
assert(RS.blocks.MOVIMIENTO_TYPES.indexOf('rs_espera') === -1, 'rs_espera ya no pertenece a MOVIMIENTO_TYPES');
assert(RS.toolbox.contents.filter(function (c) { return c.name === 'Movimiento'; })[0].contents.every(function (b) { return !b.inputs; }),
  'toolbox: los movimientos no llevan shadow de MS');
assertEquals(RS.toolbox.contents.filter(function (c) { return c.name === 'Temporales'; })[0].contents[0].inputs.MS.shadow.fields.NUM, 1000,
  'Delay lleva el shadow de MS en Temporales');

// Sandbox / unknown ids: the full toolbox, minus nothing (repetir_hasta stays only here).
assert(RS.toolbox.paraLeccion(99) === RS.toolbox, 'un id desconocido devuelve el toolbox completo');
assert(RS.toolbox.paraLeccion(undefined) === RS.toolbox, 'sin id devuelve el toolbox completo');
assert(todosLosTipos(RS.toolbox).indexOf('rs_repetir_hasta') === -1, 'RS.toolbox (sandbox) tampoco ofrece rs_repetir_hasta');
['rs_por_siempre', 'rs_salir', 'rs_mientras', 'rs_no_hay_obstaculo', 'rs_booleano', 'rs_medir_distancia', 'rs_comparar'].forEach(function (t) {
  assert(todosLosTipos(RS.toolbox).indexOf(t) !== -1, 'RS.toolbox (sandbox) contiene ' + t);
});
assertEquals(RS.toolbox.contents.map(function (c) { return c.name; }),
  ['Inicio', 'Movimiento', 'Temporales', 'Variables', 'Decisión', 'Repetición', 'Sensores'], 'RS.toolbox: orden de categorias del documento fuente');

// Every table type is a real block and is offered by some category.
var todosSandbox = todosLosTipos(RS.toolbox);
Object.keys(TABLA).forEach(function (id) {
  TABLA[id].forEach(function (t) {
    assert(!!sandbox.window.Blockly.Blocks[t], 'tabla L' + id + ': ' + t + ' existe en Blockly.Blocks');
    assert(todosSandbox.indexOf(t) !== -1, 'tabla L' + id + ': ' + t + ' esta en alguna categoria');
  });
});

// Presets and default shadows.
var declarar = RS.toolbox.contents.filter(function (c) { return c.name === 'Variables'; })[0].contents[0];
assertEquals([declarar.fields.TIPO, declarar.fields.NOMBRE, declarar.inputs.VALOR.shadow.fields.NUM], ['int', 'giro', 500], 'preset de Variables: int giro = 500');
var mientrasTb = RS.toolbox.contents.filter(function (c) { return c.name === 'Repetición'; })[0].contents.filter(function (b) { return b.type === 'rs_mientras'; })[0];
assertEquals(mientrasTb.inputs.COND.shadow, { type: 'rs_booleano', fields: { BOOL: 'TRUE' } }, 'rs_mientras trae el shadow verdadero por defecto');

console.log('\n' + (fallidos === 0 ? 'TODOS LOS TESTS PASARON' : (fallidos + ' TEST(S) FALLARON')) + ' (' + (total - fallidos) + '/' + total + ')');
process.exit(fallidos === 0 ? 0 : 1);
