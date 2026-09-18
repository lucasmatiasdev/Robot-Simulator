/**
 * RS.toolbox — toolbox definition with the categories: Inicio, Movimiento,
 * Sensores/Decisión, Repetición.
 *
 * RS.toolbox.paraLeccion(leccionId) returns a filtered categoryToolbox that
 * only unlocks the block types each lesson has introduced so far (per
 * lessons/content.js's progression), built by filtering these same content
 * arrays against RS.blocks's *_TYPES groupings — no per-lesson hand-written
 * block lists. Lesson 7 and the sandbox get the full, unfiltered toolbox.
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

  function movementBlockDef(type, ms) {
    return {
      kind: 'block',
      type: type,
      inputs: { MS: shadowMs(ms) }
    };
  }

  var INICIO_CONTENTS = [
    { kind: 'block', type: 'rs_inicio' }
  ];

  var MOVIMIENTO_CONTENTS = [
    movementBlockDef('rs_avanzar', 1000),
    movementBlockDef('rs_retroceder', 1000),
    movementBlockDef('rs_izquierda', 500),
    movementBlockDef('rs_derecha', 500),
    { kind: 'block', type: 'rs_detener' },
    { kind: 'block', type: 'rs_espera', inputs: { MS: shadowMs(1000) } }
  ];

  var SENSOR_CONTENTS = [
    { kind: 'block', type: 'rs_hay_obstaculo' },
    { kind: 'block', type: 'rs_medir_distancia' },
    {
      kind: 'block',
      type: 'rs_si_obstaculo',
      inputs: { COND: { shadow: { type: 'rs_hay_obstaculo' } } }
    },
    {
      kind: 'block',
      type: 'rs_si_sino',
      inputs: { COND: { shadow: { type: 'rs_hay_obstaculo' } } }
    },
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
      type: 'rs_repetir_hasta',
      inputs: { COND: { shadow: { type: 'rs_hay_obstaculo' } } }
    }
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
      construirCategoria('Sensores/Decisión', '290', SENSOR_CONTENTS),
      construirCategoria('Repetición', '20', REPETICION_CONTENTS)
    ]
  };

  // Lesson 4 introduces si_obstaculo/comparar/sensors but NOT rs_si_sino yet
  // (that is lesson 5's new concept per content.js's `concepto`/`bloques`).
  var SENSOR_TYPES_LECCION_4 = ['rs_hay_obstaculo', 'rs_medir_distancia', 'rs_comparar', 'rs_si_obstaculo'];

  RS.toolbox.paraLeccion = function (leccionId) {
    if (leccionId >= 7) return RS.toolbox; // full, unrestricted

    var categorias = [
      construirCategoria('Inicio', '0', INICIO_CONTENTS),
      construirCategoria('Movimiento', '210', MOVIMIENTO_CONTENTS)
    ];

    if (leccionId >= 4) {
      var tiposSensor = leccionId >= 5 ? RS.blocks.SENSOR_TYPES : SENSOR_TYPES_LECCION_4;
      categorias.push(construirCategoria('Sensores/Decisión', '290', filtrarContenidos(SENSOR_CONTENTS, tiposSensor)));
    }

    if (leccionId >= 6) {
      categorias.push(construirCategoria('Repetición', '20', REPETICION_CONTENTS));
    }

    return { kind: 'categoryToolbox', contents: categorias };
  };
})(typeof window !== 'undefined' ? window : this);
