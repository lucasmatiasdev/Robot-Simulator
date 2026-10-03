/**
 * Headless Node test for the lesson panel's manual "Marcar como completado"
 * button: shown on every lesson with a criterio except the last, never in the
 * sandbox, and clicking it persists completion and requests the next lesson.
 *
 *   node tests/test-lesson-skip-button.node.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

var ROOT = path.join(__dirname, '..');

function crearElemento(tag) {
  return {
    tag: tag, className: '', textContent: '', children: [], listeners: {},
    classList: { add: function () {}, remove: function () {} },
    set innerHTML(v) { this.children = []; },
    appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function (c) { this.children.splice(this.children.indexOf(c), 1); },
    addEventListener: function (ev, fn) { this.listeners[ev] = fn; }
  };
}

var sandbox = {
  window: {}, console: console,
  document: { createElement: crearElemento, body: crearElemento('body') }
};
vm.createContext(sandbox);
['src/config.js', 'src/sim/gridAdapter.js', 'src/lessons/content.js','src/lessons/progress.js', 'src/lessons/panel.js'].forEach(function (rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
});

var RS = sandbox.window.RS;
var contenido = RS.lessons.CONTENIDO;
var ultimoId = contenido[contenido.length - 1].id;
var avances = 0;

function botonSaltar(contenedor) {
  return contenedor.children.filter(function (c) {
    return c.tag === 'button' && c.textContent === 'Marcar como completado';
  })[0];
}

var contenedor = crearElemento('div');
RS.lessons.panel.init(contenedor, { onSolicitarSiguiente: function () { avances++; } });

// Shown on every criterio lesson except the last.
contenido.forEach(function (l) {
  RS.lessons.panel.mostrarLeccion(l.id);
  var boton = botonSaltar(contenedor);
  var esperado = !!l.criterio && l.id !== ultimoId;
  assert.strictEqual(!!boton, esperado, 'leccion ' + l.id + ' boton=' + esperado);
});

// Hidden in sandbox.
RS.lessons.panel.mostrarSandbox();
assert.strictEqual(botonSaltar(contenedor), undefined, 'sandbox sin boton');

// Click: persists completion and advances.
var objetivo = contenido.filter(function (l) { return l.criterio && l.id !== ultimoId; })[0];
RS.lessons.panel.mostrarLeccion(objetivo.id);
assert.strictEqual(RS.lessons.progress.estaCompletada(objetivo.id), false);
botonSaltar(contenedor).listeners.click();
assert.strictEqual(RS.lessons.progress.estaCompletada(objetivo.id), true, 'persistida');
assert.strictEqual(avances, 1, 'avanza una vez');

console.log('ok: boton Marcar como completado');
