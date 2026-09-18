/**
 * Headless Node test for the Arduino UNO sketch generator (src/generator/cpp-view.js).
 * No browser, no bundler, no test runner/framework dependency — run directly:
 *
 *   node tests/test-arduino-sketch.node.js
 *
 * The production files attach to a global `RS` object via
 * `(function (global) { ... })(typeof window !== 'undefined' ? window : this)`.
 * Loading them with plain `require()` would give each file its own
 * `module.exports` as `this`, so instead we run them with Node's `vm` module
 * inside one shared sandbox exposing a `window` object — the same mechanism
 * a set of plain <script> tags gives them in the browser.
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
cargar('src/generator/cpp-view.js');

var RS = sandbox.window.RS;

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

// ---- Example tree: avanzar + repetir + si, matching the task's ask ----
var arbol = [
  { tipo: 'accion', accion: 'avanzar', valor: 1000, blockId: 'a1' },
  { tipo: 'repetir', veces: 4, blockId: 'r1', cuerpo: [
    { tipo: 'accion', accion: 'derecha', valor: 300, blockId: 'd1' }
  ] },
  { tipo: 'si', sensor: 'hayObstaculo', blockId: 's1', cuerpo: [
    { tipo: 'accion', accion: 'detener', blockId: 'p1' }
  ] }
];

var resultado = RS.cppView.render(arbol);
var texto = RS.cppView.renderTexto(arbol);

// 1. exactly one void setup() and one void loop()
assertEquals((texto.match(/void setup\(\)/g) || []).length, 1, 'contiene exactamente un void setup()');
assertEquals((texto.match(/void loop\(\)/g) || []).length, 1, 'contiene exactamente un void loop()');

// 2. no WiFi/MQTT/PubSubClient
assert(texto.indexOf('WiFi') === -1, 'no contiene "WiFi"');
assert(texto.indexOf('MQTT') === -1, 'no contiene "MQTT"');
assert(texto.indexOf('PubSubClient') === -1, 'no contiene "PubSubClient"');

// 3. pinMode for motor pins appears before their use
var idxSetup = texto.indexOf('void setup()');
var idxPinModeEna = texto.indexOf('pinMode(ENA, OUTPUT)');
var idxPinModeIn1 = texto.indexOf('pinMode(IN1, OUTPUT)');
var idxPinModeIn2 = texto.indexOf('pinMode(IN2, OUTPUT)');
var idxPinModeEnb = texto.indexOf('pinMode(ENB, OUTPUT)');
var idxPinModeIn3 = texto.indexOf('pinMode(IN3, OUTPUT)');
var idxPinModeIn4 = texto.indexOf('pinMode(IN4, OUTPUT)');
[idxPinModeEna, idxPinModeIn1, idxPinModeIn2, idxPinModeEnb, idxPinModeIn3, idxPinModeIn4].forEach(function (idx, i) {
  assert(idx !== -1 && idx > idxSetup, 'pinMode del pin motor #' + i + ' esta presente dentro de setup()');
});
var idxAvanzarCall = texto.indexOf('avanzar(1000);'); // inside setup's guion
assert(idxAvanzarCall > idxPinModeEna, 'pinMode ocurre antes de la primera llamada a avanzar()');

// 3b. TRIG/ECHO pin defines (cabecera) and pinMode calls (setup), always
//     emitted (fixed hardware wiring), matching RS.config.arduino.
assert(texto.indexOf('#define TRIG 2') !== -1, 'se define TRIG en la cabecera con el pin de RS.config.arduino.TRIG');
assert(texto.indexOf('#define ECHO 3') !== -1, 'se define ECHO en la cabecera con el pin de RS.config.arduino.ECHO');
var idxPinModeTrig = texto.indexOf('pinMode(TRIG, OUTPUT)');
var idxPinModeEcho = texto.indexOf('pinMode(ECHO, INPUT)');
assert(idxPinModeTrig !== -1 && idxPinModeTrig > idxSetup, 'pinMode(TRIG, OUTPUT) esta presente dentro de setup()');
assert(idxPinModeEcho !== -1 && idxPinModeEcho > idxSetup, 'pinMode(ECHO, INPUT) esta presente dentro de setup()');

// 4. izquierda function writes the correct pin pattern
//    girarIzquierda = motor1 (izq) atras (IN1 LOW, IN2 HIGH), motor2 (der) adelante (IN3 HIGH, IN4 LOW)
var idxIzq = texto.indexOf('void girarIzquierda');
var idxIzqCierre = texto.indexOf('\n}', idxIzq);
var cuerpoIzq = texto.substring(idxIzq, idxIzqCierre);
assert(/digitalWrite\(IN1, LOW\);/.test(cuerpoIzq), 'girarIzquierda: IN1 = LOW');
assert(/digitalWrite\(IN2, HIGH\);/.test(cuerpoIzq), 'girarIzquierda: IN2 = HIGH');
assert(/digitalWrite\(IN3, HIGH\);/.test(cuerpoIzq), 'girarIzquierda: IN3 = HIGH');
assert(/digitalWrite\(IN4, LOW\);/.test(cuerpoIzq), 'girarIzquierda: IN4 = LOW');

// Also verify the other three direction functions against the same table.
var idxAv = texto.indexOf('void avanzar');
var cuerpoAv = texto.substring(idxAv, texto.indexOf('\n}', idxAv));
assert(/IN1, HIGH\);[\s\S]*IN2, LOW\);[\s\S]*IN3, HIGH\);[\s\S]*IN4, LOW\);/.test(cuerpoAv), 'avanzar: IN1 H, IN2 L, IN3 H, IN4 L (ambos motores adelante)');

var idxRet = texto.indexOf('void retroceder');
var cuerpoRet = texto.substring(idxRet, texto.indexOf('\n}', idxRet));
assert(/IN1, LOW\);[\s\S]*IN2, HIGH\);[\s\S]*IN3, LOW\);[\s\S]*IN4, HIGH\);/.test(cuerpoRet), 'retroceder: IN1 L, IN2 H, IN3 L, IN4 H (ambos motores atras)');

var idxDer = texto.indexOf('void girarDerecha');
var cuerpoDer = texto.substring(idxDer, texto.indexOf('\n}', idxDer));
assert(/IN1, HIGH\);[\s\S]*IN2, LOW\);[\s\S]*IN3, LOW\);[\s\S]*IN4, HIGH\);/.test(cuerpoDer), 'girarDerecha: IN1 H, IN2 L, IN3 L, IN4 H (motor1 adelante, motor2 atras)');

// detener: all four LOW + both PWM channels to 0
var idxDet = texto.indexOf('void detener');
var cuerpoDet = texto.substring(idxDet, texto.indexOf('\n}', idxDet));
assert(/IN1, LOW\);[\s\S]*IN2, LOW\);[\s\S]*IN3, LOW\);[\s\S]*IN4, LOW\);/.test(cuerpoDet), 'detener: las 4 direcciones en LOW');
assert(/analogWrite\(ENA, 0\);/.test(cuerpoDet) && /analogWrite\(ENB, 0\);/.test(cuerpoDet), 'detener: ambos PWM a 0');
assert(idxDet < idxSetup, 'detener() se define primero (antes de setup()), sin necesidad de forward declaration');

// 5. the "si" node generates a REAL if (hayObstaculo()) { ... } and DOES
//    translate its body into executable code in the guion (setup's script).
var lineaSi = resultado.lineas.filter(function (l) { return l.blockId === 's1'; })[0];
assert(!!lineaSi, 'el nodo si mapea su blockId a una linea del sketch');
assertEquals(lineaSi.texto, 'if (hayObstaculo()) {', 'la linea del nodo si emite un if (hayObstaculo()) real');
assert(lineaSi.seccion === 'guion', 'la linea del nodo si vive en la seccion guion (dentro de setup)');

var lineasGuion = resultado.lineas.filter(function (l) { return l.seccion === 'guion'; });
var hayLlamadaRealAHayObstaculo = lineasGuion.some(function (l) {
  return /(^|[^/])hayObstaculo\(\)/.test(l.texto) && l.texto.indexOf('//') !== 0;
});
assert(hayLlamadaRealAHayObstaculo, 'una linea del guion contiene una llamada REAL a hayObstaculo()');
assert(resultado.lineas.filter(function (l) { return l.blockId === 'p1'; }).length === 1, 'el cuerpo del si (detener) SI se tradujo a codigo ejecutable en el guion');

// The real HC-SR04 driver is emitted (medirDistancia() reads pulseIn, hayObstaculo() wraps it).
assert(texto.indexOf('int medirDistancia() {') !== -1, 'se emite el driver real medirDistancia() porque el arbol usa un nodo si');
assert(texto.indexOf('pulseIn(ECHO, HIGH, 30000UL)') !== -1, 'medirDistancia() usa pulseIn() con timeout sobre ECHO');
assert(texto.indexOf('bool hayObstaculo() { return medirDistancia() <= UMBRAL_OBSTACULO; }') !== -1, 'hayObstaculo() delega en medirDistancia() y UMBRAL_OBSTACULO');

// 6. loop() calls no movement function
var idxLoop = texto.indexOf('void loop()');
var cuerpoLoop = texto.substring(idxLoop);
assert(!/\bavanzar\(\d|\bretroceder\(\d|\bgirarIzquierda\(\d|\bgirarDerecha\(\d/.test(cuerpoLoop), 'loop() no llama a ninguna funcion de movimiento');

// ---- bonus: repetir unrolls as a real, compilable for loop ----
var lineaRepetir = resultado.lineas.filter(function (l) { return l.blockId === 'r1'; })[0];
assert(/^for \(int i = 0; i < 4; i\+\+\) \{$/.test(lineaRepetir.texto), 'repetir(4) se desenrolla como un for real compilable, no "repetir(4){}"');

// ---- bonus: firmware reference files are read-only / never touched by generation ----
var mqttHandlerPath = path.join(ROOT, '..', 'example', 'control_PaperOne', 'mqtt_handler.h');
if (fs.existsSync(mqttHandlerPath)) {
  var antes = fs.statSync(mqttHandlerPath).mtimeMs;
  RS.cppView.render(arbol); // run generation again
  var despues = fs.statSync(mqttHandlerPath).mtimeMs;
  assertEquals(antes, despues, 'example/control_PaperOne/mqtt_handler.h no fue modificado por la generacion');
}

// ---- rs_si_sino (if/else): real if/else emission, both branches translated ----
// ---- into executable code; sketch remains compilable ----
var arbolSiSino = [
  { tipo: 'accion', accion: 'avanzar', valor: 1200, blockId: 'av1' },
  { tipo: 'si_sino', sensor: 'hayObstaculo', blockId: 'ss1',
    cuerpo: [{ tipo: 'accion', accion: 'derecha', valor: 500, blockId: 'ssd1' }],
    sino: [{ tipo: 'accion', accion: 'avanzar', valor: 1000, blockId: 'sse1' }] }
];
var resultadoSiSino = RS.cppView.render(arbolSiSino);
var textoSiSino = RS.cppView.renderTexto(arbolSiSino);

assertEquals((textoSiSino.match(/void setup\(\)/g) || []).length, 1, 'si_sino: contiene exactamente un void setup()');
assertEquals((textoSiSino.match(/void loop\(\)/g) || []).length, 1, 'si_sino: contiene exactamente un void loop()');

var lineaSiSino = resultadoSiSino.lineas.filter(function (l) { return l.blockId === 'ss1'; })[0];
assert(!!lineaSiSino, 'si_sino: el nodo mapea su blockId a una linea del sketch');
assertEquals(lineaSiSino.texto, 'if (hayObstaculo()) {', 'si_sino: la linea emite un if (hayObstaculo()) real');
assert(lineaSiSino.seccion === 'guion', 'si_sino: la linea vive en la seccion guion (dentro de setup)');
assert(textoSiSino.indexOf('} else {') !== -1, 'si_sino: emite un else real');

var lineasGuionSiSino = resultadoSiSino.lineas.filter(function (l) { return l.seccion === 'guion'; });
var hayLlamadaRealSiSino = lineasGuionSiSino.some(function (l) {
  return /(^|[^/])hayObstaculo\(\)/.test(l.texto) && l.texto.indexOf('//') !== 0;
});
assert(hayLlamadaRealSiSino, 'si_sino: una linea del guion contiene una llamada REAL a hayObstaculo()');
assert(resultadoSiSino.lineas.filter(function (l) { return l.blockId === 'ssd1'; }).length === 1, 'si_sino: la rama DO (derecha) SI se tradujo a codigo ejecutable');
assert(resultadoSiSino.lineas.filter(function (l) { return l.blockId === 'sse1'; }).length === 1, 'si_sino: la rama ELSE (avanzar) SI se tradujo a codigo ejecutable');
assert(textoSiSino.indexOf('int medirDistancia() {') !== -1, 'si_sino: se emite el driver real medirDistancia() porque el arbol usa un nodo si_sino');

var idxLoopSiSino = textoSiSino.indexOf('void loop()');
var cuerpoLoopSiSino = textoSiSino.substring(idxLoopSiSino);
assert(!/\bavanzar\(\d|\bretroceder\(\d|\bgirarIzquierda\(\d|\bgirarDerecha\(\d/.test(cuerpoLoopSiSino), 'si_sino: loop() no llama a ninguna funcion de movimiento');

// ---- rs_repetir_hasta: real counter-guarded for loop (pre-test "while not" ----
// ---- semantics + MAX_ITER_REPETIR_HASTA safety cap), body translated ----
var arbolRepetirHasta = [
  { tipo: 'repetir_hasta', sensor: 'hayObstaculo', blockId: 'rh1',
    cuerpo: [{ tipo: 'accion', accion: 'avanzar', valor: 100, blockId: 'rhd1' }] },
  { tipo: 'accion', accion: 'detener', blockId: 'despues1' }
];
var resultadoRepetirHasta = RS.cppView.render(arbolRepetirHasta);
var textoRepetirHasta = RS.cppView.renderTexto(arbolRepetirHasta);

assertEquals((textoRepetirHasta.match(/void setup\(\)/g) || []).length, 1, 'repetir_hasta: contiene exactamente un void setup()');
assertEquals((textoRepetirHasta.match(/void loop\(\)/g) || []).length, 1, 'repetir_hasta: contiene exactamente un void loop()');

var lineaRepetirHasta = resultadoRepetirHasta.lineas.filter(function (l) { return l.blockId === 'rh1'; })[0];
assert(!!lineaRepetirHasta, 'repetir_hasta: el nodo mapea su blockId a una linea del sketch');
assertEquals(lineaRepetirHasta.texto, 'for (int i = 0; i < 1000 && !(hayObstaculo()); i++) {', 'repetir_hasta: emite un for real con tope de seguridad y condicion negada');
assert(lineaRepetirHasta.seccion === 'guion', 'repetir_hasta: la linea vive en la seccion guion (dentro de setup)');
assertEquals(resultadoRepetirHasta.lineasPorBloque.rh1.length, 1, 'repetir_hasta: el blockId mapea solo a su(s) linea(s) de cabecera, no a una linea de cierre separada');

var lineasGuionRepetirHasta = resultadoRepetirHasta.lineas.filter(function (l) { return l.seccion === 'guion'; });
var hayLlamadaRealRepetirHasta = lineasGuionRepetirHasta.some(function (l) {
  return /(^|[^/])hayObstaculo\(\)/.test(l.texto) && l.texto.indexOf('//') !== 0;
});
assert(hayLlamadaRealRepetirHasta, 'repetir_hasta: una linea del guion contiene una llamada REAL a hayObstaculo()');
assert(resultadoRepetirHasta.lineas.filter(function (l) { return l.blockId === 'rhd1'; }).length === 1, 'repetir_hasta: el cuerpo (avanzar) SI se tradujo a codigo ejecutable en el guion');
assert(textoRepetirHasta.indexOf('int medirDistancia() {') !== -1, 'repetir_hasta: se emite el driver real medirDistancia() porque el arbol usa un nodo repetir_hasta');
assert(textoRepetirHasta.indexOf('1000 iteraciones, igual al del simulador') !== -1, 'repetir_hasta: el comentario documenta el tope de seguridad compartido con el simulador');
assert(resultadoRepetirHasta.lineas.filter(function (l) { return l.blockId === 'despues1'; }).length === 1, 'repetir_hasta: el resto del programa (despues del loop) SI se traduce a codigo ejecutable');

var idxLoopRepetirHasta = textoRepetirHasta.indexOf('void loop()');
var cuerpoLoopRepetirHasta = textoRepetirHasta.substring(idxLoopRepetirHasta);
assert(!/\bavanzar\(\d|\bretroceder\(\d|\bgirarIzquierda\(\d|\bgirarDerecha\(\d/.test(cuerpoLoopRepetirHasta), 'repetir_hasta: loop() no llama a ninguna funcion de movimiento');

// ---- esperar (wait) action maps to Arduino's built-in delay(ms) ----
var arbolEspera = [
  { tipo: 'accion', accion: 'esperar', valor: 750, blockId: 'e1' }
];
var textoEspera = RS.cppView.renderTexto(arbolEspera);
assert(textoEspera.indexOf('delay(750);') !== -1, 'esperar(750) genera delay(750); en el sketch');
assert(textoEspera.indexOf('void esperar') === -1, 'esperar() no genera una funcion custom (usa el delay() nativo)');

// ---- rs_comparar condition-to-C++ translation (si / si_sino / repetir_hasta ----
// ---- with a swapped-in comparator instead of the default hayObstaculo() shadow) ----
var arbolComparar = [
  { tipo: 'si', condicion: { op: '<', izq: { k: 'medirDistancia' }, der: { k: 'numero', v: 20 } }, blockId: 'cmp1',
    cuerpo: [{ tipo: 'accion', accion: 'detener', blockId: 'cmp1d' }] },
  { tipo: 'si_sino', condicion: { op: '==', izq: { k: 'hayObstaculo' }, der: { k: 'numero', v: 1 } }, blockId: 'cmp2',
    cuerpo: [{ tipo: 'accion', accion: 'detener', blockId: 'cmp2d' }],
    sino: [{ tipo: 'accion', accion: 'avanzar', valor: 200, blockId: 'cmp2e' }] },
  { tipo: 'repetir_hasta', condicion: { op: '>=', izq: { k: 'medirDistancia' }, der: { k: 'numero', v: 50 } }, blockId: 'cmp3',
    cuerpo: [{ tipo: 'accion', accion: 'derecha', valor: 100, blockId: 'cmp3d' }] }
];
var resultadoComparar = RS.cppView.render(arbolComparar);

var lineaCmp1 = resultadoComparar.lineas.filter(function (l) { return l.blockId === 'cmp1'; })[0];
assertEquals(lineaCmp1.texto, 'if (medirDistancia() < 20) {', 'rs_comparar: si con medirDistancia() < 20 se traduce literalmente');

var lineaCmp2 = resultadoComparar.lineas.filter(function (l) { return l.blockId === 'cmp2'; })[0];
assertEquals(lineaCmp2.texto, 'if (hayObstaculo() == 1) {', 'rs_comparar: si_sino con hayObstaculo() == 1 (comparado contra numero) se traduce literalmente');

var lineaCmp3 = resultadoComparar.lineas.filter(function (l) { return l.blockId === 'cmp3'; })[0];
assertEquals(lineaCmp3.texto, 'for (int i = 0; i < 1000 && !(medirDistancia() >= 50); i++) {', 'rs_comparar: repetir_hasta con medirDistancia() >= 50 se traduce literalmente (condicion negada en el for)');

console.log('\n' + (fallidos === 0 ? 'TODOS LOS TESTS PASARON' : (fallidos + ' TEST(S) FALLARON')) + ' (' + (total - fallidos) + '/' + total + ')');
process.exit(fallidos === 0 ? 0 : 1);
