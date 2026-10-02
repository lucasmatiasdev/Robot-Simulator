/**
 * RS.runtime.interpreter — explicit-stack tree walker over the program tree.
 * Descends into `repetir`/`si`/`si_sino`/`repetir_hasta`/`por_siempre` bodies
 * at runtime (never pre-expanded); conditions and repetitions are evaluated
 * live, one leaf at a time. Loops are uncapped: every completed body pass of
 * repetir / repetir_hasta / por_siempre yields a `tick` leaf (implicit
 * LOOP_TICK_MS of sim time) before the loop condition is re-evaluated, and
 * `salir` unwinds to the nearest enclosing loop.
 *
 * Variables: `declarar`/`asignar`/`cambiar` nodes resolve inline (non-leaf,
 * like `si`) against ONE flat `entorno` per crear() call. Every declared name
 * is pre-seeded with its zero value (int 0 / bool false), mirroring the
 * zero-initialised globals the C++ view emits; re-executing a `declarar`
 * (e.g. inside a loop body) resets the variable to its initial value.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.runtime = RS.runtime || {};

  /**
   * crear(tree, world, robotEstado, onSensorEval)
   * onSensorEval(nombre, resultado) is called synchronously every time a
   * sensor condition is evaluated (used by the UI to briefly flash the ray).
   * Returns a walker with:
   *   siguienteNodo() -> next leaf {tipo:'accion', accion, [valor], blockId}
   *                       or {tipo:'tick', valor, blockId}, or null when the
   *                       program is finished
   *   terminado() -> boolean
   */
  /** Collects {nombre: 'int'|'bool'} from every declarar node (first declaration wins). */
  function recolectarDeclaraciones(cuerpo, tipos) {
    tipos = tipos || {};
    for (var i = 0; i < (cuerpo || []).length; i++) {
      var node = cuerpo[i];
      if (node.tipo === 'declarar' && !Object.prototype.hasOwnProperty.call(tipos, node.nombre)) {
        tipos[node.nombre] = node.tipoDato === 'bool' ? 'bool' : 'int';
      }
      if (node.cuerpo) recolectarDeclaraciones(node.cuerpo, tipos);
      if (node.sino) recolectarDeclaraciones(node.sino, tipos);
    }
    return tipos;
  }

  function crear(tree, world, robotEstado, onSensorEval) {
    var stack = [{ tipo: 'root', cuerpo: tree || [], index: 0 }];
    var cambiosVariable = 0;
    // Leaves queued by the TEMP-PR3 shim (see expandirLegacy below).
    var cola = [];

    var tipos = recolectarDeclaraciones(tree);
    var entorno = {};
    for (var nombreVar in tipos) {
      if (Object.prototype.hasOwnProperty.call(tipos, nombreVar)) {
        entorno[nombreVar] = tipos[nombreVar] === 'int' ? 0 : false;
      }
    }

    /** Stores `v` into variable `n`, coerced to its declared type. */
    function guardar(n, v) {
      entorno[n] = tipos[n] === 'bool' ? Boolean(v) : (Math.trunc(Number(v)) || 0);
    }

    function evaluarSensor(nombre) {
      var resultado;
      if (nombre === 'hayObstaculo') {
        resultado = RS.sensors.hayObstaculo(world, robotEstado);
      } else {
        throw new Error('Sensor desconocido: ' + nombre);
      }
      if (typeof onSensorEval === 'function') onSensorEval(nombre, resultado);
      return resultado;
    }

    /**
     * Evaluates any value expression into its raw value: numbers stay
     * numbers, booleans stay booleans (hayObstaculo, booleano, comparar),
     * variables read the flat environment. A missing expr is 0.
     */
    function evaluarValor(expr) {
      if (!expr) return 0;
      if (expr.k === 'numero' || expr.k === 'booleano') return expr.v;
      if (expr.k === 'variable') return Object.prototype.hasOwnProperty.call(entorno, expr.nombre) ? entorno[expr.nombre] : 0;
      if (expr.k === 'medirDistancia') return RS.sensors.medirDistancia(world, robotEstado);
      if (expr.k === 'hayObstaculo') return RS.sensors.hayObstaculo(world, robotEstado);
      if (expr.k === 'comparar') return evaluarCondicion(expr);
      return 0;
    }

    /** Evaluates one comparator operand ({k, [v]}) into a number. */
    function evaluarOperando(operando) {
      return Number(evaluarValor(operando)) || 0;
    }

    function esSensor(operando) {
      return !!operando && (operando.k === 'medirDistancia' || operando.k === 'hayObstaculo');
    }

    function esVariable(operando) {
      return !!operando && operando.k === 'variable';
    }

    /**
     * Evaluates a condicion node into a boolean: a bare boolean variable or
     * literal ({k:'variable'|'booleano'}), or a {op, izq, der} comparison.
     */
    function evaluarCondicion(condicion) {
      if (condicion.k === 'variable' || condicion.k === 'booleano') {
        return Boolean(evaluarValor(condicion));
      }
      var izq = evaluarOperando(condicion.izq);
      var der = evaluarOperando(condicion.der);
      var resultado;
      switch (condicion.op) {
        case '>': resultado = izq > der; break;
        case '<': resultado = izq < der; break;
        case '>=': resultado = izq >= der; break;
        case '<=': resultado = izq <= der; break;
        case '==': resultado = izq === der; break;
        default: resultado = false;
      }
      // A comparison that reads a variable but no sensor (e.g. lados >= 4) is
      // not a sensor reading: it must not count as one nor flash the ray.
      var soloVariables = (esVariable(condicion.izq) || esVariable(condicion.der)) &&
        !esSensor(condicion.izq) && !esSensor(condicion.der);
      if (!soloVariables && typeof onSensorEval === 'function') onSensorEval('comparar', resultado);
      return resultado;
    }

    var MOVIMIENTOS = { avanzar: 1, retroceder: 1, izquierda: 1, derecha: 1 };

    /**
     * TEMP-PR3: transition shim. A movement node that still carries a `valor`
     * (old "move for ms" shape) expands into the new model: motor leaf,
     * esperar(valor), detener leaf, all with the same blockId. Removed in PR3
     * once the lesson references are ported to Delay/detener.
     */
    function expandirLegacy(node) {
      var bruto = typeof node.valor === 'object' ? evaluarValor(node.valor) : node.valor;
      var ms = Math.max(0, Number(bruto) || 0);
      cola.push({ tipo: 'accion', accion: 'esperar', valor: ms, blockId: node.blockId });
      cola.push({ tipo: 'accion', accion: 'detener', blockId: node.blockId });
      return { tipo: 'accion', accion: node.accion, blockId: node.blockId };
    }

    function esBucle(frame) {
      return frame.tipo === 'repetir' || frame.tipo === 'repetir_hasta' || frame.tipo === 'por_siempre';
    }

    /** Pops frames up to and including the nearest loop; no-op if none. */
    function salirDelBucle() {
      for (var i = stack.length - 1; i >= 0; i--) {
        if (esBucle(stack[i])) {
          stack.length = i;
          return;
        }
      }
    }

    function siguienteNodo() {
      if (cola.length > 0) return cola.shift();
      while (stack.length > 0) {
        var top = stack[stack.length - 1];

        if (top.index < top.cuerpo.length) {
          var node = top.cuerpo[top.index];
          top.index += 1;

          if (node.tipo === 'declarar' || node.tipo === 'asignar') {
            guardar(node.nombre, evaluarValor(node.valor));
            if (node.tipo === 'asignar') cambiosVariable += 1;
            continue;
          }

          if (node.tipo === 'cambiar') {
            guardar(node.nombre, entorno[node.nombre] + node.delta);
            cambiosVariable += 1;
            continue;
          }

          if (node.tipo === 'salir') {
            salirDelBucle();
            continue;
          }

          if (node.tipo === 'accion') {
            if (MOVIMIENTOS[node.accion] && Object.prototype.hasOwnProperty.call(node, 'valor')) {
              return expandirLegacy(node);
            }
            // A variable-driven duration resolves now, clamped at 0 (a
            // negative ms would otherwise hang delay() on the Arduino).
            if (node.valor && typeof node.valor === 'object') {
              return {
                tipo: 'accion',
                accion: node.accion,
                valor: Math.max(0, Number(evaluarValor(node.valor)) || 0),
                blockId: node.blockId
              };
            }
            return node;
          }

          if (node.tipo === 'repetir') {
            stack.push({
              tipo: 'repetir',
              cuerpo: node.cuerpo,
              index: 0,
              restante: node.veces,
              blockId: node.blockId
            });
            continue;
          }

          if (node.tipo === 'si') {
            var cumple = node.condicion ? evaluarCondicion(node.condicion) : evaluarSensor(node.sensor);
            if (cumple) {
              stack.push({ tipo: 'si', cuerpo: node.cuerpo, index: 0, blockId: node.blockId });
            }
            continue;
          }

          if (node.tipo === 'repetir_hasta') {
            // Pre-test ("while not") loop: skip entirely if the condition is
            // already true at encounter (zero iterations); otherwise push a
            // loop frame. See body-exhaustion handling below.
            var cumpleInicio = node.condicion ? evaluarCondicion(node.condicion) : evaluarSensor(node.sensor);
            if (!cumpleInicio) {
              stack.push({ tipo: 'repetir_hasta', cuerpo: node.cuerpo, index: 0, node: node });
            }
            continue;
          }

          if (node.tipo === 'por_siempre') {
            // Unconditional loop: always pushes a frame. Only `salir` (or
            // the user stopping the run) ends it.
            stack.push({ tipo: 'por_siempre', cuerpo: node.cuerpo, index: 0, node: node });
            continue;
          }

          if (node.tipo === 'si_sino') {
            // Evaluated once, at encounter time (not re-evaluated per tick,
            // unlike a loop condition): pick DO or ELSE body and push a
            // regular 'si' frame — always entered, unlike plain 'si' above.
            var cumpleSiSino = node.condicion ? evaluarCondicion(node.condicion) : evaluarSensor(node.sensor);
            stack.push({
              tipo: 'si',
              cuerpo: cumpleSiSino ? node.cuerpo : node.sino,
              index: 0,
              blockId: node.blockId
            });
            continue;
          }

          // Unknown node type: skip.
          continue;
        }

        // Body of `top` exhausted. A loop pass costs one implicit tick
        // BEFORE the back-edge logic runs, so a body without Delay still
        // advances sim time and no walk can spin without yielding a leaf.
        if (esBucle(top) && !top.tickHecho) {
          top.tickHecho = true;
          return {
            tipo: 'tick',
            valor: (RS.config && RS.config.LOOP_TICK_MS) || 1,
            blockId: top.blockId || (top.node && top.node.blockId)
          };
        }
        top.tickHecho = false;

        if (top.tipo === 'repetir') {
          top.restante -= 1;
          if (top.restante > 0) {
            top.index = 0;
            continue;
          }
          stack.pop();
          continue;
        }

        if (top.tipo === 'repetir_hasta') {
          // Completed one body pass: re-evaluate the condition (pre-test,
          // "while not" semantics).
          var cumpleFin = top.node.condicion ? evaluarCondicion(top.node.condicion) : evaluarSensor(top.node.sensor);
          if (cumpleFin) {
            stack.pop();
            continue;
          }
          top.index = 0;
          continue;
        }

        if (top.tipo === 'por_siempre') {
          top.index = 0;
          continue;
        }

        stack.pop();
      }
      return null;
    }

    return {
      siguienteNodo: siguienteNodo,
      terminado: function () { return stack.length === 0; },
      // cambiosVariable() -> count of asignar/cambiar executions so far.
      cambiosVariable: function () { return cambiosVariable; }
    };
  }

  RS.runtime.interpreter = {
    crear: crear
  };
})(typeof window !== 'undefined' ? window : this);
