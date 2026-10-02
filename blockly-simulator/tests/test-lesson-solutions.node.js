/**
 * Headless Node regression test: every lesson L1-L8 has a reference solution
 * that passes its criterio on its CURRENT map, driven through the real
 * scheduler (`iniciarConArbol` + fixed 16 ms `_procesarFrame` steps). Also
 * guards lesson text anchors, the shared L1 preload constant and neutral
 * tuteo. No browser, no test framework — run directly:
 *
 *   node tests/test-lesson-solutions.node.js
 *
 * Same `vm`-sandbox loading pattern as tests/test-lesson-map-editor.node.js.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var sandbox = { window: {}, console: console };
vm.createContext(sandbox);

function cargar(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}
['config', 'sim/world', 'sim/gridAdapter', 'sim/robot', 'sim/sensors', 'runtime/interpreter',
  'runtime/scheduler', 'lessons/content', 'lessons/check'].forEach(function (m) { cargar('src/' + m + '.js'); });

var RS = sandbox.window.RS;
var lecciones = RS.lessons.CONTENIDO;
var contentFuente = fs.readFileSync(path.join(ROOT, 'src/lessons/content.js'), 'utf8');
var mainFuente = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
var total = 0;
var fallidos = 0;

function assert(cond, mensaje) {
  total++;
  if (!cond) fallidos++;
  console.log((cond ? 'PASS ' : 'FAIL ') + mensaje);
}

// Program-tree helpers (same node shapes as src/generator/program-tree.js).
// Motor-state model: a movement block only sets the motors (no duration);
// time passes in Delay (esperar) blocks. `av(ms)` & co. are shorthands for the
// pair "movement + Delay(ms)" and expand to two nodes, so every body/sequence
// goes through `plano` to flatten them.
function plano(lista) {
  return [].concat.apply([], lista.map(function (x) { return Array.isArray(x) ? x : [x]; }));
}
function mov(accion) { return { tipo: 'accion', accion: accion, blockId: 'b' }; }
function esp(ms) { return { tipo: 'accion', accion: 'esperar', valor: ms, blockId: 'b' }; }
function det() { return mov('detener'); }
function salir() { return { tipo: 'salir', blockId: 'b' }; }
function av(ms) { return [mov('avanzar'), esp(ms)]; }
function der(ms) { return [mov('derecha'), esp(ms)]; }
function izq(ms) { return [mov('izquierda'), esp(ms)]; }
function siHay(cuerpo) { return { tipo: 'si', sensor: 'hayObstaculo', cuerpo: plano(cuerpo), blockId: 'b' }; }
function siSino(cuerpo, sino) { return { tipo: 'si_sino', sensor: 'hayObstaculo', cuerpo: plano(cuerpo), sino: plano(sino), blockId: 'b' }; }
function hasta(cuerpo) { return { tipo: 'repetir_hasta', sensor: 'hayObstaculo', cuerpo: plano(cuerpo), blockId: 'b' }; }
function rep(veces, cuerpo) { return { tipo: 'repetir', veces: veces, cuerpo: plano(cuerpo), blockId: 'b' }; }
function num(v) { return { k: 'numero', v: v }; }
function bool(v) { return { k: 'booleano', v: v }; }
function vr(nombre) { return { k: 'variable', nombre: nombre }; }
function decl(nombre, tipoDato, valor) { return { tipo: 'declarar', nombre: nombre, tipoDato: tipoDato, valor: valor, blockId: 'b' }; }
function asig(nombre, valor) { return { tipo: 'asignar', nombre: nombre, valor: valor, blockId: 'b' }; }
function camb(nombre, delta) { return { tipo: 'cambiar', nombre: nombre, delta: delta, blockId: 'b' }; }
function hastaCond(condicion, cuerpo) { return { tipo: 'repetir_hasta', condicion: condicion, cuerpo: plano(cuerpo), blockId: 'b' }; }
function siSinoVar(nombre, cuerpo, sino) { return { tipo: 'si_sino', condicion: vr(nombre), cuerpo: plano(cuerpo), sino: plano(sino), blockId: 'b' }; }

/** Runs `arbol` on lesson `n`'s real map; returns the snapshot panel.js would build. */
function correr(n, arbol, conInicial) {
  var lec = lecciones[n - 1];
  var sch = RS.runtime.scheduler;
  RS.world.cargarMapa(lec.mapa);
  sch.reiniciar();
  sch.iniciarConArbol(plano(arbol));
  for (var i = 0; i < 20000 && sch.obtenerEstado() === 'running'; i++) sch._procesarFrame(16);
  var snap = {
    estado: { x: RS.robot.estado.x, y: RS.robot.estado.y, angulo: RS.robot.estado.angulo },
    resultadoRun: sch.obtenerEstado(),
    metricas: sch.obtenerMetricas()
  };
  if (conInicial !== false) snap.inicial = RS.world.poseInicial;
  snap.colision = snap.resultadoRun === 'error';
  snap.ok = RS.lessons.check.evaluar(lec, snap);
  snap.hayObstaculo = RS.sensors.hayObstaculo(RS.world, RS.robot.estado);
  snap.pose = '(' + snap.estado.x.toFixed(2) + ',' + snap.estado.y.toFixed(2) + ')';
  return snap;
}

