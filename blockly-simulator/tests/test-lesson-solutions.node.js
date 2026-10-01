/**
 * Headless Node regression test: every lesson L1-L7 has a reference solution
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
function av(ms) { return { tipo: 'accion', accion: 'avanzar', valor: ms, blockId: 'b' }; }
function der(ms) { return { tipo: 'accion', accion: 'derecha', valor: ms, blockId: 'b' }; }
function izq(ms) { return { tipo: 'accion', accion: 'izquierda', valor: ms, blockId: 'b' }; }
function det() { return { tipo: 'accion', accion: 'detener', valor: 0, blockId: 'b' }; }
function siHay(cuerpo) { return { tipo: 'si', sensor: 'hayObstaculo', cuerpo: cuerpo, blockId: 'b' }; }
function siSino(cuerpo, sino) { return { tipo: 'si_sino', sensor: 'hayObstaculo', cuerpo: cuerpo, sino: sino, blockId: 'b' }; }
function hasta(cuerpo) { return { tipo: 'repetir_hasta', sensor: 'hayObstaculo', cuerpo: cuerpo, blockId: 'b' }; }
function rep(veces, cuerpo) { return { tipo: 'repetir', veces: veces, cuerpo: cuerpo, blockId: 'b' }; }

/** Runs `arbol` on lesson `n`'s real map; returns the snapshot panel.js would build. */
function correr(n, arbol, conInicial) {
  var lec = lecciones[n - 1];
  var sch = RS.runtime.scheduler;
  RS.world.cargarMapa(lec.mapa);
  sch.reiniciar();
  sch.iniciarConArbol(arbol);
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

function cerca(snap, x, y) {
  return Math.abs(snap.estado.x - x) <= 0.5 && Math.abs(snap.estado.y - y) <= 0.5;
}

// The 7 reference solutions (design geometry; ms = round(px / 0.12)).
var MS1 = RS.lessons.MS_PRECARGA_LECCION_1;
var pasoL7 = [hasta([av(125)]), der(500)];
var refL7 = pasoL7.concat(pasoL7, pasoL7, pasoL7, pasoL7, [hasta([av(125)])]);
var refL5 = [hasta([av(100)]), der(500), rep(40, [siSino([det()], [av(100)])])];
var referencias = [
  { n: 1, arbol: [av(MS1), det()], x: 60 + MS1 * 0.12, y: 300 },
  { n: 2, arbol: [av(2500), det()], x: 360, y: 300 },
  { n: 3, arbol: [av(1250), der(500), av(500), izq(500), av(1900), izq(500), av(917), der(500), av(2000)], x: 678, y: 249.96 },
  { n: 4, arbol: [hasta([av(100)])], x: 600, y: 300, sensor: true },
  { n: 5, arbol: refL5, x: 480, y: 404, sensor: true },
  { n: 6, arbol: [hasta([av(100)])], x: 600, y: 300, sensor: true },
  { n: 7, arbol: refL7, x: 520, y: 325, sensor: true }
];

referencias.forEach(function (r) {
  var s = correr(r.n, r.arbol);
  var dentro = cerca(s, r.x, r.y);
  assert(s.ok.ok && s.resultadoRun !== 'error' && dentro,
    'L' + r.n + ' reference solution passes; final pose ' + s.pose + ', expected (' + r.x + ',' + r.y + ')' +
    (s.ok.ok ? '' : ' — criterio failed: ' + s.ok.observado));
  if (r.sensor) assert(s.metricas.evalsSensor >= 1, 'L' + r.n + ' reference consults the sensor (evalsSensor=' + s.metricas.evalsSensor + ')');
});

// L1 geometric check: center inside meta x in [320,520] via the shared constant.
var s1 = correr(1, [av(MS1), det()]);
assert(s1.estado.x >= 320 && s1.estado.x <= 520, 'L1 shared constant ' + MS1 + ' ends inside meta (x=' + s1.estado.x.toFixed(2) + ')');

// Sensor-threshold behavior (L4): 3900 ms stops at x=528 with no obstacle detected.
var s4 = correr(4, [av(3900), siHay([det()])]);
assert(Math.abs(s4.estado.x - 528) <= 0.5 && s4.hayObstaculo === false, 'L4 avanzar(3900) stops at x=528 without hayObstaculo (' + s4.pose + ')');

// Non-passing runs: no collision, ok=false.
var n3 = correr(3, [av(1250), der(500), av(500)]);
assert(!n3.ok.ok && n3.resultadoRun !== 'error' && cerca(n3, 210, 360), 'L3 ejemplo ends at (210,360) without passing; got ' + n3.pose);
var m3 = correr(3, [av(1250), av(500), der(500)]);
assert(m3.resultadoRun === 'error' && !m3.ok.ok, 'L3 modificacion (swapped last two blocks) hits pillar 1; got ' + m3.resultadoRun + ' at ' + m3.pose);
var refL5SinGiro = [hasta([av(100)]), rep(40, [siSino([det()], [av(100)])])];
var n5 = correr(5, refL5SinGiro);
assert(!n5.ok.ok && n5.resultadoRun !== 'error' && cerca(n5, 480, 140) && /misma altura/.test(n5.ok.observado),
  'L5 variant without derecha(500) ends at (480,140) with "misma altura" feedback; got ' + n5.pose + ' / ' + n5.ok.observado);
var n7 = correr(7, [hasta([av(100)]), der(500)]);
assert(!n7.ok.ok && n7.resultadoRun !== 'error', 'L7 ejemplo does not pass and does not collide; got ' + n7.pose);
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

// Text anchors: each ejemplo quotes its reference ms; stale L1/L2 values are gone.
[[1, 'avanzar(' + MS1 + ')'], [2, 'avanzar(2500)'], [3, 'avanzar(1250)'], [4, 'repetir hasta hayObstaculo() { avanzar(100) }'], [5, 'repetir 40 veces']]
  .forEach(function (a) {
    assert(lecciones[a[0] - 1].ejemplo.indexOf(a[1]) !== -1, 'L' + a[0] + ' ejemplo contains ' + a[1]);
  });
[1, 2].forEach(function (n) {
  var texto = JSON.stringify(lecciones[n - 1]);
  assert(!/1167|1833/.test(texto), 'L' + n + ' text has no stale 1167/1833 ms');
});
assert(!/dos obst/i.test(lecciones[6].criterioTexto + lecciones[6].desafio), 'L7 text does not mention two obstacles');

// L1 drift guard: main.js preload must equal the value quoted in the L1 ejemplo.
var literalMain = /MS_PRECARGA_LECCION_1\s*=\s*(\d+)/.exec(mainFuente);
var usaConstante = /=\s*RS\.lessons\.MS_PRECARGA_LECCION_1/.test(mainFuente);
var msMain = literalMain ? Number(literalMain[1]) : (usaConstante ? MS1 : null);
var ejemploMs = /avanzar\((\d+)\)/.exec(lecciones[0].ejemplo);
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
