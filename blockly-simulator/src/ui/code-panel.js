/**
 * RS.ui.codePanel — renders RS.cppView line records into #codigo as a
 * read-only <pre> with one <div class="linea" data-block-id> per line and
 * a line-number gutter. Uses textContent only (never innerHTML), so block
 * field values can never inject markup.
 *
 * Debounced re-render on workspace.addChangeListener (ignoring CLICK,
 * SELECTED, VIEWPORT_CHANGE). Snapshotted on Ejecutar so a run's displayed
 * lines never shuffle underneath the active highlight; re-synced on stop.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.ui = RS.ui || {};

  var DEBOUNCE_MS = 120;
  var IGNORED_EVENTS = { click: true, selected: true, viewport_change: true };

  function crearCodePanel() {
    var contenedor = null;
    var workspace = null;
    var debounceHandle = null;
    var congelado = false; // true while a run's snapshot must not be replaced
    var lineasPorBloqueActual = {};
    var lineaActivaEl = null;

    function limpiarNodo(el) {
      while (el.firstChild) el.removeChild(el.firstChild);
    }

    function construirLinea(registro) {
      var div = document.createElement('div');
      div.className = 'linea';
      if (registro.blockId) div.setAttribute('data-block-id', registro.blockId);
      div.setAttribute('data-linea', String(registro.n));

      var gutter = document.createElement('span');
      gutter.className = 'gutter';
      gutter.textContent = String(registro.n);
      div.appendChild(gutter);

      var indentSpan = document.createElement('span');
      indentSpan.className = 'indent';
      indentSpan.textContent = '  '.repeat(registro.indent);
      div.appendChild(indentSpan);

      registro.tokens.forEach(function (t) {
        var span = document.createElement('span');
        span.className = t.clase || '';
        span.textContent = t.texto;
        div.appendChild(span);
      });

      return div;
    }

    function render(tree) {
      if (!contenedor) return;
      var resultado = RS.cppView.render(tree);
      lineasPorBloqueActual = resultado.lineasPorBloque;
      limpiarNodo(contenedor);
      lineaActivaEl = null;
      var pre = document.createElement('pre');
      pre.className = 'codigo-cpp';
      resultado.lineas.forEach(function (registro) {
        pre.appendChild(construirLinea(registro));
      });
      contenedor.appendChild(pre);
    }

    function renderDesdeWorkspace() {
      if (!workspace || congelado) return;
      var tree = RS.generator.buildProgramTree(workspace);
      render(tree);
    }

    function onWorkspaceChange(evento) {
      if (congelado) return;
      var tipo = (evento && evento.type ? String(evento.type) : '').toLowerCase();
      if (IGNORED_EVENTS[tipo]) return;
      if (debounceHandle) global.clearTimeout(debounceHandle);
      debounceHandle = global.setTimeout(renderDesdeWorkspace, DEBOUNCE_MS);
    }

    return {
      init: function (ws, container) {
        workspace = ws;
        contenedor = container;
        workspace.addChangeListener(onWorkspaceChange);
        renderDesdeWorkspace();
      },

      /** Renders an already-built program tree directly (used by tests / snapshot re-renders). */
      render: render,

      /** Freezes the panel at the current tree for the duration of a run. */
      snapshot: function () {
        congelado = true;
      },

      /** Re-syncs the panel with the live workspace after a run ends. */
      resync: function () {
        congelado = false;
        renderDesdeWorkspace();
      },

      marcarLinea: function (blockId) {
        if (lineaActivaEl) {
          lineaActivaEl.classList.remove('activa');
          lineaActivaEl = null;
        }
        if (!blockId || !contenedor) return;
        var lineas = lineasPorBloqueActual[blockId];
        if (!lineas || lineas.length === 0) return;
        var primeraLinea = lineas[0];
        var el = contenedor.querySelector('.linea[data-linea="' + primeraLinea + '"]');
        if (el) {
          el.classList.add('activa');
          lineaActivaEl = el;
          if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
        }
      }
    };
  }

  RS.ui.codePanel = crearCodePanel();
})(typeof window !== 'undefined' ? window : this);
