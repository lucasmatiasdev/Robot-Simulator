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

  // Dark workspace theme. Literal hex mirrors the --n-* ramp in styles/main.css;
  // Blockly reads componentStyles in JS, so CSS custom properties cannot be used.
  function crearTema() {
    return Blockly.Theme.defineTheme('rs-dark', {
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: '#1c2733', // --n-700
        toolboxBackgroundColour: '#141b24',   // --n-800
        toolboxForegroundColour: '#e8edf3',   // --n-100
        flyoutBackgroundColour: '#141b24',    // --n-800
        flyoutOpacity: 1,                     // overrides default fill-opacity .8
        scrollbarColour: '#64748b',           // --n-400
        insertionMarkerColour: '#e8edf3',     // --n-100
        cursorColour: '#e8edf3'               // --n-100
      }
    });
  }

  function iniciar() {
    var editorDiv = document.getElementById('editor-blockly');
    var canvas = document.getElementById('sim-canvas');
    var codigoDiv = document.getElementById('codigo-panel');
    var feedbackDiv = document.getElementById('feedback-linea');
    var appEl = document.getElementById('app');
    var btnLeccionToggle = document.getElementById('btn-leccion-toggle');

    var workspace = Blockly.inject(editorDiv, {
      toolbox: RS.toolbox,
      theme: crearTema(),
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.9 },
      grid: { spacing: 20, length: 3, colour: '#2b3948', snap: true }
    });

    RS.lessons.panel.init(document.getElementById('leccion-body'));

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

    if (btnLeccionToggle && appEl) {
      btnLeccionToggle.addEventListener('click', function () {
        var colapsada = appEl.classList.toggle('leccion-colapsada');
        btnLeccionToggle.setAttribute('aria-expanded', String(!colapsada));
        btnLeccionToggle.title = colapsada ? 'Expandir panel de lección' : 'Colapsar panel de lección';
        resize();
      });
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
