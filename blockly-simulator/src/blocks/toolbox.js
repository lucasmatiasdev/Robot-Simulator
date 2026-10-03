/**
 * RS.toolbox — toolbox definition with the categories: Inicio, Movimiento,
 * Temporales, Variables, Decisión, Repetición, Sensores.
 *
 * RS.toolbox.paraLeccion(leccionId) returns a filtered categoryToolbox built
 * from RS.toolbox.DESBLOQUEOS_POR_LECCION: a declarative table keyed by
 * lesson id that lists only the block types each lesson introduces. A
 * lesson's toolbox is the cumulative union of every id <= the current one;
 * categories left empty are dropped. An id outside the table (the sandbox)
 * gets the full, unfiltered toolbox. rs_repetir_hasta is never offered to a
 * lesson (its definition and runtime stay for old programs and the sandbox).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};

  function shadowMs(value) {
    return {
      shadow: {
        type: 'rs_numero',
        fields: { NUM: value }
      }
    };
  }

  var INICIO_CONTENTS = [
    { kind: 'block', type: 'rs_inicio' }
  ];

  var MOVIMIENTO_CONTENTS = [
    { kind: 'block', type: 'rs_avanzar' },
    { kind: 'block', type: 'rs_retroceder' },
    { kind: 'block', type: 'rs_izquierda' },
    { kind: 'block', type: 'rs_derecha' },
    { kind: 'block', type: 'rs_detener' }
  ];

  var TEMPORALES_CONTENTS = [
    { kind: 'block', type: 'rs_espera', inputs: { MS: shadowMs(1000) } }
  ];

  var DECISION_CONTENTS = [
    {
      kind: 'block',
      type: 'rs_si_obstaculo',
      inputs: { COND: { shadow: { type: 'rs_hay_obstaculo' } } }
    },
    {
      kind: 'block',
      type: 'rs_si_sino',
      inputs: { COND: { shadow: { type: 'rs_hay_obstaculo' } } }
    }
  ];

  var SENSOR_CONTENTS = [
    { kind: 'block', type: 'rs_hay_obstaculo' },
    { kind: 'block', type: 'rs_no_hay_obstaculo' },
    { kind: 'block', type: 'rs_medir_distancia' },
    {
      kind: 'block',
      type: 'rs_comparar',
      inputs: {
        IZQ: { shadow: { type: 'rs_medir_distancia' } },
        DER: { shadow: { type: 'rs_numero', fields: { NUM: 20 } } }
      }
    }
  ];

  var REPETICION_CONTENTS = [
    { kind: 'block', type: 'rs_repetir' },
    {
      kind: 'block',
      type: 'rs_mientras',
      inputs: { COND: { shadow: { type: 'rs_booleano', fields: { BOOL: 'TRUE' } } } }
    },
    { kind: 'block', type: 'rs_por_siempre' },
    { kind: 'block', type: 'rs_salir' }
  ];

  // Preset blocks: the turn-time variable `giro` (int, 500 ms = 90 degrees)
  // and a flag (bool), the two variables the lessons teach.
  var VARIABLES_CONTENTS = [
    {
      kind: 'block',
      type: 'rs_declarar_variable',
      fields: { TIPO: 'int', NOMBRE: 'giro' },
      inputs: { VALOR: { shadow: { type: 'rs_numero', fields: { NUM: 500 } } } }
    },
    {
      kind: 'block',
      type: 'rs_declarar_variable',
      fields: { TIPO: 'bool', NOMBRE: 'bandera' },
      inputs: { VALOR: { shadow: { type: 'rs_booleano', fields: { BOOL: 'TRUE' } } } }
    },
    {
      kind: 'block',
      type: 'rs_asignar_variable',
      fields: { NOMBRE: 'bandera' },
      inputs: { VALOR: { shadow: { type: 'rs_booleano', fields: { BOOL: 'FALSE' } } } }
    },
    {
      kind: 'block',
      type: 'rs_cambiar_variable',
      fields: { NOMBRE: 'giro', DELTA: 1 }
    },
    { kind: 'block', type: 'rs_obtener_variable', fields: { NOMBRE: 'giro' } },
    { kind: 'block', type: 'rs_booleano' }
  ];

  function construirCategoria(nombre, colour, contenidos) {
    return { kind: 'category', name: nombre, colour: colour, contents: contenidos };
  }

  /** Keeps only the content entries whose block type is in tiposPermitidos. */
  function filtrarContenidos(contenidos, tiposPermitidos) {
    return contenidos.filter(function (item) {
      return tiposPermitidos.indexOf(item.type) !== -1;
    });
  }

  RS.toolbox = {
    kind: 'categoryToolbox',
    contents: [
      construirCategoria('Inicio', '0', INICIO_CONTENTS),
      construirCategoria('Movimiento', '210', MOVIMIENTO_CONTENTS),
      construirCategoria('Temporales', '160', TEMPORALES_CONTENTS),
      construirCategoria('Variables', '330', VARIABLES_CONTENTS),
      construirCategoria('Decisión', '290', DECISION_CONTENTS),
      construirCategoria('Repetición', '20', REPETICION_CONTENTS),
      construirCategoria('Sensores', '290', SENSOR_CONTENTS)
    ]
  };

  // New block types each lesson introduces. A lesson's toolbox is the union
  // of every entry with id <= the lesson id (see paraLeccion).
  RS.toolbox.DESBLOQUEOS_POR_LECCION = {
    1: ['rs_inicio', 'rs_avanzar', 'rs_detener', 'rs_espera'],
    2: [],
    3: ['rs_derecha', 'rs_izquierda', 'rs_retroceder'],
    4: ['rs_declarar_variable', 'rs_obtener_variable'],
    5: ['rs_repetir'],
    6: ['rs_mientras', 'rs_si_obstaculo', 'rs_si_sino', 'rs_hay_obstaculo', 'rs_salir'],
    7: ['rs_no_hay_obstaculo'],
    8: []
  };

  /** Cumulative set of unlocked types for a lesson id, or null when the id is not in the table. */
  function tiposDesbloqueados(leccionId) {
    var tabla = RS.toolbox.DESBLOQUEOS_POR_LECCION;
    if (!Object.prototype.hasOwnProperty.call(tabla, leccionId)) return null;
    var tipos = [];
    for (var id = 1; id <= leccionId; id++) {
      tipos = tipos.concat(tabla[id] || []);
    }
    return tipos;
  }

  RS.toolbox.paraLeccion = function (leccionId) {
    var tipos = tiposDesbloqueados(leccionId);
    // Unknown id (sandbox / free mode): the full toolbox.
    if (tipos === null) return RS.toolbox;

    var categorias = [];
    RS.toolbox.contents.forEach(function (cat) {
      var contenidos = filtrarContenidos(cat.contents, tipos);
      if (contenidos.length > 0) categorias.push(construirCategoria(cat.name, cat.colour, contenidos));
    });
    return { kind: 'categoryToolbox', contents: categorias };
  };
})(typeof window !== 'undefined' ? window : this);
