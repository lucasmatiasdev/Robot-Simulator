/**
 * RS.ui.initPanelResize — draggable gutters between the four panels
 * (leccion, editor, sim, codigo). Each gutter drags one CSS custom
 * property on #app (--w-leccion, --w-editor, --h-codigo); the grid
 * template in styles/main.css reads those vars, so no layout math
 * happens here beyond clamping and delta-to-px conversion.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.ui = RS.ui || {};

  var MIN_LECCION = 220;
  var MAX_LECCION = 560;
  var MIN_EDITOR = 320;
  var MAX_EDITOR = 900;
  var MIN_CODIGO = 140;
  var MIN_SIM = 160; // reserved space kept for the sim row when dragging codigo taller

  function clamp(valor, min, max) {
    return Math.max(min, Math.min(max, valor));
  }

  function arrastrarColumna(appEl, gutterEl, varName, min, max, invertido) {
    gutterEl.addEventListener('pointerdown', function (ev) {
      if (appEl.classList.contains('leccion-colapsada') && varName === '--w-leccion') return;
      ev.preventDefault();
      var startX = ev.clientX;
      var startVal = parseFloat(getComputedStyle(appEl).getPropertyValue(varName)) || 0;
      appEl.classList.add('gutter-arrastrando');
      gutterEl.classList.add('gutter-activo');
      gutterEl.setPointerCapture(ev.pointerId);

      function mover(ev2) {
        var delta = ev2.clientX - startX;
        if (invertido) delta = -delta;
        var next = clamp(startVal + delta, min, max);
        appEl.style.setProperty(varName, next + 'px');
      }

      function soltar() {
        appEl.classList.remove('gutter-arrastrando');
        gutterEl.classList.remove('gutter-activo');
        gutterEl.removeEventListener('pointermove', mover);
        gutterEl.removeEventListener('pointerup', soltar);
        gutterEl.removeEventListener('pointercancel', soltar);
      }

      gutterEl.addEventListener('pointermove', mover);
      gutterEl.addEventListener('pointerup', soltar);
      gutterEl.addEventListener('pointercancel', soltar);
    });
  }

  function arrastrarFila(appEl, gutterEl, varName) {
    gutterEl.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      var startY = ev.clientY;
      var startVal = parseFloat(getComputedStyle(appEl).getPropertyValue(varName)) || 0;
      var maxCodigo = appEl.clientHeight - 48 - MIN_SIM - 6 - 4 * 12; // barra + gutter + gaps aproximados
      appEl.classList.add('gutter-arrastrando');
      gutterEl.classList.add('gutter-activo');
      gutterEl.setPointerCapture(ev.pointerId);

      function mover(ev2) {
        var delta = startY - ev2.clientY; // arrastrar hacia arriba agranda el panel de código
        var next = clamp(startVal + delta, MIN_CODIGO, Math.max(MIN_CODIGO, maxCodigo));
        appEl.style.setProperty(varName, next + 'px');
      }

      function soltar() {
        appEl.classList.remove('gutter-arrastrando');
        gutterEl.classList.remove('gutter-activo');
        gutterEl.removeEventListener('pointermove', mover);
        gutterEl.removeEventListener('pointerup', soltar);
        gutterEl.removeEventListener('pointercancel', soltar);
      }

      gutterEl.addEventListener('pointermove', mover);
      gutterEl.addEventListener('pointerup', soltar);
      gutterEl.addEventListener('pointercancel', soltar);
    });
  }

  RS.ui.initPanelResize = function (appEl) {
    var gv1 = document.getElementById('gutter-leccion-editor');
    var gv2 = document.getElementById('gutter-editor-sim');
    var gh1 = document.getElementById('gutter-sim-codigo');

    if (gv1) arrastrarColumna(appEl, gv1, '--w-leccion', MIN_LECCION, MAX_LECCION, false);
    if (gv2) arrastrarColumna(appEl, gv2, '--w-editor', MIN_EDITOR, MAX_EDITOR, false);
    if (gh1) arrastrarFila(appEl, gh1, '--h-codigo');
  };
})(window);
