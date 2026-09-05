/**
 * RS main wiring. Runs on DOMContentLoaded: injects the Blockly workspace
 * into #editor, wires toolbox/generator/sim/runtime/UI modules together,
 * and keeps the Blockly SVG sized correctly on panel/window resize.
 *
 * No cross-session persistence: the workspace is never saved to or loaded
 * from localStorage. Every reload starts empty.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};

  function iniciar() {
    var editorDiv = document.getElementById('editor-blockly');
    var canvas = document.getElementById('sim-canvas');
    var codigoDiv = document.getElementById('codigo-panel');
    var feedbackDiv = document.getElementById('feedback-linea');

    var workspace = Blockly.inject(editorDiv, {
      toolbox: RS.toolbox,
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.9 },
      grid: { spacing: 20, length: 3, colour: '#e6e6e6', snap: true }
    });

    RS.ui.initHighlight(workspace);
    RS.ui.feedback.init(feedbackDiv);
    RS.ui.codePanel.init(workspace, codigoDiv);
    RS.ui.initControls(workspace, {
      ejecutar: document.getElementById('btn-ejecutar'),
      detener: document.getElementById('btn-detener'),
      reiniciar: document.getElementById('btn-reiniciar')
    });

    var ctx = RS.renderer.ajustarCanvas(canvas);
    RS.runtime.scheduler.iniciarBucle(ctx);

    function resize() {
      Blockly.svgResize(workspace);
    }

    global.addEventListener('resize', resize);

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(resize);
      ro.observe(editorDiv);
      ro.observe(document.getElementById('sim'));
    }

    resize();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(typeof window !== 'undefined' ? window : this);
