/**
 * RS.generator.buildProgramTree — the sole workspace traversal.
 * Produces a nested program tree (never flattened/pre-expanded):
 *   { tipo:'accion',  accion, blockId }            (motor leaf: NO valor key)
 *   { tipo:'accion',  accion:'esperar', valor, blockId }  (Delay(ms))
 *   { tipo:'salir',   blockId }
 *   { tipo:'repetir', veces, cuerpo:[...], blockId }
 *   { tipo:'si',      sensor:'hayObstaculo', cuerpo:[...], blockId }
 *   { tipo:'si_sino', sensor|condicion, cuerpo:[...], sino:[...], blockId }
 *   { tipo:'repetir_hasta', sensor|condicion, cuerpo:[...], blockId }
 *   { tipo:'mientras', sensor|condicion, cuerpo:[...], blockId }
 *   { tipo:'por_siempre', cuerpo:[...], blockId }
 *   { tipo:'declarar', nombre, tipoDato:'int'|'bool', valor:Expr, blockId }
 *   { tipo:'asignar',  nombre, valor:Expr|null, blockId }
 *   { tipo:'cambiar',  nombre, delta:int, blockId }
 *
 * Expr := {k:'numero',v} | {k:'booleano',v} | {k:'variable',nombre}
 *       | {k:'medirDistancia'} | {k:'hayObstaculo'} | {k:'noHayObstaculo'} | {k:'comparar',op,izq,der}
 * Only esperar carries a `valor`; it stays a number unless its MS input holds a variable
 * getter, in which case it is {k:'variable',nombre} (resolved at run time).
 * A COND is `sensor:'hayObstaculo'` (default shadow) or `sensor:'noHayObstaculo'`, `condicion:{op,izq,der}`
 * (rs_comparar), or `condicion:{k:'variable'|'booleano',...}`.
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
    // 'esperar' is simulator/sketch-only: it is NOT part of RS.config.ACCIONES
    // (the firmware's mqtt_handler.h vocabulary subset).
    rs_espera: 'esperar'
  };

  /** Reads a comparator operand block into the {k, [v]} node shape. */
  function leerOperando(block) {
    if (!block) return null;
    if (block.type === 'rs_medir_distancia') return { k: 'medirDistancia' };
    if (block.type === 'rs_hay_obstaculo') return { k: 'hayObstaculo' };
    if (block.type === 'rs_no_hay_obstaculo') return { k: 'noHayObstaculo' };
    if (block.type === 'rs_numero') return { k: 'numero', v: Number(block.getFieldValue('NUM')) || 0 };
    return null;
  }

  /**
   * Generalises leerOperando to every value block: adds the variable getter,
   * the boolean literal and a nested comparison. Existing operand outputs are
   * unchanged (delegated to leerOperando).
   */
  function leerValor(block) {
    if (!block) return null;
    if (block.type === 'rs_obtener_variable') return { k: 'variable', nombre: String(block.getFieldValue('NOMBRE')) };
    if (block.type === 'rs_booleano') return { k: 'booleano', v: block.getFieldValue('BOOL') === 'TRUE' };
    if (block.type === 'rs_comparar') {
      return {
        k: 'comparar',
        op: block.getFieldValue('OP'),
        izq: leerValor(block.getInputTargetBlock('IZQ')),
        der: leerValor(block.getInputTargetBlock('DER'))
      };
    }
    return leerOperando(block);
  }

  function leerComparador(block) {
    return {
      op: block.getFieldValue('OP'),
      izq: leerValor(block.getInputTargetBlock('IZQ')),
      der: leerValor(block.getInputTargetBlock('DER'))
    };
  }

  /**
   * Reads a COND value input into `nodo`: rs_comparar -> condicion:{op,izq,der};
   * variable getter / boolean literal -> condicion:{k,...}; anything else
   * (the default rs_hay_obstaculo shadow, or no target) -> the legacy
   * sensor:'hayObstaculo' shape, keeping default output byte-identical.
   */
  function leerCond(block, nodo) {
    var target = block.getInputTargetBlock('COND');
    if (target && target.type === 'rs_comparar') {
      nodo.condicion = leerComparador(target);
    } else if (target && (target.type === 'rs_obtener_variable' || target.type === 'rs_booleano')) {
      nodo.condicion = leerValor(target);
    } else if (target && target.type === 'rs_no_hay_obstaculo') {
      nodo.sensor = 'noHayObstaculo';
    } else {
      nodo.sensor = 'hayObstaculo';
    }
    return nodo;
  }

  function readMs(block) {
    var target = block.getInputTargetBlock('MS');
    if (!target) return 0;
    if (target.type === 'rs_obtener_variable') return { k: 'variable', nombre: String(target.getFieldValue('NOMBRE')) };
    var val = target.getFieldValue('NUM');
    return Number(val) || 0;
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
      // Movement/detener only set the motor state: the key must be absent
      // (not undefined/null), or the legacy interpreter shim would expand it.
      if (type === 'rs_espera') {
        nodo.valor = readMs(block);
      }
      return nodo;
    }

    if (type === 'rs_salir') {
      return { tipo: 'salir', blockId: block.id };
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
      // Default shadow (rs_hay_obstaculo) or no COND target at all keeps the
      // exact pre-existing node shape, so the unmodified default case stays
      // byte-identical to today's generator output.
      return leerCond(block, { tipo: 'si', cuerpo: walkChain(siCuerpoBlock), blockId: block.id });
    }

    if (type === 'rs_repetir_hasta') {
      var hastaCuerpoBlock = block.getInputTargetBlock('DO');
      return leerCond(block, { tipo: 'repetir_hasta', cuerpo: walkChain(hastaCuerpoBlock), blockId: block.id });
    }

    if (type === 'rs_mientras') {
      return leerCond(block, { tipo: 'mientras', cuerpo: walkChain(block.getInputTargetBlock('DO')), blockId: block.id });
    }

    if (type === 'rs_por_siempre') {
      return {
        tipo: 'por_siempre',
        cuerpo: walkChain(block.getInputTargetBlock('DO')),
        blockId: block.id
      };
    }

    if (type === 'rs_si_sino') {
      var doBlock = block.getInputTargetBlock('DO');
      var elseBlock = block.getInputTargetBlock('ELSE');
      return leerCond(block, {
        tipo: 'si_sino',
        cuerpo: walkChain(doBlock),
        sino: walkChain(elseBlock),
        blockId: block.id
      });
    }

    if (type === 'rs_declarar_variable') {
      var tipoDato = block.getFieldValue('TIPO') === 'bool' ? 'bool' : 'int';
      // An empty VALOR defaults to the type's zero value.
      var inicial = leerValor(block.getInputTargetBlock('VALOR')) ||
        (tipoDato === 'bool' ? { k: 'booleano', v: false } : { k: 'numero', v: 0 });
      return {
        tipo: 'declarar',
        nombre: String(block.getFieldValue('NOMBRE')),
        tipoDato: tipoDato,
        valor: inicial,
        blockId: block.id
      };
    }

    if (type === 'rs_asignar_variable') {
      return {
        tipo: 'asignar',
        nombre: String(block.getFieldValue('NOMBRE')),
        valor: leerValor(block.getInputTargetBlock('VALOR')),
        blockId: block.id
      };
    }

    if (type === 'rs_cambiar_variable') {
      return {
        tipo: 'cambiar',
        nombre: String(block.getFieldValue('NOMBRE')),
        delta: Math.trunc(Number(block.getFieldValue('DELTA'))) || 0,
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

  var IDENTIFICADOR = /^[A-Za-z][A-Za-z0-9_]*$/;

  /**
   * Static type of a value expression: 'int' | 'bool', or null when it cannot
   * be told (unknown/undeclared variable, missing expr).
   */
  function tipoDeExpr(expr, declarados) {
    if (!expr) return null;
    if (expr.k === 'numero' || expr.k === 'medirDistancia') return 'int';
    if (expr.k === 'booleano' || expr.k === 'hayObstaculo' || expr.k === 'noHayObstaculo' || expr.k === 'comparar') return 'bool';
    if (expr.k === 'variable') return declarados[expr.nombre] || null;
    return null;
  }

  /**
   * Pre-run variable checks over the program tree, in document order
   * (pre-order): identifier validity, reserved names, duplicate declare
   * blocks, use-before-declare, and int/bool type mismatches. Returns
   * { ok:true } or { ok:false, mensaje } with the first problem found.
   */
  RS.generator.validarVariables = function (tree) {
    var declarados = {}; // nombre -> 'int' | 'bool'
    var error = null;

    function falla(mensaje) {
      if (!error) error = mensaje;
    }

    function existe(nombre) {
      if (Object.prototype.hasOwnProperty.call(declarados, nombre)) return true;
      falla('La variable "' + nombre + '" se usa antes de declararla. Agregá un bloque "declarar" para ella antes de usarla.');
      return false;
    }

    // Checks every variable reference inside `expr` is already declared.
    function revisarExpr(expr) {
      if (!expr) return;
      if (expr.k === 'variable') existe(expr.nombre);
      if (expr.k === 'comparar') {
        revisarOperando(expr.izq);
        revisarOperando(expr.der);
      }
    }

    // Comparison operands must be numbers: a bool variable or literal is not.
    function revisarOperando(operando) {
      revisarExpr(operando);
      if (operando && tipoDeExpr(operando, declarados) === 'bool' && operando.k !== 'hayObstaculo' && operando.k !== 'noHayObstaculo' && operando.k !== 'comparar') {
        falla('Un valor verdadero/falso no se puede comparar con un número' +
          (operando.k === 'variable' ? ' (la variable "' + operando.nombre + '" es bool).' : '.'));
      }
    }

    function revisarCondicion(node) {
      var c = node.condicion;
      if (!c) return;
      if (c.k === 'variable') {
        if (existe(c.nombre) && declarados[c.nombre] !== 'bool') {
          falla('La variable "' + c.nombre + '" es int: una condición necesita un valor verdadero/falso (bool) o una comparación.');
        }
      } else if (c.k !== 'booleano') {
        revisarOperando(c.izq);
        revisarOperando(c.der);
      }
    }

    function revisarDuracion(valor) {
      if (!valor || typeof valor !== 'object') return;
      if (existe(valor.nombre) && declarados[valor.nombre] !== 'int') {
        falla('La variable "' + valor.nombre + '" es bool: la duración de Delay necesita un número (int).');
      }
    }

    function recorrer(cuerpo) {
      for (var i = 0; i < (cuerpo || []).length && !error; i++) {
        var node = cuerpo[i];

        if (node.tipo === 'declarar') {
          var nombre = node.nombre;
          if (!IDENTIFICADOR.test(nombre)) {
            falla('El nombre de variable "' + nombre + '" no es válido: debe empezar con una letra y usar solo letras, números y guion bajo.');
          } else if (RS.cppView && RS.cppView.esNombreReservado && RS.cppView.esNombreReservado(nombre)) {
            falla('El nombre "' + nombre + '" está reservado (lo usa el código generado). Elegí otro nombre para la variable.');
          } else if (Object.prototype.hasOwnProperty.call(declarados, nombre)) {
            falla('La variable "' + nombre + '" se declara más de una vez. Declarala una sola vez y usá "asignar" o "cambiar" después.');
          } else {
            // The initial value is checked BEFORE the name exists, so a
            // variable cannot initialise itself.
            revisarExpr(node.valor);
            var tInicial = tipoDeExpr(node.valor, declarados);
            if (!error && tInicial && tInicial !== node.tipoDato) {
              falla('La variable "' + nombre + '" es ' + node.tipoDato + ' pero su valor inicial es ' + tInicial + '.');
            }
            declarados[nombre] = node.tipoDato === 'bool' ? 'bool' : 'int';
          }
        } else if (node.tipo === 'asignar') {
          if (existe(node.nombre)) {
            if (!node.valor) {
              falla('El bloque "asignar" de la variable "' + node.nombre + '" no tiene un valor. Conectale uno.');
            } else {
              revisarExpr(node.valor);
              var tAsignado = tipoDeExpr(node.valor, declarados);
              if (!error && tAsignado && tAsignado !== declarados[node.nombre]) {
                falla('No se puede asignar un valor ' + tAsignado + ' a la variable "' + node.nombre + '" (' + declarados[node.nombre] + ').');
              }
            }
          }
        } else if (node.tipo === 'cambiar') {
          if (existe(node.nombre) && declarados[node.nombre] !== 'int') {
            falla('"cambiar" solo funciona con variables int, y "' + node.nombre + '" es bool.');
          }
        } else if (node.tipo === 'accion' && node.accion === 'esperar') {
          revisarDuracion(node.valor);
        } else if (node.tipo === 'si' || node.tipo === 'si_sino' || node.tipo === 'repetir_hasta' || node.tipo === 'mientras') {
          revisarCondicion(node);
        }

        if (node.cuerpo) recorrer(node.cuerpo);
        if (node.sino) recorrer(node.sino);
      }
    }

    recorrer(tree);
    return error ? { ok: false, mensaje: error } : { ok: true };
  };

  var MENSAJE_SALIR_FUERA_DE_BUCLE =
    'El bloque "Salir" solo puede usarse dentro de un bucle (repetir, mientras, repetir hasta o por siempre).';

  /**
   * Blocks a Salir with no enclosing loop (top level, or inside si/si_sino
   * not nested in a loop). Returns { ok:true } or { ok:false, mensaje }.
   */
  RS.generator.validarSalir = function (tree) {
    function huerfano(cuerpo, dentroDeBucle) {
      for (var i = 0; i < (cuerpo || []).length; i++) {
        var node = cuerpo[i];
        if (node.tipo === 'salir' && !dentroDeBucle) return true;
        var bucle = dentroDeBucle ||
          node.tipo === 'repetir' || node.tipo === 'repetir_hasta' || node.tipo === 'mientras' || node.tipo === 'por_siempre';
        if (huerfano(node.cuerpo, bucle) || huerfano(node.sino, bucle)) return true;
      }
      return false;
    }
    return huerfano(tree, false)
      ? { ok: false, mensaje: MENSAJE_SALIR_FUERA_DE_BUCLE }
      : { ok: true };
  };

  /**
   * Pre-run gate for the UI "Ejecutar" flow (not the interpreter/scheduler
   * API itself — iniciarConArbol/tests keep building trees directly).
   * Requires exactly one statement-chain root and that root to be
   * rs_inicio, matching the same getTopBlocks/outputConnection filter
   * buildProgramTree uses to pick its roots.
   */
  RS.generator.validarPrograma = function (workspace) {
    var topBlocks = workspace.getTopBlocks(true);
    var raices = [];
    for (var i = 0; i < topBlocks.length; i++) {
      if (topBlocks[i].outputConnection) continue; // stray reporter block
      raices.push(topBlocks[i]);
    }

    if (raices.length === 0) {
      return { ok: false, mensaje: 'Falta el bloque "Inicio/evento". Agregalo desde la categoría Inicio para poder ejecutar.' };
    }
    if (raices.length > 1 || raices[0].type !== 'rs_inicio') {
      return { ok: false, mensaje: 'El programa debe empezar con el bloque "Inicio/evento" y todos los demás bloques deben estar conectados a él.' };
    }
    var arbol = RS.generator.buildProgramTree(workspace);
    var salir = RS.generator.validarSalir(arbol);
    if (!salir.ok) return salir;
    return RS.generator.validarVariables(arbol);
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
