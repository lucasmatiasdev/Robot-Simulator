/**
 * RS.ui.lessonMapEditor — hidden authoring tool for lesson grid maps.
 *
 * Two layers. The PURE core (`_pure`) does region-aware editing of a
 * working grid map plus the serializer that prints the exact
 * `var GRID_LECCION_N = {...};` literal to paste into
 * src/lessons/content.js; it is headless-testable from
 * tests/test-lesson-map-editor.node.js and touches no DOM/canvas. The thin
 * DOM controller (init/abrir/cerrar/cargarLeccion/estaActivo) is wired by
 * main.js behind the `#editor-mapas` hash and is NOT covered by an
 * automated test (no headless browser in this repo) — it only touches the
 * DOM from init() onwards, never at load time. No persistence: nothing is
 * written to localStorage and lessons are never overridden at runtime.
 *
 * All editing functions mutate and return the working `mapa` (a deep copy
 * of `leccion.grid`, see `copiaProfunda`); `leccion.grid` itself is never
 * edited. Regions use the grid-map shape `{col, row, colSpan, rowSpan}`
 * where a span of 1 is omitted (the canonical content.js style).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.ui = RS.ui || {};

  /**
   * Reads RS.ui.mapEditor._pure at call time, not at load time, so the
   * script order between mapEditor.js and this file never matters.
   */
  function puroMapEditor() {
    return RS.ui.mapEditor._pure;
  }

  /** Deep copy of a plain JSON-shaped grid map. */
  function copiaProfunda(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  /** Builds a canonical region: spans equal to 1 are left out. */
  function crearRegion(col, row, colSpan, rowSpan) {
    var region = { col: col, row: row };
    if (colSpan > 1) region.colSpan = colSpan;
    if (rowSpan > 1) region.rowSpan = rowSpan;
    return region;
  }

  /** True if `region` covers the grid cell `celda`. */
  function regionCubre(region, celda) {
    var colSpan = region.colSpan || 1;
    var rowSpan = region.rowSpan || 1;
    return celda.col >= region.col && celda.col < region.col + colSpan &&
      celda.row >= region.row && celda.row < region.row + rowSpan;
  }

  /** True if any wall region in `muros` covers `celda`. */
  function celdaCubierta(muros, celda) {
    for (var i = 0; i < muros.length; i++) {
      if (regionCubre(muros[i], celda)) return true;
    }
    return false;
  }

  /**
   * Adds a 1x1 wall at `celda`, unless a region already covers it —
   * mapEditor.colocarMuro only dedupes exact 1x1 matches, so it would add
   * a redundant cell inside a larger wall. Mutates and returns `mapa`.
   */
  function colocarMuro(mapa, celda) {
    if (celdaCubierta(mapa.muros, celda)) return mapa;
    return puroMapEditor().colocarMuro(mapa, celda);
  }

  /**
   * Returns the pieces of `region` that remain once `celda` is removed, as
   * guillotine bands in the fixed order: top band (full width), left,
   * right, bottom band (full width). Zero-size pieces are dropped. A
   * region that does not cover `celda` comes back as a single copy.
   */
  function partirRegion(region, celda) {
    if (!regionCubre(region, celda)) return [copiaProfunda(region)];

    var colSpan = region.colSpan || 1;
    var rowSpan = region.rowSpan || 1;
    var colFin = region.col + colSpan - 1;
    var rowFin = region.row + rowSpan - 1;
    var piezas = [];

    if (celda.row > region.row) {
      piezas.push(crearRegion(region.col, region.row, colSpan, celda.row - region.row));
    }
    if (celda.col > region.col) {
      piezas.push(crearRegion(region.col, celda.row, celda.col - region.col, 1));
    }
    if (celda.col < colFin) {
      piezas.push(crearRegion(celda.col + 1, celda.row, colFin - celda.col, 1));
    }
    if (celda.row < rowFin) {
      piezas.push(crearRegion(region.col, celda.row + 1, colSpan, rowFin - celda.row));
    }
    return piezas;
  }

  /**
   * Erases exactly the cell `celda`: every wall region covering it is
   * replaced IN PLACE (same index, so untouched walls keep their order) by
   * its remaining pieces. Erasing inside the goal clears the goal (it is
   * atomic); the start is never cleared — it only moves. An empty cell is a
   * no-op. Mutates and returns `mapa`.
   */
  function borrarCeldaRegion(mapa, celda) {
    var muros = [];
    for (var i = 0; i < mapa.muros.length; i++) {
      var muro = mapa.muros[i];
      if (regionCubre(muro, celda)) {
        muros.push.apply(muros, partirRegion(muro, celda));
      } else {
        muros.push(muro);
      }
    }
    mapa.muros = muros;
    if (mapa.meta && regionCubre(mapa.meta, celda)) mapa.meta = null;
    return mapa;
  }

  function acotar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
  }

  /**
   * Sets the goal to the rectangle spanned by the cells `a` (drag origin)
   * and `b` (drag end), in any direction: coordinates are clamped to the
   * grid, then min/max-normalized. A click without movement (a === b)
   * yields a 1x1 goal. Mutates and returns `mapa`.
   */
  function establecerMetaRect(mapa, a, b) {
    var colMax = mapa.cols - 1;
    var rowMax = mapa.rows - 1;
    var colA = acotar(a.col, 0, colMax);
    var colB = acotar(b.col, 0, colMax);
    var rowA = acotar(a.row, 0, rowMax);
    var rowB = acotar(b.row, 0, rowMax);
    var col = Math.min(colA, colB);
    var row = Math.min(rowA, rowB);
    mapa.meta = crearRegion(col, row, Math.max(colA, colB) - col + 1, Math.max(rowA, rowB) - row + 1);
    return mapa;
  }

  /** Prints a region as `{ col: 7, row: 5, colSpan: 2, rowSpan: 4 }` (spans of 1 omitted). */
  function regionATexto(region) {
    var partes = ['col: ' + region.col, 'row: ' + region.row];
    if (region.colSpan > 1) partes.push('colSpan: ' + region.colSpan);
    if (region.rowSpan > 1) partes.push('rowSpan: ' + region.rowSpan);
    return '{ ' + partes.join(', ') + ' }';
  }

  /**
   * Serializes a grid map as the `var GRID_LECCION_<id> = {...};` literal,
   * in the exact style of src/lessons/content.js: 2-space IIFE indentation,
   * `col, row, colSpan, rowSpan` key order, spans of 1 omitted, `muros: [],`
   * when empty, `null` for a missing start/goal, no comments, `\n` line
   * endings and no trailing newline. Never throws on a valid-shaped map.
   */
  function aCodigoGrid(grid, id) {
    var cfg = RS.config || {};
    var muros = grid.muros || [];
    var lineas = [];

    lineas.push('  var GRID_LECCION_' + id + ' = {');
    lineas.push('    version: ' + (grid.version || 1) + ', cols: ' + (grid.cols || cfg.GRID_COLS) +
      ', rows: ' + (grid.rows || cfg.GRID_ROWS) + ',');

    if (muros.length === 0) {
      lineas.push('    muros: [],');
    } else {
      lineas.push('    muros: [');
      for (var i = 0; i < muros.length; i++) {
        lineas.push('      ' + regionATexto(muros[i]) + (i < muros.length - 1 ? ',' : ''));
      }
      lineas.push('    ],');
    }

    if (grid.inicio) {
      lineas.push('    inicio: { col: ' + grid.inicio.col + ', row: ' + grid.inicio.row +
        ', angulo: ' + (grid.inicio.angulo || 0) + ' },');
    } else {
      lineas.push('    inicio: null,');
    }

    lineas.push('    meta: ' + (grid.meta ? regionATexto(grid.meta) : 'null'));
    lineas.push('  };');
    return lineas.join('\n');
  }

  // ---- DOM controller ---------------------------------------------------

  function crearControlador() {
    var els = null;
    var activo = false;
    var leccionId = null;
    var trabajo = null;      // deep copy of leccion.grid; leccion.grid is never mutated
    var herramienta = 'muro'; // 'muro' | 'borrar' | 'inicio' | 'meta'
    var arrastrando = false;
    var ancla = null;         // cell where a goal drag started
    var ultimaCelda = null;   // last cell painted, to skip repeats while dragging

    function lecciones() {
      var lista = (RS.lessons && RS.lessons.CONTENIDO) || [];
      var conGrid = [];
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].grid) conGrid.push(lista[i]);
      }
      return conGrid;
    }

    function estado(texto) {
      els.estado.textContent = texto || '';
    }

    /** Pushes the working grid to the world, the robot and the code textarea. */
    function refrescar() {
      RS.world.cargarMapa(RS.gridAdapter.aPixeles(trabajo));
      RS.robot.reset();
      els.salida.value = aCodigoGrid(trabajo, leccionId);
    }

    function dentro(celda) {
      return celda.col >= 0 && celda.col < trabajo.cols && celda.row >= 0 && celda.row < trabajo.rows;
    }

    function aplicar(celda) {
      var editor = puroMapEditor();
      if (herramienta === 'muro') colocarMuro(trabajo, celda);
      else if (herramienta === 'borrar') borrarCeldaRegion(trabajo, celda);
      else if (herramienta === 'inicio') editor.establecerInicio(trabajo, celda);
      else if (herramienta === 'meta') establecerMetaRect(trabajo, ancla, celda);
      refrescar();
    }

    function celdaDe(evt) {
      return RS.ui.mapEditor.celdaDesdeEvento(els.canvas, evt);
    }

    function alPresionar(evt) {
      if (!activo || !trabajo || evt.button > 0) return;
      var celda = celdaDe(evt);
      if (!dentro(celda)) return;
      if (els.canvas.setPointerCapture) els.canvas.setPointerCapture(evt.pointerId);
      arrastrando = true;
      ancla = celda;
      ultimaCelda = celda;
      aplicar(celda);
    }

    function alMover(evt) {
      if (!activo || !arrastrando || !trabajo) return;
      var celda = celdaDe(evt);
      if (ultimaCelda && celda.col === ultimaCelda.col && celda.row === ultimaCelda.row) return;
      // The goal rectangle clamps to the grid; every other tool ignores outside cells.
      if (herramienta !== 'meta' && !dentro(celda)) return;
      ultimaCelda = celda;
      aplicar(celda);
    }

    function alSoltar() {
      arrastrando = false;
      ancla = null;
      ultimaCelda = null;
    }

    function cargarLeccion(id) {
      var lista = lecciones();
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === id) {
          // Switching lessons silently discards unsaved edits (spec R2 S2.3).
          trabajo = copiaProfunda(lista[i].grid);
          leccionId = id;
          els.select.value = String(id);
          estado('');
          refrescar();
          return true;
        }
      }
      return false;
    }

    function llenarSelector() {
      var lista = lecciones();
      els.select.innerHTML = '';
      for (var i = 0; i < lista.length; i++) {
        var opcion = global.document.createElement('option');
        opcion.value = String(lista[i].id);
        opcion.textContent = 'Lección ' + lista[i].id + (lista[i].titulo ? ' — ' + lista[i].titulo : '');
        els.select.appendChild(opcion);
      }
      return lista;
    }

    /** Selects and highlights the tool `nombre`. */
    function elegirHerramienta(nombre) {
      herramienta = nombre;
      var botones = els.herramientas.querySelectorAll('button[data-herramienta]');
      for (var i = 0; i < botones.length; i++) {
        var esta = botones[i].getAttribute('data-herramienta') === nombre;
        botones[i].classList.toggle('herramienta-activa', esta);
      }
    }

    /** Copy fallback: select the textarea so the user can press Ctrl+C. */
    function seleccionarTexto() {
      var copiado = false;
      els.salida.focus();
      els.salida.select();
      try { copiado = !!global.document.execCommand('copy'); } catch (e) { copiado = false; }
      estado(copiado ? 'Copiado' : 'Seleccionado: usá Ctrl+C');
    }

    /** Copies the export text; the clipboard API can be blocked on file://. */
    function copiar() {
      var clip = global.navigator && global.navigator.clipboard;
      if (!clip || !clip.writeText) { seleccionarTexto(); return; }
      try {
        clip.writeText(els.salida.value).then(function () { estado('Copiado'); }, seleccionarTexto);
      } catch (e) {
        seleccionarTexto();
      }
    }

    return {
      /** Wires the DOM once, at startup. `e`: {canvas, panel, select, herramientas, salida, btnCopiar, estado, btnSalir}. */
      init: function (e) {
        els = e;
        els.canvas.addEventListener('pointerdown', alPresionar);
        els.canvas.addEventListener('pointermove', alMover);
        els.canvas.addEventListener('pointerup', alSoltar);
        els.canvas.addEventListener('pointercancel', alSoltar);
        els.select.addEventListener('change', function () { cargarLeccion(Number(els.select.value)); });
        els.herramientas.addEventListener('click', function (evt) {
          var nombre = evt.target.getAttribute && evt.target.getAttribute('data-herramienta');
          if (nombre) elegirHerramienta(nombre);
        });
        els.btnCopiar.addEventListener('click', copiar);
        els.btnSalir.addEventListener('click', function () { global.location.hash = ''; });
      },

      /** Shows the panel and loads lesson 1 (or the first lesson with a grid). */
      abrir: function () {
        var lista = llenarSelector();
        activo = true;
        els.panel.hidden = false;
        els.canvas.style.touchAction = 'none';
        elegirHerramienta('muro');
        if (lista.length && !cargarLeccion(1)) cargarLeccion(lista[0].id);
      },

      /** Hides the panel; handlers become no-ops and the working copy is dropped. */
      cerrar: function () {
        activo = false;
        arrastrando = false;
        trabajo = null;
        els.panel.hidden = true;
        els.canvas.style.touchAction = '';
      },

      cargarLeccion: cargarLeccion,
      estaActivo: function () { return activo; }
    };
  }

  var controlador = crearControlador();

  RS.ui.lessonMapEditor = {
    init: controlador.init,
    abrir: controlador.abrir,
    cerrar: controlador.cerrar,
    cargarLeccion: controlador.cargarLeccion,
    estaActivo: controlador.estaActivo,
    // Pure functions, exported for the headless Node test — no DOM/canvas
    // involved (see tests/test-lesson-map-editor.node.js).
    _pure: {
      copiaProfunda: copiaProfunda,
      celdaCubierta: celdaCubierta,
      colocarMuro: colocarMuro,
      borrarCeldaRegion: borrarCeldaRegion,
      partirRegion: partirRegion,
      establecerMetaRect: establecerMetaRect,
      aCodigoGrid: aCodigoGrid
    }
  };
})(typeof window !== 'undefined' ? window : this);