// Loops add LOOP_TICK_MS (1 ms of motion at the current motor state) after every
// body pass, so loop-driven routes land a few px past the pure-geometry pose.
var TOL_BUCLE = 8;
function cerca(snap, x, y, tol) {
  var t = tol === undefined ? 0.5 : tol;
  return Math.abs(snap.estado.x - x) <= t && Math.abs(snap.estado.y - y) <= t;
}

// The 8 reference solutions (design geometry; ms = round(px / 0.12)).
var MS1 = RS.lessons.MS_PRECARGA_LECCION_1;
var pasoL8 = [hasta([av(125)]), der(500)];
var refL8 = plano([pasoL8, pasoL8, pasoL8, pasoL8, pasoL8, hasta([av(125)]), det()]);
// L7 (Variables): serpentine, three lanes; `filas` counts the two lane changes
// and `haciaDerecha` flips the turn direction at each end. One lane change =
// avanzar(1333) (lane centers are 160px apart).
var refL7 = [
  decl('filas', 'int', num(0)),
  decl('haciaDerecha', 'bool', bool(true)),
  hastaCond({ op: '>=', izq: vr('filas'), der: num(2) }, [
    hasta([av(100)]),
    siSinoVar('haciaDerecha',
      [der(500), av(1333), der(500), asig('haciaDerecha', bool(false))],
      [izq(500), av(1333), izq(500), asig('haciaDerecha', bool(true))]),
    camb('filas', 1)
  ]),
  hasta([av(100)]),
  det()
];
// The L7 ejemplo: a small square counted with a variable.
var ejemploL7 = [
  decl('lados', 'int', num(0)),
  hastaCond({ op: '>=', izq: vr('lados'), der: num(4) }, [av(300), der(500), camb('lados', 1)]),
  det()
];
var refL5 = [hasta([av(100)]), der(500), rep(40, [siSino([salir()], [av(100)])]), det()];
var referencias = [
  { n: 1, arbol: [av(MS1), det()], x: 60 + MS1 * 0.12, y: 300 },
  { n: 2, arbol: [av(2500), det()], x: 360, y: 300 },
  { n: 3, arbol: [av(1250), der(500), av(500), izq(500), av(1900), izq(500), av(917), der(500), av(2000), det()], x: 678, y: 249.96 },
  { n: 4, arbol: [hasta([av(100)]), det()], x: 600, y: 300, sensor: true },
  { n: 5, arbol: refL5, x: 480, y: 404, sensor: true },
  { n: 6, arbol: [hasta([av(100)]), det()], x: 600, y: 300, sensor: true },
  { n: 7, arbol: refL7, x: 688, y: 420, sensor: true },
  { n: 8, arbol: refL8, x: 520, y: 325, sensor: true }
];

