/**
 * RS block definitions: the 5 action blocks (avanzar, retroceder, izquierda,
 * derecha, detener; no duration, they only set the motor state) plus
 * hayObstaculo()/medirDistancia() sensor blocks,
 * the repeat-N-times block, the repeat-until block (pre-test, "while not"),
 * the "por siempre" forever loop, the "Salir" break, the "si" decision block, and
 * "si/si no" (fixed two-slot if/else, no mutator). Also: rs_inicio (hat, no
 * code), rs_espera (Delay(ms), the only block that consumes time), and rs_comparar (usable
 * inside any COND value input). Variables (COLOR_VARIABLES): rs_declarar_variable,
 * rs_asignar_variable, rs_cambiar_variable, rs_obtener_variable and the
 * rs_booleano literal — a custom (non-native-Blockly) int/bool variable model
 * carried entirely in the program tree (see program-tree.js/interpreter.js).
 *
 * bailar() MUST NOT appear here — no block, field, or dropdown entry.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  var Blockly = global.Blockly;

  var COLOR_MOVIMIENTO = 210;
  var COLOR_SENSORES = 290;
  var COLOR_REPETICION = 20;
  var COLOR_INICIO = 0;
  var COLOR_VARIABLES = 330;

  // Movement blocks only set the motor state (0 ms): they carry no duration.
  // Time passes in Delay(ms) (rs_espera) and nowhere else.
  function movementBlock(type, label, tooltip) {
    Blockly.Blocks[type] = {
      init: function () {
        this.appendDummyInput().appendField(label + '()');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_MOVIMIENTO);
        this.setTooltip(tooltip);
      }
    };
  }

  // --- Movimiento ---
  movementBlock('rs_avanzar', 'avanzar', 'avanzar(): enciende ambos motores hacia adelante y no los apaga hasta otro movimiento o detener().');
  movementBlock('rs_retroceder', 'retroceder', 'retroceder(): enciende ambos motores hacia atrás y no los apaga hasta otro movimiento o detener().');
  movementBlock('rs_izquierda', 'izquierda', 'izquierda(): gira el robot a la izquierda hasta otro movimiento o detener().');
  movementBlock('rs_derecha', 'derecha', 'derecha(): gira el robot a la derecha hasta otro movimiento o detener().');

  Blockly.Blocks['rs_detener'] = {
    init: function () {
      this.appendDummyInput().appendField('detener()');
      this.setPreviousStatement(true, null);
      // Non-terminal: it only turns both motors off and the program goes on.
      this.setNextStatement(true, null);
      this.setColour(COLOR_MOVIMIENTO);
      this.setTooltip('detener(): apaga ambos motores.');
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

  // --- Delay ---
  // Maps to the 'esperar' action (simulator/sketch-only — deliberately NOT
  // part of RS.config.ACCIONES, the firmware's mqtt_handler.h vocabulary).
  Blockly.Blocks['rs_espera'] = {
    init: function () {
      this.appendValueInput('MS')
        .setCheck('Number')
        .appendField('Delay(');
      this.appendDummyInput().appendField(') ms', 'SUFFIX');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_MOVIMIENTO);
      this.setTooltip('Delay(ms): deja pasar ms milisegundos con los motores como estén (es el único bloque que consume tiempo).');
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

  // rs_repetir_hasta — indefinite pre-test ("while not") loop, uncapped (each
  // pass costs an implicit loop tick in the interpreter). Reuses the exact COND value-input pattern
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
      this.setTooltip('Repite el cuerpo hasta que la condición sea verdadera (evaluada antes de cada repetición).');
      this.setInputsInline(true);
    }
  };

  // rs_por_siempre — forever loop. Chainable (has a next connection), so it
  // does not have to be the last block. Maps to the 'por_siempre' program-tree
  // node; it repeats until Salir runs or the user stops the run.
  Blockly.Blocks['rs_por_siempre'] = {
    init: function () {
      this.appendDummyInput().appendField('por siempre');
      this.appendStatementInput('DO').setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_REPETICION);
      this.setTooltip('Repite el cuerpo sin parar, hasta que se ejecute Salir.');
    }
  };

  // rs_salir — plain break (no condition). Previous connection only: nothing
  // can follow it. Maps to the 'salir' node, which exits the nearest loop;
  // program-tree.js blocks the run when no enclosing loop exists.
  Blockly.Blocks['rs_salir'] = {
    init: function () {
      this.appendDummyInput().appendField('Salir');
      this.setPreviousStatement(true, null);
      this.setNextStatement(false);
      this.setColour(COLOR_REPETICION);
      this.setTooltip('Salir: sale del bucle más cercano (repetir, repetir hasta o por siempre) y sigue con el bloque que viene después.');
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

  // --- Variables ---
  // Custom (non-native) int/bool variables: the NOMBRE text field is the
  // single source of truth, and the declare block itself is the lesson
  // (`int lados = 0;`). Names are checked at tree level (validarVariables in
  // program-tree.js). The fields are built inside init() only, so a headless
  // Blockly stub that never calls init() still loads this file.
  var VARIABLES_TYPES = ['rs_declarar_variable', 'rs_asignar_variable', 'rs_cambiar_variable', 'rs_obtener_variable', 'rs_booleano'];

  /**
   * Pure NOMBRE validator/normaliser: strips accents (NFD), turns spaces into
   * `_`, drops every character outside [A-Za-z0-9_], and returns null when the
   * result is not a valid C++ identifier start (`^[A-Za-z]`).
   */
  function normalizarNombreVariable(texto) {
    var limpio = String(texto == null ? '' : texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '');
    return /^[A-Za-z]/.test(limpio) ? limpio : null;
  }

  function campoNombre(valorInicial) {
    return new Blockly.FieldTextInput(valorInicial, normalizarNombreVariable);
  }

  Blockly.Blocks['rs_declarar_variable'] = {
    init: function () {
      this.appendValueInput('VALOR')
        .setCheck(['Number', 'Boolean'])
        .appendField('declarar')
        .appendField(new Blockly.FieldDropdown([['int', 'int'], ['bool', 'bool']]), 'TIPO')
        .appendField(campoNombre('contador'), 'NOMBRE')
        .appendField('=');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_VARIABLES);
      this.setTooltip('declarar: crea una variable int (número entero) o bool (verdadero/falso) con un valor inicial. Si el bloque se repite, la variable vuelve a su valor inicial.');
    }
  };

  Blockly.Blocks['rs_asignar_variable'] = {
    init: function () {
      this.appendValueInput('VALOR')
        .setCheck(['Number', 'Boolean'])
        .appendField('asignar')
        .appendField(campoNombre('contador'), 'NOMBRE')
        .appendField('=');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_VARIABLES);
      this.setTooltip('asignar: guarda un nuevo valor en una variable ya declarada.');
    }
  };

  Blockly.Blocks['rs_cambiar_variable'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('cambiar')
        .appendField(campoNombre('contador'), 'NOMBRE')
        .appendField('en')
        .appendField(new Blockly.FieldNumber(1, -1000, 1000, 1), 'DELTA');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(COLOR_VARIABLES);
      this.setTooltip('cambiar: suma (o resta, si es negativo) un número entero a una variable int.');
    }
  };

  Blockly.Blocks['rs_obtener_variable'] = {
    init: function () {
      this.appendDummyInput().appendField(campoNombre('contador'), 'NOMBRE');
      this.setOutput(true, ['Number', 'Boolean']);
      this.setColour(COLOR_VARIABLES);
      this.setTooltip('Valor actual de la variable.');
    }
  };

  Blockly.Blocks['rs_booleano'] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([['verdadero', 'TRUE'], ['falso', 'FALSE']]), 'BOOL');
      this.setOutput(true, 'Boolean');
      this.setColour(COLOR_VARIABLES);
      this.setTooltip('Valor booleano: verdadero o falso.');
    }
  };

  RS.blocks = {
    INICIO_TYPES: ['rs_inicio'],
    MOVIMIENTO_TYPES: ['rs_avanzar', 'rs_retroceder', 'rs_izquierda', 'rs_derecha', 'rs_detener', 'rs_espera'],
    SENSOR_TYPES: ['rs_hay_obstaculo', 'rs_medir_distancia', 'rs_si_obstaculo', 'rs_si_sino', 'rs_comparar'],
    REPETICION_TYPES: ['rs_repetir', 'rs_repetir_hasta', 'rs_por_siempre', 'rs_salir'],
    VARIABLES_TYPES: VARIABLES_TYPES,
    normalizarNombreVariable: normalizarNombreVariable
  };
})(typeof window !== 'undefined' ? window : this);
