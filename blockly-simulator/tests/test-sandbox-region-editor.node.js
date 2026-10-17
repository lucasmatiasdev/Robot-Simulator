/**
 * Headless Node test for the sandbox map editor's drag/region editing
 * (pointer handlers wired through a fake canvas) and the sandbox
 * goal-reached modal in the lesson panel.
 *
 *   node tests/test-sandbox-region-editor.node.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

var ROOT = path.join(__dirname, '..');
var CELDA = 40;

function crearElemento(tag) {
  return {
    tag: tag, className: '', textContent: '', children: [], listeners: {}, parentNode: null,
    classList: { add: function () {}, remove: function () {} },
    set innerHTML(v) { this.children = []; },
    appendChild: function (c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild: function (c) { this.children.splice(this.children.indexOf(c), 1); c.parentNode = null; },
    addEventListener: function (ev, fn) { this.listeners[ev] = fn; },
    setPointerCapture: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 800, height: 600 }; },
    style: {}
  };
}

var datos = {};
var sandbox = {
  window: {
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null; },
      setItem: function (k, v) { datos[k] = String(v); },
      removeItem: function (k) { delete datos[k]; }
    }
  },
  console: console,
  document: { createElement: crearElemento, body: crearElemento('body') }
};
vm.createContext(sandbox);
['src/config.js', 'src/sim/world.js', 'src/sim/gridAdapter.js', 'src/sim/robot.js', 'src/ui/mapEditor.js',
  'src/lessons/content.js', 'src/lessons/progress.js', 'src/lessons/panel.js', 'src/ui/lessonMapEditor.js'].forEach(function (rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
});
var RS = sandbox.window.RS;

// ---- Editor: drag painting through the fake canvas ----------------------
var canvas = crearElemento('canvas');
RS.ui.mapEditor.init(canvas);
RS.ui.mapEditor.iniciarSandbox();
RS.ui.mapEditor.establecerModoEdicion(true);

function evt(col, row) { return { clientX: col * CELDA + 5, clientY: row * CELDA + 5, button: 0, pointerId: 1 }; }
function arrastrar(a, b) {
  canvas.listeners.pointerdown(evt(a.col, a.row));
  canvas.listeners.pointermove(evt(b.col, b.row));
  canvas.listeners.pointerup(evt(b.col, b.row));
}

RS.ui.mapEditor.establecerHerramienta('muro');
arrastrar({ col: 3, row: 3 }, { col: 5, row: 3 });
var mapa = RS.ui.mapEditor.obtenerMapa();
assert.strictEqual(mapa.muros.length >= 1, true, 'drag de muro coloca celdas');
[3, 4, 5].forEach(function (c) {
  assert.strictEqual(RS.ui.lessonMapEditor._pure.celdaCubierta(mapa.muros, { col: c, row: 3 }), true, 'muro en col ' + c);
});

RS.ui.mapEditor.establecerHerramienta('borrar');
arrastrar({ col: 4, row: 3 }, { col: 4, row: 3 });
assert.strictEqual(RS.ui.lessonMapEditor._pure.celdaCubierta(mapa.muros, { col: 4, row: 3 }), false, 'borrar quita una celda');
assert.strictEqual(RS.ui.lessonMapEditor._pure.celdaCubierta(mapa.muros, { col: 3, row: 3 }), true, 'vecinas intactas');

RS.ui.mapEditor.establecerHerramienta('meta');
arrastrar({ col: 10, row: 5 }, { col: 12, row: 6 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(mapa.meta)), { col: 10, row: 5, colSpan: 3, rowSpan: 2 }, 'meta rectangular por drag');

// Persistence round trip with spanned regions passes validation.
var guardado = RS.ui.mapEditor._pure.cargarGuardado();
assert.ok(guardado, 'el mapa con regiones se guarda y valida al recargar');
assert.deepStrictEqual(JSON.parse(JSON.stringify(guardado.meta)), { col: 10, row: 5, colSpan: 3, rowSpan: 2 });

// Edit mode off -> no changes.
RS.ui.mapEditor.establecerModoEdicion(false);
RS.ui.mapEditor.establecerHerramienta('muro');
var antes = JSON.stringify(mapa);
arrastrar({ col: 8, row: 8 }, { col: 9, row: 8 });
assert.strictEqual(JSON.stringify(mapa), antes, 'sin modo edicion no se edita');

// ---- Panel: sandbox goal-reached modal ----------------------------------
var panel = RS.lessons.panel;
var contenedor = crearElemento('div');
panel.init(contenedor, {});
panel.mostrarSandbox();
var body = sandbox.document.body;

function ubicarRobotEnMeta(dentro) {
  var m = RS.world.meta;
  RS.robot.estado.x = dentro ? m.x + m.w / 2 : 1;
  RS.robot.estado.y = dentro ? m.y + m.h / 2 : 1;
}

ubicarRobotEnMeta(true);
panel._alCambiarEstadoScheduler('running');
panel._alCambiarEstadoScheduler('error');
assert.strictEqual(body.children.length, 0, 'colision no muestra modal');

panel._alCambiarEstadoScheduler('running');
ubicarRobotEnMeta(false);
panel._alCambiarEstadoScheduler('idle');
assert.strictEqual(body.children.length, 0, 'fuera de la meta no muestra modal');

panel._alCambiarEstadoScheduler('running');
ubicarRobotEnMeta(true);
panel._alCambiarEstadoScheduler('idle');
assert.strictEqual(body.children.length, 1, 'en la meta muestra el modal');
var tarjeta = body.children[0].children[0];
assert.strictEqual(tarjeta.children[0].textContent, '¡Llegaste a la meta!');
assert.strictEqual(tarjeta.children.length, 2, 'mensaje + un unico boton');
assert.strictEqual(tarjeta.children[1].textContent, 'Seguir practicando');
tarjeta.children[1].listeners.click();
assert.strictEqual(body.children.length, 0, 'el boton cierra el modal');

panel._alCambiarEstadoScheduler('running');
ubicarRobotEnMeta(true);
panel._alCambiarEstadoScheduler('stopped');
assert.strictEqual(body.children.length, 1, 'detener sobre la meta tambien avisa');
panel._alCambiarEstadoScheduler('running');
assert.strictEqual(body.children.length, 0, 're-ejecutar quita el modal');

panel._alCambiarEstadoScheduler('stopped');
RS.world.cargarMapa({});
panel._alCambiarEstadoScheduler('running');
panel._alCambiarEstadoScheduler('idle');
assert.strictEqual(body.children.length, 0, 'sin meta no hay modal');

console.log('ok: editor de regiones del sandbox y modal de meta');