referencias.forEach(function (r) {
  var s = correr(r.n, r.arbol);
  var dentro = cerca(s, r.x, r.y, r.sensor ? TOL_BUCLE : 0.5);
  assert(s.ok.ok && s.resultadoRun !== 'error' && dentro,
    'L' + r.n + ' reference solution passes; final pose ' + s.pose + ', expected (' + r.x + ',' + r.y + ')' +
    (s.ok.ok ? '' : ' — criterio failed: ' + s.ok.observado));
  if (r.sensor) assert(s.metricas.evalsSensor >= 1, 'L' + r.n + ' reference consults the sensor (evalsSensor=' + s.metricas.evalsSensor + ')');
});

// L1 geometric check: center inside meta x in [320,520] via the shared constant.
var s1 = correr(1, [av(MS1), det()]);
assert(s1.estado.x >= 320 && s1.estado.x <= 520, 'L1 shared constant ' + MS1 + ' ends inside meta (x=' + s1.estado.x.toFixed(2) + ')');

// Sensor-threshold behavior (L4): 3900 ms stops at x=528 with no obstacle detected.
var s4 = correr(4, [av(3900), siHay([det()]), det()]);
assert(Math.abs(s4.estado.x - 528) <= 0.5 && s4.hayObstaculo === false, 'L4 avanzar(3900) stops at x=528 without hayObstaculo (' + s4.pose + ')');

// Non-passing runs: no collision, ok=false.
var n3 = correr(3, [av(1250), der(500), av(500), det()]);
assert(!n3.ok.ok && n3.resultadoRun !== 'error' && cerca(n3, 210, 360), 'L3 ejemplo ends at (210,360) without passing; got ' + n3.pose);
var m3 = correr(3, [av(1250), av(500), der(500), det()]);
assert(m3.resultadoRun === 'error' && !m3.ok.ok, 'L3 modificacion (swapped last two blocks) hits pillar 1; got ' + m3.resultadoRun + ' at ' + m3.pose);
var refL5SinGiro = [hasta([av(100)]), rep(40, [siSino([salir()], [av(100)])]), det()];
var n5 = correr(5, refL5SinGiro);
assert(!n5.ok.ok && n5.resultadoRun !== 'error' && cerca(n5, 480, 140, TOL_BUCLE) && /misma altura/.test(n5.ok.observado),
  'L5 variant without derecha(500) ends at (480,140) with "misma altura" feedback; got ' + n5.pose + ' / ' + n5.ok.observado);
var n8 = correr(8, [hasta([av(100)]), der(500), det()]);
assert(!n8.ok.ok && n8.resultadoRun !== 'error', 'L8 ejemplo does not pass and does not collide; got ' + n8.pose);
var n7 = correr(7, ejemploL7);
assert(!n7.ok.ok && n7.resultadoRun !== 'error' && n7.metricas.cambiosVariable === 4,
  'L7 ejemplo does not pass, does not collide and changes the counter 4 times; got ' + n7.pose + ', cambiosVariable=' + n7.metricas.cambiosVariable);
// L7 criterio requires variable changes: the same route with no variables reaches the meta but fails.
var sinVariablesL7 = correr(7, [hasta([av(100)]), der(500), av(1333), der(500), hasta([av(100)]), izq(500), av(1333), izq(500), hasta([av(100)]), det()]);
assert(sinVariablesL7.resultadoRun !== 'error' && cerca(sinVariablesL7, 688, 420, TOL_BUCLE) && !sinVariablesL7.ok.ok && sinVariablesL7.metricas.cambiosVariable === 0,
  'L7 route without variables reaches the meta but does not pass (cambiosVariable=' + sinVariablesL7.metricas.cambiosVariable + '); got ' + sinVariablesL7.pose);
assert(/variable/.test(sinVariablesL7.ok.observado), 'L7 describir explains the missing variable use: ' + sinVariablesL7.ok.observado);
var sinInicial = null;
try { sinInicial = correr(5, refL5SinGiro, false); } catch (e) { sinInicial = e; }
assert(sinInicial && !(sinInicial instanceof Error), 'L5 describir does not throw without snapshot.inicial');

