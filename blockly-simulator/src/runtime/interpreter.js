/**
 * RS.runtime.interpreter — explicit-stack tree walker over the program tree.
 * Descends into `repetir`/`si`/`si_sino`/`repetir_hasta` bodies at runtime
 * (never pre-expanded); conditions and repetitions are evaluated live, one
 * leaf at a time. `repetir_hasta` (pre-test "while not" loop) is capped by
 * RS.config.MAX_ITER_REPETIR_HASTA — see the body-exhaustion handling below.
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
    var limiteSeguridadTrip = null;

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

          if (node.tipo === 'repetir_hasta') {
            // Pre-test ("while not") loop: skip entirely if the condition is
            // already true at encounter (zero iterations); otherwise push a
            // loop frame. See body-exhaustion handling below for the
            // mandatory MAX_ITER_REPETIR_HASTA safety cap.
            var cumpleInicio = node.condicion ? evaluarCondicion(node.condicion) : evaluarSensor(node.sensor);
            if (!cumpleInicio) {
              stack.push({ tipo: 'repetir_hasta', cuerpo: node.cuerpo, index: 0, iter: 0, node: node });
            }
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

        if (top.tipo === 'repetir_hasta') {
          // Completed one body pass: re-evaluate the condition (pre-test,
          // "while not" semantics). SAFETY CAP FIRST: an empty body or a
          // body whose actions never make the condition true would
          // otherwise re-enter this branch forever, spinning synchronously
          // inside THIS `while` loop (siguienteNodo() would never return —
          // confirmed empirically: see apply-progress notes for Slice C1).
          // The cap must live here, not in the scheduler, because the
          // scheduler never regains control in that failure case.
          top.iter += 1;
          var maxIter = (RS.config && RS.config.MAX_ITER_REPETIR_HASTA) || 1000;
          if (top.iter >= maxIter) {
            limiteSeguridadTrip = { blockId: top.node.blockId, iteraciones: top.iter };
            stack.pop();
            continue; // D4: the safety trip is a behavioral signal, not an
                      // abort — the rest of the program keeps executing.
          }
          var cumpleFin = top.node.condicion ? evaluarCondicion(top.node.condicion) : evaluarSensor(top.node.sensor);
          if (cumpleFin) {
            stack.pop();
            continue;
          }
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
      // limiteSeguridad() -> null, or {blockId, iteraciones} once a
      // repetir_hasta loop has tripped MAX_ITER_REPETIR_HASTA during this
      // walk. Read by the scheduler after each siguienteNodo() call.
      limiteSeguridad: function () { return limiteSeguridadTrip; }
    };
  }

  RS.runtime.interpreter = {
    crear: crear
  };
})(typeof window !== 'undefined' ? window : this);
