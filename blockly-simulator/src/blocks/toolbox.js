/**
 * RS.toolbox — toolbox definition with the categories: Inicio, Movimiento,
 * Actuadores, Sensores/Decisión, Repetición.
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

  RS.toolbox = {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: 'Inicio',
        colour: '0',
        contents: [
          { kind: 'block', type: 'rs_inicio' }
        ]
      },
      {
        kind: 'category',
        name: 'Movimiento',
        colour: '210',
        contents: [
          movementBlockDef('rs_avanzar', 1000),
          movementBlockDef('rs_retroceder', 1000),
          movementBlockDef('rs_izquierda', 500),
          movementBlockDef('rs_derecha', 500),
          { kind: 'block', type: 'rs_detener' },
          { kind: 'block', type: 'rs_espera', inputs: { MS: shadowMs(1000) } }
        ]
      },
      {
        kind: 'category',
        name: 'Actuadores',
        colour: '40',
        contents: [
          { kind: 'block', type: 'rs_led' }
        ]
      },
      {
        kind: 'category',
        name: 'Sensores/Decisión',
        colour: '290',
        contents: [
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
        ]
      },
      {
        kind: 'category',
        name: 'Repetición',
        colour: '20',
        contents: [
          { kind: 'block', type: 'rs_repetir' },
          {
            kind: 'block',
            type: 'rs_repetir_hasta',
            inputs: { COND: { shadow: { type: 'rs_hay_obstaculo' } } }
          }
        ]
      }
    ]
  };
})(typeof window !== 'undefined' ? window : this);
