/**
 * RS block definitions: the 6 action blocks (avanzar, retroceder, izquierda,
 * derecha, detener, led) plus hayObstaculo()/medirDistancia() sensor blocks,
 * the repeat-N-times block, and the if-hayObstaculo decision block.
 *
 * bailar() MUST NOT appear here — no block, field, or dropdown entry.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  var Blockly = global.Blockly;

  var COLOR_MOVIMIENTO = 210;
  var COLOR_ACTUADORES = 40;
  var COLOR_SENSORES = 290;
  var COLOR_REPETICION = 20;

  function movementBlock(type, label) {
    Blockly.Blocks[type] = {
      init: function () {
        this.appendValueInput('MS')
          .setCheck('Number')
          .appendField(label + '(');
        this.appendDummyInput().appendField(') ms', 'SUFFIX');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_MOVIMIENTO);
        this.setTooltip(label + '(ms): mueve el robot durante ms milisegundos.');
      }
    };
  }

  // --- Movimiento ---
  movementBlock('rs_avanzar', 'avanzar');
  movementBlock('rs_retroceder', 'retroceder');
  movementBlock('rs_izquierda', 'izquierda');
  movementBlock('rs_derecha', 'derecha');

  Blockly.Blocks['rs_detener'] = {
    init: function () {
      this.appendDummyInput().appendField('detener()');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_MOVIMIENTO);
      this.setTooltip('detener(): detiene el robot inmediatamente.');
    }
  };

  // --- Actuadores ---
  Blockly.Blocks['rs_led'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('led(')
        .appendField(new Blockly.FieldDropdown([
          ['encendido (1)', '1'],
          ['apagado (0)', '0']
        ]), 'ESTADO')
        .appendField(')');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_ACTUADORES);
      this.setTooltip('led(1/0): enciende o apaga el LED.');
    }
  };

  // --- Sensores/Decisión ---
  Blockly.Blocks['rs_hay_obstaculo'] = {
    init: function () {
      this.appendDummyInput().appendField('hayObstaculo()');
      this.setOutput(true, 'Boolean');
      this.setColour(COLOR_SENSORES);
      this.setTooltip('hayObstaculo(): true si hay un obstáculo cerca al frente.');
    }
  };

  Blockly.Blocks['rs_medir_distancia'] = {
    init: function () {
      this.appendDummyInput().appendField('medirDistancia()');
      this.setOutput(true, 'Number');
      this.setColour(COLOR_SENSORES);
      this.setTooltip('medirDistancia(): distancia simulada al obstáculo más cercano al frente, en cm.');
    }
  };

  Blockly.Blocks['rs_si_obstaculo'] = {
    init: function () {
      this.appendDummyInput().appendField('si hayObstaculo()');
      this.appendStatementInput('DO').setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_SENSORES);
      this.setTooltip('Ejecuta el cuerpo solo si hayObstaculo() es verdadero (evaluado en tiempo de ejecución).');
      this.setInputsInline(false);
    }
  };

  // --- Repetición ---
  Blockly.Blocks['rs_repetir'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('repetir')
        .appendField(new Blockly.FieldNumber(4, 1, 1000, 1), 'VECES')
        .appendField('veces');
      this.appendStatementInput('DO').setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_REPETICION);
      this.setTooltip('Repite el cuerpo VECES veces, evaluado por el intérprete en tiempo de ejecución.');
      this.setInputsInline(false);
    }
  };

  // Numeric literal used as the MS input's default shadow block.
  Blockly.Blocks['rs_numero'] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(1000, 0), 'NUM');
      this.setOutput(true, 'Number');
      this.setColour(COLOR_MOVIMIENTO);
      this.setTooltip('Valor numérico en milisegundos.');
    }
  };

  RS.blocks = {
    MOVIMIENTO_TYPES: ['rs_avanzar', 'rs_retroceder', 'rs_izquierda', 'rs_derecha', 'rs_detener'],
    ACTUADOR_TYPES: ['rs_led'],
    SENSOR_TYPES: ['rs_hay_obstaculo', 'rs_medir_distancia', 'rs_si_obstaculo'],
    REPETICION_TYPES: ['rs_repetir']
  };
})(typeof window !== 'undefined' ? window : this);
