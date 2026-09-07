/**
 * RS.runtime.interpreter — explicit-stack tree walker over the program tree.
 * Descends into `repetir`/`si` bodies at runtime (never pre-expanded);
 * conditions and repetitions are evaluated live, one leaf at a time.
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
   *   siguienteNodo() -> next leaf {tipo:'accion', accion, valor, blockId}
   *                       or null when the program is finished
   *   terminado() -> boolean
   */
  function crear(tree, world, robotEstado, onSensorEval) {
    var stack = [{ tipo: 'root', cuerpo: tree || [], index: 0 }];

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

    /** Evaluates one comparator operand ({k, [v]}) into a number. */
    function evaluarOperando(operando) {
      if (!operando) return 0;
      if (operando.k === 'medirDistancia') return RS.sensors.medirDistancia(world, robotEstado);
      if (operando.k === 'hayObstaculo') return RS.sensors.hayObstaculo(world, robotEstado) ? 1 : 0;
      if (operando.k === 'numero') return operando.v;
      return 0;
    }

    /** Evaluates a {op, izq, der} condicion node (rs_comparar) into a boolean. */
    function evaluarCondicion(condicion) {
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
      if (typeof onSensorEval === 'function') onSensorEval('comparar', resultado);
      return resultado;
    }

    function siguienteNodo() {
      while (stack.length > 0) {
        var top = stack[stack.length - 1];

        if (top.index < top.cuerpo.length) {
          var node = top.cuerpo[top.index];
          top.index += 1;

          if (node.tipo === 'accion') {
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

          // Unknown node type: skip.
          continue;
        }

        // Body of `top` exhausted.
        if (top.tipo === 'repetir') {
          top.restante -= 1;
          if (top.restante > 0) {
            top.index = 0;
            continue;
          }
          stack.pop();
          continue;
        }

        stack.pop();
      }
      return null;
    }

    return {
      siguienteNodo: siguienteNodo,
      terminado: function () { return stack.length === 0; }
    };
  }

  RS.runtime.interpreter = {
    crear: crear
  };
})(typeof window !== 'undefined' ? window : this);
