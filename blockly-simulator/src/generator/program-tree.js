/**
 * RS.generator.buildProgramTree — the sole workspace traversal.
 * Produces a nested program tree (never flattened/pre-expanded):
 *   { tipo:'accion',  accion, valor, blockId }
 *   { tipo:'repetir', veces, cuerpo:[...], blockId }
 *   { tipo:'si',      sensor:'hayObstaculo', cuerpo:[...], blockId }
 *
 * RS.protocol.toMqttPayload(node) strips a leaf action node down to the
 * exact firmware payload shape { accion, valor } (no blockId, no metadata).
 * This is a pure data-transform utility — it implies no MQTT client, no
 * network connection, no topic.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};

  var ACCION_POR_TIPO = {
    rs_avanzar: 'avanzar',
    rs_retroceder: 'retroceder',
    rs_izquierda: 'izquierda',
    rs_derecha: 'derecha',
    rs_detener: 'detener',
    rs_led: 'led'
  };

  function readMs(block) {
    var target = block.getInputTargetBlock('MS');
    if (!target) return 0;
    var val = target.getFieldValue('NUM');
    return Number(val) || 0;
  }

  function readEstado(block) {
    var val = block.getFieldValue('ESTADO');
    return Number(val);
  }

  function walkChain(startBlock) {
    var nodos = [];
    var block = startBlock;
    while (block) {
      var nodo = blockToNode(block);
      if (nodo) nodos.push(nodo);
      block = block.getNextBlock ? block.getNextBlock() : null;
    }
    return nodos;
  }

  function blockToNode(block) {
    var type = block.type;

    if (ACCION_POR_TIPO[type]) {
      var accion = ACCION_POR_TIPO[type];
      var nodo = { tipo: 'accion', accion: accion, blockId: block.id };
      if (type === 'rs_led') {
        nodo.valor = readEstado(block);
      } else if (type !== 'rs_detener') {
        nodo.valor = readMs(block);
      }
      return nodo;
    }

    if (type === 'rs_repetir') {
      var veces = Number(block.getFieldValue('VECES')) || 0;
      var cuerpoBlock = block.getInputTargetBlock('DO');
      return {
        tipo: 'repetir',
        veces: veces,
        cuerpo: walkChain(cuerpoBlock),
        blockId: block.id
      };
    }

    if (type === 'rs_si_obstaculo') {
      var siCuerpoBlock = block.getInputTargetBlock('DO');
      return {
        tipo: 'si',
        sensor: 'hayObstaculo',
        cuerpo: walkChain(siCuerpoBlock),
        blockId: block.id
      };
    }

    // rs_hay_obstaculo / rs_medir_distancia are value (reporter) blocks —
    // they do not participate in the statement chain and produce no node
    // when encountered as a top-level/statement block.
    return null;
  }

  /**
   * Builds the full program tree from a Blockly workspace.
   * Returns the top-level sequence (array of nodes), matching the shape
   * of a `cuerpo` array so it can be walked the same way.
   */
  RS.generator = RS.generator || {};
  RS.generator.buildProgramTree = function (workspace) {
    var topBlocks = workspace.getTopBlocks(true);
    var arbol = [];
    for (var i = 0; i < topBlocks.length; i++) {
      var block = topBlocks[i];
      // Only statement-chain roots (blocks with previousStatement null, i.e.
      // not connected as a value input to something else) start a sequence.
      if (block.outputConnection) continue; // skip stray reporter blocks
      arbol = arbol.concat(walkChain(block));
    }
    return arbol;
  };

  RS.protocol = RS.protocol || {};
  /**
   * Pure function: strips a leaf accion node down to the exact firmware
   * payload shape. No MQTT client, no network, no topic — data only.
   */
  RS.protocol.toMqttPayload = function (node) {
    if (!node || node.tipo !== 'accion') {
      throw new Error('toMqttPayload solo acepta nodos {tipo:"accion"}');
    }
    var payload = { accion: node.accion };
    if (Object.prototype.hasOwnProperty.call(node, 'valor')) {
      payload.valor = node.valor;
    }
    return payload;
  };
})(typeof window !== 'undefined' ? window : this);
