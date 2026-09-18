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
    var editorMapaEl = document.getElementById('editor-mapa');
    var btnModoEditarMapa = document.getElementById('btn-modo-editar-mapa');
    var herramientasMapaEl = document.getElementById('editor-mapa-herramientas');

    var workspace = Blockly.inject(editorDiv, {
      toolbox: RS.toolbox,
      theme: crearTema(),
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.9 },
      grid: { spacing: 20, length: 3, colour: '#2b3948', snap: true }
    });

    RS.lessons.panel.init(document.getElementById('leccion-body'), {
      onSolicitarSiguiente: avanzarDespuesDeCompletar
    });

    RS.ui.initHighlight(workspace);
    RS.ui.feedback.init(feedbackDiv);
    if (RS.ui.sensorReadout) {
      RS.ui.sensorReadout.init(
        document.getElementById('sensor-distancia'),
        document.getElementById('sensor-obstaculo')
      );
    }
    RS.ui.codePanel.init(workspace, codigoDiv);
    RS.ui.initControls(workspace, {
      ejecutar: document.getElementById('btn-ejecutar'),
      detener: document.getElementById('btn-detener'),
      reiniciar: document.getElementById('btn-reiniciar')
    });

    var ctx = RS.renderer.ajustarCanvas(canvas);
    RS.runtime.scheduler.iniciarBucle(ctx);

    if (RS.ui.mapEditor) RS.ui.mapEditor.init(canvas);

    function salirDeModoEdicion() {
      if (!RS.ui.mapEditor) return;
      RS.ui.mapEditor.establecerModoEdicion(false);
      if (btnModoEditarMapa) btnModoEditarMapa.setAttribute('aria-pressed', 'false');
      if (herramientasMapaEl) herramientasMapaEl.hidden = true;
    }

    if (btnModoEditarMapa && RS.ui.mapEditor) {
      btnModoEditarMapa.addEventListener('click', function () {
        var activo = !RS.ui.mapEditor.enModoEdicion();
        RS.ui.mapEditor.establecerModoEdicion(activo);
        btnModoEditarMapa.setAttribute('aria-pressed', String(activo));
        if (herramientasMapaEl) herramientasMapaEl.hidden = !activo;
      });
    }

    if (herramientasMapaEl && RS.ui.mapEditor) {
      var botonesHerramienta = herramientasMapaEl.querySelectorAll('button[data-herramienta]');
      for (var h = 0; h < botonesHerramienta.length; h++) {
        botonesHerramienta[h].addEventListener('click', function (evt) {
          var nombre = evt.currentTarget.getAttribute('data-herramienta');
          RS.ui.mapEditor.establecerHerramienta(nombre);
          for (var k = 0; k < botonesHerramienta.length; k++) {
            botonesHerramienta[k].classList.remove('herramienta-activa');
          }
          evt.currentTarget.classList.add('herramienta-activa');
        });
      }
    }

    function resize() {
      Blockly.svgResize(workspace);
    }

    var MS_TRANSICION_HOME = 220; // matches #home's CSS transition duration

    function mostrarWorkspace() {
      homeEl.classList.add('home-saliendo');
      global.setTimeout(function () {
        homeEl.hidden = true;
        homeEl.classList.remove('home-saliendo');
        appEl.hidden = false;
        resize(); // display:none -> visible is a 0x0 -> real size jump; ResizeObserver alone can't be trusted for it
      }, MS_TRANSICION_HOME);
    }

    function mostrarHome() {
      if (RS.lessons.panel) RS.lessons.panel.cerrarBannerSiguiente();
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

    // Lesson 1 is pure identification (no block-building required), but it
    // now has a real goal too: this hardcodes INICIO -> avanzar(1167) ->
    // detener() straight into the live Blockly workspace so the student
    // presses Ejecutar and watches the robot reach it. 1167 is the exact ms
    // value verified against the real scheduler for Lesson 1's meta/geometry
    // (see src/lessons/content.js's GRID_LECCION_1 comment) — it MUST stay in
    // sync with that map's meta region and with content.js's `ejemplo` text.
    // Deliberately hardcoded/lesson-1-specific rather than a generic
    // "preloaded program" mechanism: no other lesson needs one.
    var MS_PRECARGA_LECCION_1 = 1167;

    function precargarProgramaLeccion1(ws) {
      var inicio = ws.newBlock('rs_inicio');
      var avanzar = ws.newBlock('rs_avanzar');
      var numero = ws.newBlock('rs_numero');
      var detener = ws.newBlock('rs_detener');

      inicio.initSvg();
      avanzar.initSvg();
      numero.initSvg();
      detener.initSvg();

      numero.getField('NUM').setValue(MS_PRECARGA_LECCION_1);

      inicio.nextConnection.connect(avanzar.previousConnection);
      avanzar.nextConnection.connect(detener.previousConnection);
      avanzar.getInput('MS').connection.connect(numero.outputConnection);

      inicio.render();
      avanzar.render();
      numero.render();
      detener.render();

      inicio.moveBy(40, 40);
      Blockly.svgResize(ws);
    }

    function irALeccion(leccionId) {
      if (RS.lessons.progress && !RS.lessons.progress.estaDesbloqueada(leccionId)) return;
      var leccion = buscarLeccion(leccionId);
      RS.world.cargarMapa(leccion ? leccion.mapa : {});
      RS.robot.reset();
      workspace.clear();
      if (RS.toolbox.paraLeccion) workspace.updateToolbox(RS.toolbox.paraLeccion(leccionId));
      if (leccionId === 1) precargarProgramaLeccion1(workspace);
      RS.lessons.panel.mostrarLeccion(leccionId);
      // The map editor is sandbox-only: never active during a graded lesson.
      salirDeModoEdicion();
      if (editorMapaEl) editorMapaEl.hidden = true;
      mostrarWorkspace();
    }

    // Called from the lesson panel's "next lesson" modal once a lesson is
    // completed: goes back to the full-screen Home reading view for the next
    // incomplete lesson (or the "module complete" screen), never straight
    // into the simulator — the student starts the next challenge from there.
    function avanzarDespuesDeCompletar() {
      mostrarHome();
    }

    var homeListaEl = document.getElementById('home-lista');

    function renderizarHome() {
      if (!homeListaEl || !RS.lessons.home) return;
      RS.lessons.home.init(homeListaEl, {
        onIniciarLeccion: irALeccion,
        onIniciarSandbox: function () {
          // Loads the saved custom sandbox map from localStorage if
          // present/valid, else a fresh empty grid map (replaces the
          // previous hardcoded RS.world.cargarMapa({})).
          if (RS.ui.mapEditor) {
            RS.ui.mapEditor.iniciarSandbox();
          } else {
            RS.world.cargarMapa({});
          }
          RS.robot.reset();
          workspace.clear();
          workspace.updateToolbox(RS.toolbox);
          RS.lessons.panel.mostrarSandbox();
          salirDeModoEdicion();
          if (editorMapaEl) editorMapaEl.hidden = false;
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
