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

// 5. the "si" node generates the non-simulable-sensor comment and does NOT
//    generate a real call to hayObstaculo() in the guion (setup's script).
var lineaSi = resultado.lineas.filter(function (l) { return l.blockId === 's1'; })[0];
assert(!!lineaSi, 'el nodo si mapea su blockId a una linea del sketch');
assert(lineaSi.texto.indexOf('ATENCION') !== -1, 'la linea del nodo si contiene el comentario ATENCION');
assert(lineaSi.seccion === 'guion', 'la linea del nodo si vive en la seccion guion (dentro de setup)');

var lineasGuion = resultado.lineas.filter(function (l) { return l.seccion === 'guion'; });
var hayLlamadaRealAHayObstaculo = lineasGuion.some(function (l) {
  return /(^|[^/])hayObstaculo\(\)/.test(l.texto) && l.texto.indexOf('//') !== 0;
});
assert(!hayLlamadaRealAHayObstaculo, 'ninguna linea del guion contiene una llamada REAL a hayObstaculo() (solo el comentario)');
assert(resultado.lineas.filter(function (l) { return l.blockId === 'p1'; }).length === 0, 'el cuerpo del si (detener) no se tradujo a codigo ejecutable en el guion');

// The stub itself IS defined (documentation only), never invoked from the guion.
assert(texto.indexOf('bool hayObstaculo() { return false; }') !== -1, 'se emite el stub honesto hayObstaculo() porque el arbol usa un nodo si');

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

console.log('\n' + (fallidos === 0 ? 'TODOS LOS TESTS PASARON' : (fallidos + ' TEST(S) FALLARON')) + ' (' + (total - fallidos) + '/' + total + ')');
process.exit(fallidos === 0 ? 0 : 1);
