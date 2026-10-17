/**
 * RS.ui.mapEditor — sandbox grid map editor (design D5).
 *
 * Lets the student click or drag on the sandbox canvas to place/clear walls
 * (region-aware, shared with RS.ui.lessonMapEditor), drag a goal rectangle,
 * move the robot's start pose, and move the goal cell, then persists the
 * result to localStorage (`rs-sandbox-mapa-v1`) so it survives a reload.
 * Lessons never touch this module — only main.js's onIniciarSandbox wires
 * it in, and it is a no-op everywhere else.
 *
 * The pure editing/persistence functions (mapaVacio, colocarMuro,
 * borrarCelda, establecerInicio, establecerMeta, guardar, cargarGuardado,
 * borrarGuardado) are exposed on `_pure` so they can be exercised headless
 * from tests/test-map-editor.node.js — no DOM/canvas involved. DOM/canvas
 * click-hit-testing (init/alPresionar) is NOT covered by an automated test:
 * this repo has no headless browser harness, and getBoundingClientRect()-
 * based scaling needs a real laid-out canvas to be meaningful. That gap is
 * documented, not silently skipped (see tasks.md 3.6).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.ui = RS.ui || {};

  var CLAVE_STORAGE = 'rs-sandbox-mapa-v1';
  var VERSION = 1;

  /** A fresh, empty sandbox map: no walls, no goal, start at a safe cell. */
  function mapaVacio() {
    var cfg = RS.config;
    return {
      version: VERSION,
      cols: cfg.GRID_COLS,
      rows: cfg.GRID_ROWS,
      muros: [],
      inicio: { col: 1, row: 7, angulo: 0 },
      meta: null
    };
  }

  function mismaCelda1x1(region, celda) {
    return !!region && region.col === celda.col && region.row === celda.row &&
      (region.colSpan || 1) === 1 && (region.rowSpan || 1) === 1;
  }

  function indiceMuro(muros, celda) {
    for (var i = 0; i < muros.length; i++) {
      if (mismaCelda1x1(muros[i], celda)) return i;
    }
    return -1;
  }

  /** Adds a 1x1 wall cell (no-op if already a wall). Mutates and returns `mapa`. */
  function colocarMuro(mapa, celda) {
    if (indiceMuro(mapa.muros, celda) === -1) {
      mapa.muros.push({ col: celda.col, row: celda.row });
    }
    return mapa;
  }

  /** Clears a wall cell and/or a single-cell goal at `celda`. Mutates and returns `mapa`. */
  function borrarCelda(mapa, celda) {
    var idx = indiceMuro(mapa.muros, celda);
    if (idx !== -1) mapa.muros.splice(idx, 1);
    if (mismaCelda1x1(mapa.meta, celda)) mapa.meta = null;
    return mapa;
  }

  /** Moves the start pose to `celda`, preserving the current facing angle. Mutates and returns `mapa`. */
  function establecerInicio(mapa, celda) {
    mapa.inicio = { col: celda.col, row: celda.row, angulo: (mapa.inicio && mapa.inicio.angulo) || 0 };
    return mapa;
  }

  /** Sets the (single-cell) goal to `celda`. Mutates and returns `mapa`. */
  function establecerMeta(mapa, celda) {
    mapa.meta = { col: celda.col, row: celda.row };
    return mapa;
  }

  /** Saves `mapa` to localStorage, guarded per the progress.js try/catch pattern. Returns true/false. */
  function guardar(mapa) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(mapa));
      return true;
    } catch (e) {
      // localStorage no disponible (modo privado, cuota, etc.): la edicion
      // sigue funcionando en memoria, solo que no sobrevive a un reload.
      return false;
    }
  }

  /**
   * Loads the saved sandbox map. Returns the parsed grid map only if it is
   * present, has the expected `version`, and passes `RS.gridAdapter.validar`
   * (cols/rows/inicio/muros/meta structurally sound) — otherwise `null`, so
   * the caller falls back to the default map (spec: sandbox-map-editor,
   * "Corrupted stored map falls back to default" / "Storage failure
   * degrades gracefully").
   */
  function cargarGuardado() {
    try {
      var crudo = global.localStorage ? global.localStorage.getItem(CLAVE_STORAGE) : null;
      if (!crudo) return null;
      var mapa = JSON.parse(crudo);
      if (!mapa || mapa.version !== VERSION) return null;
      if (!RS.gridAdapter || !RS.gridAdapter.validar(mapa)) return null;
      return mapa;
    } catch (e) {
      return null;
    }
  }

  function borrarGuardado() {
    try {
      if (global.localStorage) global.localStorage.removeItem(CLAVE_STORAGE);
    } catch (e) {
      // ver guardar(): fallo silencioso, no hay estado persistido que perder.
    }
  }

  /** Converts a click/pointer event into a grid cell using getBoundingClientRect()
   * ratios — NOT offsetX/offsetY, because the canvas backing store is
   * devicePixelRatio-scaled and the element itself is CSS-scaled by the
   * responsive layout (design D5). Shared with RS.ui.lessonMapEditor. */
  function celdaDesdeEvento(canvasEl, evt) {
    var rect = canvasEl.getBoundingClientRect();
    var cfg = RS.config;
    var escalaX = cfg.WORLD_WIDTH / rect.width;
    var escalaY = cfg.WORLD_HEIGHT / rect.height;
    var worldX = (evt.clientX - rect.left) * escalaX;
    var worldY = (evt.clientY - rect.top) * escalaY;
    return RS.gridAdapter.celdaDesdePixel(worldX, worldY);
  }

  function crearEditor() {
    var canvas = null;
    var mapaActual = null;
    var herramienta = 'muro'; // 'muro' | 'borrar' | 'inicio' | 'meta'
    var modoEdicion = false;
    var arrastrando = false;
    var ancla = null;       // cell where the current drag started (goal rectangle origin)
    var ultimaCelda = null; // last cell painted, to skip repeats while dragging

    function celdaDentroDeLimites(celda) {
      return celda.col >= 0 && celda.col < mapaActual.cols &&
        celda.row >= 0 && celda.row < mapaActual.rows;
    }

    function aplicarAlMundo() {
      RS.world.cargarMapa(RS.gridAdapter.aPixeles(mapaActual));
    }

    function corriendoAhora() {
      return !!(RS.runtime && RS.runtime.scheduler && RS.runtime.scheduler.obtenerEstado() === 'running');
    }

    /**
     * Region-aware editing lives in RS.ui.lessonMapEditor._pure; it is read
     * at call time (that script loads after this one). Without it, the 1x1
     * helpers above are used, so this module still works standalone.
     */
    function regiones() {
      return (RS.ui.lessonMapEditor && RS.ui.lessonMapEditor._pure) || null;
    }

    function aplicarCelda(celda) {
      var r = regiones();
      if (herramienta === 'muro') (r ? r.colocarMuro : colocarMuro)(mapaActual, celda);
      else if (herramienta === 'borrar') (r ? r.borrarCeldaRegion : borrarCelda)(mapaActual, celda);
      else if (herramienta === 'inicio') establecerInicio(mapaActual, celda);
      else if (herramienta === 'meta') {
        if (r) r.establecerMetaRect(mapaActual, ancla, celda);
        else establecerMeta(mapaActual, celda);
      }
      aplicarAlMundo();
      if (RS.robot) RS.robot.reset();
    }

    function alPresionar(evt) {
      // Editing is blocked while the scheduler is running (design D5) and
      // whenever the toolbar's "edit map" mode is off.
      if (!modoEdicion || !mapaActual || corriendoAhora() || evt.button > 0) return;

      var celda = celdaDesdeEvento(canvas, evt);
      if (!celdaDentroDeLimites(celda)) return;

      if (canvas.setPointerCapture && evt.pointerId !== undefined) canvas.setPointerCapture(evt.pointerId);
      arrastrando = true;
      ancla = celda;
      ultimaCelda = celda;
      aplicarCelda(celda);
    }

    function alMover(evt) {
      if (!arrastrando || !mapaActual) return;
      if (!modoEdicion || corriendoAhora()) { alSoltar(); return; }
      var celda = celdaDesdeEvento(canvas, evt);
      if (ultimaCelda && celda.col === ultimaCelda.col && celda.row === ultimaCelda.row) return;
      // The goal rectangle clamps to the grid; every other tool ignores outside cells.
      if (herramienta !== 'meta' && !celdaDentroDeLimites(celda)) return;
      // A fast drag can skip cells between two pointer events: fill the gap.
      var anterior = ultimaCelda;
      ultimaCelda = celda;
      if (anterior && (herramienta === 'muro' || herramienta === 'borrar')) {
        var pasos = Math.max(Math.abs(celda.col - anterior.col), Math.abs(celda.row - anterior.row));
        for (var i = 1; i < pasos; i++) {
          var intermedia = {
            col: Math.round(anterior.col + (celda.col - anterior.col) * i / pasos),
            row: Math.round(anterior.row + (celda.row - anterior.row) * i / pasos)
          };
          if (celdaDentroDeLimites(intermedia)) aplicarCelda(intermedia);
        }
      }
      aplicarCelda(celda);
    }

    function alSoltar() {
      if (arrastrando && mapaActual) guardar(mapaActual);
      arrastrando = false;
      ancla = null;
      ultimaCelda = null;
    }

    return {
      /** Wires pointer handling to the sim canvas. Call once, at startup. */
      init: function (canvasEl) {
        canvas = canvasEl;
        canvas.addEventListener('pointerdown', alPresionar);
        canvas.addEventListener('pointermove', alMover);
        canvas.addEventListener('pointerup', alSoltar);
        canvas.addEventListener('pointercancel', alSoltar);
      },

      /**
       * Loads the saved custom map if present/valid, else a fresh empty
       * map, applies it to RS.world, and returns the active grid map.
       * Called from main.js's onIniciarSandbox instead of the previous
       * hardcoded `RS.world.cargarMapa({})`.
       */
      iniciarSandbox: function () {
        mapaActual = cargarGuardado() || mapaVacio();
        aplicarAlMundo();
        return mapaActual;
      },

      establecerHerramienta: function (nombre) { herramienta = nombre; },
      obtenerHerramienta: function () { return herramienta; },

      /** Toggles "edit map" mode; also toggles the grid overlay via renderer.mostrarGrilla. */
      establecerModoEdicion: function (activo) {
        modoEdicion = !!activo;
        if (!modoEdicion) alSoltar();
        if (canvas) canvas.style.touchAction = modoEdicion ? 'none' : '';
        if (RS.renderer) RS.renderer.mostrarGrilla = modoEdicion;
      },
      enModoEdicion: function () { return modoEdicion; },

      celdaDesdeEvento: celdaDesdeEvento,

      obtenerMapa: function () { return mapaActual; },
      reiniciarGuardado: function () {
        borrarGuardado();
        mapaActual = mapaVacio();
        aplicarAlMundo();
        return mapaActual;
      },

      // Pure functions, exported for the headless Node test — no DOM/canvas
      // involved (see tests/test-map-editor.node.js).
      _pure: {
        mapaVacio: mapaVacio,
        colocarMuro: colocarMuro,
        borrarCelda: borrarCelda,
        establecerInicio: establecerInicio,
        establecerMeta: establecerMeta,
        guardar: guardar,
        cargarGuardado: cargarGuardado,
        borrarGuardado: borrarGuardado
      }
    };
  }

  RS.ui.mapEditor = crearEditor();
})(typeof window !== 'undefined' ? window : this);
