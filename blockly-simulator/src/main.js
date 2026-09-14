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
    var homeEl = document.getElementById('home');
    var btnLeccionToggle = document.getElementById('btn-leccion-toggle');
    var btnVolverHome = document.getElementById('btn-volver-home');

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

    function mostrarWorkspace() {
      homeEl.hidden = true;
      appEl.hidden = false;
      resize(); // display:none -> visible is a 0x0 -> real size jump; ResizeObserver alone can't be trusted for it
    }

    function mostrarHome() {
      appEl.hidden = true;
      homeEl.hidden = false;
      renderizarHome(); // refleja lecciones recién desbloqueadas/completadas
    }

    function buscarLeccion(leccionId) {
      var lista = RS.lessons.CONTENIDO || [];
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === leccionId) return lista[i];
      }
      return null;
    }

    var homeListaEl = document.getElementById('home-lista');

    function renderizarHome() {
      if (!homeListaEl || !RS.lessons.home) return;
      RS.lessons.home.init(homeListaEl, {
        onIniciarLeccion: function (leccionId) {
          if (RS.lessons.progress && !RS.lessons.progress.estaDesbloqueada(leccionId)) return;
          var leccion = buscarLeccion(leccionId);
          RS.world.cargarMapa(leccion ? leccion.mapa : {});
          RS.robot.reset();
          workspace.clear();
          RS.lessons.panel.mostrarLeccion(leccionId);
          mostrarWorkspace();
        },
        onIniciarSandbox: function () {
          RS.world.cargarMapa({});
          RS.robot.reset();
          workspace.clear();
          RS.lessons.panel.mostrarSandbox();
          mostrarWorkspace();
        }
      });
    }

    if (homeEl && appEl) renderizarHome();

    if (btnVolverHome) {
      btnVolverHome.addEventListener('click', mostrarHome);
    }

    if (btnLeccionToggle && appEl) {
      var wLeccionPrevia = null; // recuerda el ancho arrastrado por el usuario para restaurarlo al expandir
      btnLeccionToggle.addEventListener('click', function () {
        var colapsada = appEl.classList.toggle('leccion-colapsada');
        btnLeccionToggle.setAttribute('aria-expanded', String(!colapsada));
        btnLeccionToggle.title = colapsada ? 'Expandir panel de lección' : 'Colapsar panel de lección';

        // El drag deja --w-leccion como estilo inline, que siempre le gana a la
        // regla CSS de .leccion-colapsada. Hay que pisarlo/restaurarlo a mano.
        if (colapsada) {
          wLeccionPrevia = appEl.style.getPropertyValue('--w-leccion') || null;
          appEl.style.setProperty('--w-leccion', '40px');
        } else if (wLeccionPrevia) {
          appEl.style.setProperty('--w-leccion', wLeccionPrevia);
        } else {
          appEl.style.removeProperty('--w-leccion');
        }

        resize();
      });
    }

    global.addEventListener('resize', resize);

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(resize);
      ro.observe(editorDiv);
      ro.observe(document.getElementById('sim'));
    }

    if (RS.ui.initPanelResize && appEl) {
      RS.ui.initPanelResize(appEl);
    }

    resize();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(typeof window !== 'undefined' ? window : this);
