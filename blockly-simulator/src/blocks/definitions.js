/**
 * RS block definitions: the 6 action blocks (avanzar, retroceder, izquierda,
 * derecha, detener, led) plus hayObstaculo()/medirDistancia() sensor blocks,
 * the repeat-N-times block, the repeat-until block (pre-test, "while not",
 * with a mandatory safety-iteration cap), the "si" decision block, and
 * "si/si no" (fixed two-slot if/else, no mutator). Also: rs_inicio (hat, no
 * code), rs_espera (simulator/sketch-only wait), and rs_comparar (usable
 * inside any COND value input).
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
  var COLOR_INICIO = 0;

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

  // COND is a value input (Boolean) with rs_hay_obstaculo as its default
  // shadow (set in toolbox.js). The unmodified default case — an untouched
  // shadow — reproduces today's fixed "si hayObstaculo()" condition exactly,
  // preserving byte-identical rendering/generator output for that case.
  // Replacing the shadow with an rs_comparar block instead lets the
  // condition compare any two operands (see program-tree.js/interpreter.js).
  Blockly.Blocks['rs_si_obstaculo'] = {
    init: function () {
      this.appendValueInput('COND').setCheck('Boolean').appendField('si');
      this.appendStatementInput('DO').setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_SENSORES);
      this.setTooltip('Ejecuta el cuerpo solo si la condición es verdadera (evaluada en tiempo de ejecución).');
      this.setInputsInline(true);
    }
  };

  // rs_si_sino — fixed two-slot if/else, NO mutator, NO else-if chaining.
  // Reuses the exact COND value-input pattern from rs_si_obstaculo (same
  // rs_hay_obstaculo default shadow, same rs_comparar swap-in rule). This is
  // a DISTINCT block type from rs_si_obstaculo — it maps to a NEW program-tree
  // node type ('si_sino', see program-tree.js) so rs_si_obstaculo's existing
  // 'si' node/interpreter/cpp-view paths stay completely untouched.
  Blockly.Blocks['rs_si_sino'] = {
    init: function () {
      this.appendValueInput('COND').setCheck('Boolean').appendField('si');
      this.appendStatementInput('DO').setCheck(null);
      this.appendDummyInput().appendField('si no');
      this.appendStatementInput('ELSE').setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_SENSORES);
      this.setTooltip('Ejecuta el primer cuerpo si la condición es verdadera, o el segundo ("si no") si es falsa (evaluada una sola vez, en tiempo de ejecución).');
      this.setInputsInline(true);
    }
  };

  // --- Comparador (usable inside COND slots, e.g. rs_si_obstaculo) ---
  Blockly.Blocks['rs_comparar'] = {
    init: function () {
      this.appendValueInput('IZQ').setCheck('Number');
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([
        ['>', '>'],
        ['<', '<'],
        ['>=', '>='],
        ['<=', '<='],
        ['==', '==']
      ]), 'OP');
      this.appendValueInput('DER').setCheck('Number');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setColour(COLOR_SENSORES);
      this.setTooltip('Compara dos valores numéricos (por ejemplo medirDistancia()) y produce verdadero/falso.');
    }
  };

  // --- Inicio/evento ---
  // Hat block: setPreviousStatement(false) means nothing can connect above
  // it, so it can only ever be a chain root. It emits no program-tree node
  // (blockToNode has no entry for 'rs_inicio' and falls through to `null`);
  // walkChain still follows getNextBlock(), so a program anchored to this
  // block executes identically to the same program left unanchored.
  Blockly.Blocks['rs_inicio'] = {
    init: function () {
      this.appendDummyInput().appendField('Inicio/evento');
      this.setPreviousStatement(false);
      this.setNextStatement(true, null);
      this.setColour(COLOR_INICIO);
      this.setTooltip('Inicio/evento: marca el punto de partida del programa. No genera código propio.');
    }
  };

  // --- Espera ---
  // Maps to the 'esperar' action (simulator/sketch-only — deliberately NOT
  // part of RS.config.ACCIONES, the firmware's mqtt_handler.h vocabulary).
  Blockly.Blocks['rs_espera'] = {
    init: function () {
      this.appendValueInput('MS')
        .setCheck('Number')
        .appendField('esperar(');
      this.appendDummyInput().appendField(') ms', 'SUFFIX');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_MOVIMIENTO);
      this.setTooltip('esperar(ms): pausa la ejecución durante ms milisegundos sin mover el robot.');
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

  // rs_repetir_hasta — indefinite pre-test ("while not") loop with a
  // mandatory safety cap (RS.config.MAX_ITER_REPETIR_HASTA, enforced in
  // src/runtime/interpreter.js). Reuses the exact COND value-input pattern
  // from rs_si_obstaculo/rs_si_sino (same rs_hay_obstaculo default shadow,
  // same rs_comparar swap-in rule). Maps to a NEW program-tree node type
  // ('repetir_hasta', see program-tree.js) — kept distinct from rs_repetir,
  // whose fixed-count loop path stays completely untouched.
  Blockly.Blocks['rs_repetir_hasta'] = {
    init: function () {
      this.appendValueInput('COND').setCheck('Boolean').appendField('repetir hasta');
      this.appendStatementInput('DO').setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_REPETICION);
      this.setTooltip('Repite el cuerpo hasta que la condición sea verdadera (evaluada antes de cada repetición). Tiene un límite de seguridad de iteraciones.');
      this.setInputsInline(true);
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
    INICIO_TYPES: ['rs_inicio'],
    MOVIMIENTO_TYPES: ['rs_avanzar', 'rs_retroceder', 'rs_izquierda', 'rs_derecha', 'rs_detener', 'rs_espera'],
    ACTUADOR_TYPES: ['rs_led'],
    SENSOR_TYPES: ['rs_hay_obstaculo', 'rs_medir_distancia', 'rs_si_obstaculo', 'rs_si_sino', 'rs_comparar'],
    REPETICION_TYPES: ['rs_repetir', 'rs_repetir_hasta']
  };
})(typeof window !== 'undefined' ? window : this);