// L5 describir compares against snapshot.inicial.y (140), never a hard-coded 300.
var descL5 = lecciones[4].criterio.describir;
var enPozo = descL5({ estado: { x: 510, y: 300 }, inicial: { x: 60, y: 140 }, metricas: { evalsSensor: 1 } }, false);
assert(!/misma altura/.test(enPozo), 'L5 describir mid-shaft (y=300, start y=140) is not "misma altura": ' + enPozo);
var sinIni = null;
try { sinIni = descL5({ estado: { x: 300, y: 300 }, metricas: { evalsSensor: 1 } }, false); } catch (e) { sinIni = e; }
assert(typeof sinIni === 'string', 'L5 describir without inicial returns a string instead of throwing');

// Text anchors: each ejemplo quotes its reference Delay ms (Salir for L5); stale L1/L2 values are gone.
[[1, 'Delay(' + MS1 + ')'], [2, 'Delay(2500)'], [3, 'Delay(1250)'], [4, 'repetir hasta hayObstaculo() { avanzar → Delay(100) }'], [5, 'repetir 40 veces'], [5, '{ Salir }']]
  .forEach(function (a) {
    assert(lecciones[a[0] - 1].ejemplo.indexOf(a[1]) !== -1, 'L' + a[0] + ' ejemplo contains ' + a[1]);
  });
[1, 2].forEach(function (n) {
  var texto = JSON.stringify(lecciones[n - 1]);
  assert(!/1167|1833/.test(texto), 'L' + n + ' text has no stale 1167/1833 ms');
});
assert(!/límite de (repeticiones de )?seguridad/i.test(JSON.stringify(lecciones)), 'lesson text no longer mentions a loop safety limit');
assert(!/dos obst/i.test(lecciones[7].criterioTexto + lecciones[7].desafio), 'L8 text does not mention two obstacles');

// L1 drift guard: main.js preload must equal the value quoted in the L1 ejemplo.
var literalMain = /MS_PRECARGA_LECCION_1\s*=\s*(\d+)/.exec(mainFuente);
var usaConstante = /=\s*RS\.lessons\.MS_PRECARGA_LECCION_1/.test(mainFuente);
var msMain = literalMain ? Number(literalMain[1]) : (usaConstante ? MS1 : null);
var ejemploMs = /Delay\((\d+)\)/.exec(lecciones[0].ejemplo);
ejemploMs = ejemploMs ? Number(ejemploMs[1]) : null;
assert(!literalMain && msMain === ejemploMs,
  'L1 preload and ejemplo share one source: main.js=' + msMain + ', ejemplo=' + ejemploMs + (literalMain ? ' (main.js has a numeric literal)' : ''));

// All 13 sections stay non-empty strings.
lecciones.forEach(function (lec) {
  var vacias = RS.lessons.SECCIONES.filter(function (s) { return typeof lec[s.clave] !== 'string' || !lec[s.clave].trim(); });
  assert(vacias.length === 0, 'L' + lec.id + ' has all 13 non-empty keys' + (vacias.length ? ' — missing: ' + vacias.map(function (s) { return s.clave; }).join(',') : ''));
});

// Neutral tuteo guard: blocklist of voseo forms (letter-class lookarounds; JS \b is ASCII-only).
var VOSEO = 'vos|sos|tenés|podés|querés|sabés|necesitás|avanzás|seguís|intentás|mirá|presioná|armá|observá|relacioná|confirmá|señalá|' +
  'recordá|cambiá|volvé|hacé|girá|usá|reemplazá|programá|colocá|alejá|pensá|revisá|agregá|seguí|esquivá|llegá|acordate|fijate';
var L = 'A-Za-zÁÉÍÓÚáéíóúñÑü';
var reVoseo = new RegExp('(?<![' + L + '])(' + VOSEO + ')(?![' + L + '])', 'gi');
var hallazgos = contentFuente.match(reVoseo) || [];
assert(hallazgos.length === 0, 'content.js has no voseo forms' + (hallazgos.length ? ': ' + hallazgos.join(', ') : ''));

console.log('');
console.log(total + ' tests, ' + fallidos + ' failed');
if (fallidos > 0) process.exit(1);
