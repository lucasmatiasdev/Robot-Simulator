/**
 * RS.cppView.render(tree) — pure function over the exact same program tree
 * produced by program-tree.js. Produces a complete, compilable Arduino UNO
 * sketch as structured line records (never a raw string first — renderTexto
 * derives from the same records).
 *
 * There is no second generator: this is the only printer, and it never
 * re-walks a different tree than the interpreter/simulator use.
 *
 * Returns { lineas, lineasPorBloque, bloquePorLinea }. Each `linea` also
 * carries a `seccion`: 'cabecera' | 'motores' | 'sensores' | 'setup' | 'guion' | 'loop'.
 * Only `seccion === 'guion'` lines (the student's own program, unrolled
 * inside setup()) ever carry a blockId — addLinea() only registers
 * lineasPorBloque/bloquePorLinea when blockId is truthy, so every
 * scaffolding line (headers, motor/sensor function bodies, pin config,
 * loop()) is simply absent from both maps. This is why highlight.js,
 * code-panel.js, interpreter.js, scheduler.js and program-tree.js require
 * NO changes at all.
 *
 * For `repetir`/`si`/`si_sino`/`repetir_hasta` nodes, only the header line
 * carries the blockId (never the closing brace), matching the pre-existing
 * highlighting rule.
 *
 * Sensor support: this hardware has a real HC-SR04 ultrasonic sensor wired
 * to TRIG/ECHO (see RS.config.arduino). `si`/`si_sino`/`repetir_hasta` nodes
 * translate into real, executable `if`/`if-else`/loop C++ — see
 * emitirSensores() and renderNodo() below.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};

  var CONTADORES = ['i', 'j', 'k', 'm', 'n'];

  function tok(texto, clase) {
    return { texto: texto, clase: clase };
  }

  function tokensToText(tokens) {
    return tokens.map(function (t) { return t.texto; }).join('');
  }

  function contadorNombre(depth) {
    return CONTADORES[depth] || ('i' + depth);
  }

  /** True iff the tree contains any `si`/`si_sino`/`repetir_hasta` (sensor-dependent) node, at any depth. */
  function usaSensor(cuerpo) {
    for (var i = 0; i < cuerpo.length; i++) {
      var node = cuerpo[i];
      if (node.tipo === 'si' || node.tipo === 'si_sino' || node.tipo === 'repetir_hasta') return true;
      if (node.tipo === 'repetir' && usaSensor(node.cuerpo)) return true;
    }
    return false;
  }

  /** Renders one {k, [v]} comparator operand (program-tree.js) as a C++ expression. */
  function operandoATexto(operando) {
    if (!operando) return '0';
    if (operando.k === 'medirDistancia') return 'medirDistancia()';
    if (operando.k === 'hayObstaculo') return 'hayObstaculo()';
    if (operando.k === 'numero') return String(operando.v);
    return '0';
  }

  /**
   * Renders a `si`/`si_sino`/`repetir_hasta` node's condition (either the
   * default `sensor:'hayObstaculo'` shape or the `condicion:{op,izq,der}`
   * rs_comparar shape — see program-tree.js) into a C++ boolean expression,
   * matching interpreter.js's evaluarCondicion()/evaluarSensor() semantics
   * exactly (same operator set, same operand evaluation).
   */
  function condicionATexto(node) {
    if (node.condicion) {
      return operandoATexto(node.condicion.izq) + ' ' + node.condicion.op + ' ' + operandoATexto(node.condicion.der);
    }
    // Default shadow (no rs_comparar swapped in): bare hayObstaculo().
    return 'hayObstaculo()';
  }

  RS.cppView = RS.cppView || {};

  RS.cppView.render = function (tree, opts) {
    var cfg = RS.config || {};
    var nombreCpp = (opts && opts.nombreCpp) || cfg.nombreCpp || {};
    var arduino = (opts && opts.arduino) || cfg.arduino || {};
    var velocidad = (typeof arduino.VELOCIDAD === 'number') ? arduino.VELOCIDAD : 200;
    tree = tree || [];

    var lineas = [];
    var lineasPorBloque = {};
    var bloquePorLinea = {};
    var contador = { n: 0 };

    function addLinea(indent, blockId, tokens, seccion) {
      contador.n += 1;
      var n = contador.n;
      var registro = {
        n: n, indent: indent, blockId: blockId || null,
        seccion: seccion, tokens: tokens, texto: tokensToText(tokens)
      };
      lineas.push(registro);
      if (blockId) {
        bloquePorLinea[n] = blockId;
        if (!lineasPorBloque[blockId]) lineasPorBloque[blockId] = [];
        lineasPorBloque[blockId].push(n);
      }
      return n;
    }

    function blanco(seccion) {
      addLinea(0, null, [], seccion);
    }

    // ---------------------------------------------------------------
    // Section: cabecera — top comment + named, commented pin constants
    // ---------------------------------------------------------------
    function emitirCabecera() {
      addLinea(0, null, [tok('// Sketch generado por el Simulador Blockly - Arduino UNO + puente H L298N', 'com')], 'cabecera');
      addLinea(0, null, [tok('// Sketch standalone: se flashea directo al Arduino UNO, sin red ni broker.', 'com')], 'cabecera');
      blanco('cabecera');
      addLinea(0, null, [tok('#define ENA ' + arduino.ENA, 'pre'), tok('   // PWM - velocidad motor 1 (izquierdo)', 'com')], 'cabecera');
      addLinea(0, null, [tok('#define IN1 ' + arduino.IN1, 'pre'), tok('   // Direccion motor 1 (izquierdo), terminal A', 'com')], 'cabecera');
      addLinea(0, null, [tok('#define IN2 ' + arduino.IN2, 'pre'), tok('   // Direccion motor 1 (izquierdo), terminal B', 'com')], 'cabecera');
      addLinea(0, null, [tok('#define ENB ' + arduino.ENB, 'pre'), tok('   // PWM - velocidad motor 2 (derecho)', 'com')], 'cabecera');
      addLinea(0, null, [tok('#define IN3 ' + arduino.IN3, 'pre'), tok('   // Direccion motor 2 (derecho), terminal A', 'com')], 'cabecera');
      addLinea(0, null, [tok('#define IN4 ' + arduino.IN4, 'pre'), tok('  // Direccion motor 2 (derecho), terminal B', 'com')], 'cabecera');
      addLinea(0, null, [tok('#define TRIG ' + arduino.TRIG, 'pre'), tok('  // HC-SR04 - pulso de disparo (salida)', 'com')], 'cabecera');
      addLinea(0, null, [tok('#define ECHO ' + arduino.ECHO, 'pre'), tok('  // HC-SR04 - pulso de retorno (entrada)', 'com')], 'cabecera');
      addLinea(0, null, [tok('const int VELOCIDAD = ' + velocidad + ';', 'tipo'), tok('  // 0-255', 'com')], 'cabecera');
      blanco('cabecera');
    }

    // ---------------------------------------------------------------
    // Section: motores — real, callable motor functions.
    // detener() is emitted first so no forward declaration is needed.
    // Direction table (H-bridge, per example/control_PaperOne/README.md):
    //   avanzar     = IN1 H, IN2 L, IN3 H, IN4 L (both motors forward)
    //   retroceder  = IN1 L, IN2 H, IN3 L, IN4 H (both motors backward)
    //   girarIzquierda = IN1 L, IN2 H, IN3 H, IN4 L (motor1 back, motor2 fwd)
    //   girarDerecha   = IN1 H, IN2 L, IN3 L, IN4 H (motor1 fwd, motor2 back)
    // ---------------------------------------------------------------
    function emitirMotores() {
      var nDetener = nombreCpp.detener || 'detener';
      var nAvanzar = nombreCpp.avanzar || 'avanzar';
      var nRetroceder = nombreCpp.retroceder || 'retroceder';
      var nIzquierda = nombreCpp.izquierda || 'girarIzquierda';
      var nDerecha = nombreCpp.derecha || 'girarDerecha';

      function pines(in1, in2, in3, in4) {
        addLinea(1, null, [tok('digitalWrite(IN1, ' + in1 + ');', 'punct')], 'motores');
        addLinea(1, null, [tok('digitalWrite(IN2, ' + in2 + ');', 'punct')], 'motores');
        addLinea(1, null, [tok('digitalWrite(IN3, ' + in3 + ');', 'punct')], 'motores');
        addLinea(1, null, [tok('digitalWrite(IN4, ' + in4 + ');', 'punct')], 'motores');
      }

      // detener()
      addLinea(0, null, [tok('// Detiene ambos motores (direccion en LOW y PWM en 0).', 'com')], 'motores');
      addLinea(0, null, [tok('void ', 'tipo'), tok(nDetener, 'fn'), tok('() {', 'punct')], 'motores');
      pines('LOW', 'LOW', 'LOW', 'LOW');
      addLinea(1, null, [tok('analogWrite(ENA, 0);', 'punct')], 'motores');
      addLinea(1, null, [tok('analogWrite(ENB, 0);', 'punct')], 'motores');
      addLinea(0, null, [tok('}', 'punct')], 'motores');
      blanco('motores');

      // avanzar(int ms)
      addLinea(0, null, [tok('// Avanza: ambos motores hacia adelante durante ms milisegundos, luego se detiene.', 'com')], 'motores');
      addLinea(0, null, [tok('void ', 'tipo'), tok(nAvanzar, 'fn'), tok('(', 'punct'), tok('int', 'tipo'), tok(' ms) {', 'punct')], 'motores');
      pines('HIGH', 'LOW', 'HIGH', 'LOW');
      addLinea(1, null, [tok('analogWrite(ENA, VELOCIDAD);', 'punct')], 'motores');
      addLinea(1, null, [tok('analogWrite(ENB, VELOCIDAD);', 'punct')], 'motores');
      addLinea(1, null, [tok('delay(ms);', 'punct')], 'motores');
      addLinea(1, null, [tok(nDetener + '();', 'call')], 'motores');
      addLinea(0, null, [tok('}', 'punct')], 'motores');
      blanco('motores');

      // retroceder(int ms)
      addLinea(0, null, [tok('// Retrocede: ambos motores hacia atras durante ms milisegundos, luego se detiene.', 'com')], 'motores');
      addLinea(0, null, [tok('void ', 'tipo'), tok(nRetroceder, 'fn'), tok('(', 'punct'), tok('int', 'tipo'), tok(' ms) {', 'punct')], 'motores');
      pines('LOW', 'HIGH', 'LOW', 'HIGH');
      addLinea(1, null, [tok('analogWrite(ENA, VELOCIDAD);', 'punct')], 'motores');
      addLinea(1, null, [tok('analogWrite(ENB, VELOCIDAD);', 'punct')], 'motores');
      addLinea(1, null, [tok('delay(ms);', 'punct')], 'motores');
      addLinea(1, null, [tok(nDetener + '();', 'call')], 'motores');
      addLinea(0, null, [tok('}', 'punct')], 'motores');
      blanco('motores');

      // girarIzquierda(int ms) — motor1 (izquierdo) atras, motor2 (derecho) adelante
      addLinea(0, null, [tok('// Gira a la izquierda: motor izquierdo atras, motor derecho adelante.', 'com')], 'motores');
      addLinea(0, null, [tok('void ', 'tipo'), tok(nIzquierda, 'fn'), tok('(', 'punct'), tok('int', 'tipo'), tok(' ms) {', 'punct')], 'motores');
      pines('LOW', 'HIGH', 'HIGH', 'LOW');
      addLinea(1, null, [tok('analogWrite(ENA, VELOCIDAD);', 'punct')], 'motores');
      addLinea(1, null, [tok('analogWrite(ENB, VELOCIDAD);', 'punct')], 'motores');
      addLinea(1, null, [tok('delay(ms);', 'punct')], 'motores');
      addLinea(1, null, [tok(nDetener + '();', 'call')], 'motores');
      addLinea(0, null, [tok('}', 'punct')], 'motores');
      blanco('motores');

      // girarDerecha(int ms) — motor1 (izquierdo) adelante, motor2 (derecho) atras
      addLinea(0, null, [tok('// Gira a la derecha: motor izquierdo adelante, motor derecho atras.', 'com')], 'motores');
      addLinea(0, null, [tok('void ', 'tipo'), tok(nDerecha, 'fn'), tok('(', 'punct'), tok('int', 'tipo'), tok(' ms) {', 'punct')], 'motores');
      pines('HIGH', 'LOW', 'LOW', 'HIGH');
      addLinea(1, null, [tok('analogWrite(ENA, VELOCIDAD);', 'punct')], 'motores');
      addLinea(1, null, [tok('analogWrite(ENB, VELOCIDAD);', 'punct')], 'motores');
      addLinea(1, null, [tok('delay(ms);', 'punct')], 'motores');
      addLinea(1, null, [tok(nDetener + '();', 'call')], 'motores');
      addLinea(0, null, [tok('}', 'punct')], 'motores');
      blanco('motores');
    }

    // ---------------------------------------------------------------
    // Section: sensores — ONLY emitted when the tree actually uses a
    // `si`/`si_sino`/`repetir_hasta` node (usaSensor(tree)), so a program
    // that never reads the sensor doesn't get dead code. Real HC-SR04
    // driver: medirDistancia() clamps a pulseIn() timeout (no echo, i.e.
    // "nothing in range") and an out-of-range reading to RANGO_MAX, mirroring
    // src/sim/sensors.js's own clamping exactly. hayObstaculo() is a thin
    // wrapper, also mirroring sensors.js.
    // ---------------------------------------------------------------
    function emitirSensores() {
      var rangoMax = (typeof cfg.RANGO_MAX === 'number') ? cfg.RANGO_MAX : 100;
      var umbral = (typeof cfg.UMBRAL_OBSTACULO === 'number') ? cfg.UMBRAL_OBSTACULO : 20;
      addLinea(0, null, [tok('#define RANGO_MAX ' + rangoMax, 'pre'), tok('  // cm, "nada en rango" (timeout o eco fuera de rango)', 'com')], 'sensores');
      addLinea(0, null, [tok('#define UMBRAL_OBSTACULO ' + umbral, 'pre'), tok('  // cm', 'com')], 'sensores');
      addLinea(0, null, [tok('// Sensor de distancia HC-SR04 (TRIG/ECHO). Formula estandar:', 'com')], 'sensores');
      addLinea(0, null, [tok('// distancia_cm = duracion_us * 0.0343 / 2 (velocidad del sonido, ida y vuelta).', 'com')], 'sensores');
      addLinea(0, null, [tok('// Timeout de pulseIn en 30000us: cubre holgadamente el ida-y-vuelta de', 'com')], 'sensores');
      addLinea(0, null, [tok('// RANGO_MAX (~5831us a 100cm) con margen para no cortar un eco limite.', 'com')], 'sensores');
      addLinea(0, null, [tok('int ', 'tipo'), tok('medirDistancia', 'fn'), tok('() {', 'punct')], 'sensores');
      addLinea(1, null, [tok('digitalWrite(TRIG, LOW);', 'punct')], 'sensores');
      addLinea(1, null, [tok('delayMicroseconds(2);', 'punct')], 'sensores');
      addLinea(1, null, [tok('digitalWrite(TRIG, HIGH);', 'punct')], 'sensores');
      addLinea(1, null, [tok('delayMicroseconds(10);', 'punct')], 'sensores');
      addLinea(1, null, [tok('digitalWrite(TRIG, LOW);', 'punct')], 'sensores');
      addLinea(1, null, [tok('unsigned long duracion = pulseIn(ECHO, HIGH, 30000UL);', 'tipo')], 'sensores');
      addLinea(1, null, [tok('if (duracion == 0) ', 'kw'), tok('return', 'kw'), tok(' RANGO_MAX;', 'punct'), tok('  // timeout: el eco nunca volvio', 'com')], 'sensores');
      addLinea(1, null, [tok('long distanciaCm = (long)(duracion * 0.0343 / 2);', 'tipo')], 'sensores');
      addLinea(1, null, [tok('if (distanciaCm > RANGO_MAX) ', 'kw'), tok('return', 'kw'), tok(' RANGO_MAX;', 'punct')], 'sensores');
      addLinea(1, null, [tok('return', 'kw'), tok(' (int)distanciaCm;', 'punct')], 'sensores');
      addLinea(0, null, [tok('}', 'punct')], 'sensores');
      blanco('sensores');
      addLinea(0, null, [tok('bool ', 'tipo'), tok('hayObstaculo', 'fn'), tok('() { ', 'punct'), tok('return', 'kw'), tok(' medirDistancia() <= UMBRAL_OBSTACULO; }', 'punct')], 'sensores');
      blanco('sensores');
    }

    // ---------------------------------------------------------------
    // Section: guion (inside setup) — the student's program, walked from
    // the exact same tree the simulator interpreter walks. `repetir`
    // unrolls into a real `for` loop (compilable). `si`/`si_sino`/
    // `repetir_hasta` unroll into real `if`/`if-else`/loop C++ using the
    // real hayObstaculo()/medirDistancia() from emitirSensores() above —
    // see condicionATexto() and renderNodo() below.
    // ---------------------------------------------------------------
    function accionTokens(node) {
      if (node.accion === 'esperar') {
        // 'esperar' is simulator/sketch-only (not part of RS.config.ACCIONES);
        // it maps directly to Arduino's built-in delay(ms), no custom
        // function scaffold needed.
        return [
          tok('delay', 'call'), tok('(', 'punct'), tok(String(node.valor), 'num'),
          tok(')', 'punct'), tok(';', 'punct')
        ];
      }

      var nombre = nombreCpp[node.accion] || node.accion;

      if (node.accion === 'detener') {
        return [tok(nombre, 'call'), tok('(', 'punct'), tok(')', 'punct'), tok(';', 'punct')];
      }
      // avanzar / retroceder / izquierda / derecha — all take one numeric
      // argument (ms).
      return [
        tok(nombre, 'call'), tok('(', 'punct'), tok(String(node.valor), 'num'),
        tok(')', 'punct'), tok(';', 'punct')
      ];
    }

    function renderCuerpo(cuerpo, indent, depth) {
      for (var i = 0; i < cuerpo.length; i++) {
        renderNodo(cuerpo[i], indent, depth);
      }
    }

    function renderNodo(node, indent, depth) {
      if (node.tipo === 'accion') {
        addLinea(indent, node.blockId, accionTokens(node), 'guion');
        return;
      }
      if (node.tipo === 'repetir') {
        var v = contadorNombre(depth);
        addLinea(indent, node.blockId, [
          tok('for', 'kw'), tok(' (', 'punct'), tok('int', 'tipo'), tok(' ' + v + ' = ', 'punct'),
          tok('0', 'num'), tok('; ' + v + ' < ', 'punct'), tok(String(node.veces), 'num'),
          tok('; ' + v + '++) {', 'punct')
        ], 'guion');
        renderCuerpo(node.cuerpo, indent + 1, depth + 1);
        addLinea(indent, null, [tok('}', 'punct')], 'guion');
        return;
      }
      if (node.tipo === 'si') {
        var condSi = condicionATexto(node);
        addLinea(indent, node.blockId, [
          tok('if', 'kw'), tok(' (' + condSi + ') {', 'punct')
        ], 'guion');
        renderCuerpo(node.cuerpo, indent + 1, depth + 1);
        addLinea(indent, null, [tok('}', 'punct')], 'guion');
        return;
      }
      if (node.tipo === 'si_sino') {
        var condSiSino = condicionATexto(node);
        addLinea(indent, node.blockId, [
          tok('if', 'kw'), tok(' (' + condSiSino + ') {', 'punct')
        ], 'guion');
        renderCuerpo(node.cuerpo, indent + 1, depth + 1);
        addLinea(indent, null, [tok('} ', 'punct'), tok('else', 'kw'), tok(' {', 'punct')], 'guion');
        renderCuerpo(node.sino, indent + 1, depth + 1);
        addLinea(indent, null, [tok('}', 'punct')], 'guion');
        return;
      }
      if (node.tipo === 'repetir_hasta') {
        // Pre-test ("while not") loop, per interpreter.js: the body runs
        // while the condition is still false, re-checked before each pass.
        // Mirrors the interpreter's own MAX_ITER_REPETIR_HASTA safety cap
        // (an uncapped `while (!(cond)) {...}` could spin real hardware
        // forever if the sensor condition never becomes true) with a
        // counter-guarded `for`, same contadorNombre(depth) scheme `repetir`
        // uses above so nested loops at different depths don't collide.
        var condHasta = condicionATexto(node);
        var vHasta = contadorNombre(depth);
        var maxIter = (cfg.MAX_ITER_REPETIR_HASTA) || 1000;
        addLinea(indent, node.blockId, [
          tok('for', 'kw'), tok(' (', 'punct'), tok('int', 'tipo'), tok(' ' + vHasta + ' = ', 'punct'),
          tok('0', 'num'), tok('; ' + vHasta + ' < ', 'punct'), tok(String(maxIter), 'num'),
          tok(' && !(' + condHasta + '); ' + vHasta + '++) {', 'punct')
        ], 'guion');
        addLinea(indent + 1, null, [
          tok('// tope de seguridad ' + maxIter + ' iteraciones, igual al del simulador (MAX_ITER_REPETIR_HASTA)', 'com')
        ], 'guion');
        renderCuerpo(node.cuerpo, indent + 1, depth + 1);
        addLinea(indent, null, [tok('}', 'punct')], 'guion');
        return;
      }
    }

    // ---------------------------------------------------------------
    // Section: setup — pin config (before any motor call), then the
    // student's program runs exactly once, then setup — Sequential Script
    // Execution Semantics: loop() never repeats it.
    // ---------------------------------------------------------------
    function emitirSetup() {
      var nDetener = nombreCpp.detener || 'detener';
      addLinea(0, null, [tok('void ', 'tipo'), tok('setup', 'fn'), tok('() {', 'punct')], 'setup');
      addLinea(1, null, [tok('pinMode(ENA, OUTPUT);', 'punct')], 'setup');
      addLinea(1, null, [tok('pinMode(IN1, OUTPUT);', 'punct')], 'setup');
      addLinea(1, null, [tok('pinMode(IN2, OUTPUT);', 'punct')], 'setup');
      addLinea(1, null, [tok('pinMode(ENB, OUTPUT);', 'punct')], 'setup');
      addLinea(1, null, [tok('pinMode(IN3, OUTPUT);', 'punct')], 'setup');
      addLinea(1, null, [tok('pinMode(IN4, OUTPUT);', 'punct')], 'setup');
      addLinea(1, null, [tok('pinMode(TRIG, OUTPUT);', 'punct')], 'setup');
      addLinea(1, null, [tok('pinMode(ECHO, INPUT);', 'punct')], 'setup');
      addLinea(1, null, [tok(nDetener + '();', 'call')], 'setup');
      blanco('setup');
      addLinea(1, null, [tok('// ---- Tu programa ----', 'com')], 'setup');
      renderCuerpo(tree, 1, 0);
      blanco('setup');
      addLinea(1, null, [tok(nDetener + '();', 'call')], 'setup');
      addLinea(0, null, [tok('}', 'punct')], 'setup');
      blanco('setup');
    }

    // ---------------------------------------------------------------
    // Section: loop — intentionally empty. The script already ran once,
    // inside setup(). Repeating it here would diverge from the simulator,
    // which runs the same tree once and stops.
    // ---------------------------------------------------------------
    function emitirLoop() {
      addLinea(0, null, [tok('void ', 'tipo'), tok('loop', 'fn'), tok('() {', 'punct')], 'loop');
      addLinea(1, null, [tok('// Vacio a proposito: tu programa ya se ejecuto una vez en setup().', 'com')], 'loop');
      addLinea(1, null, [tok('// Los motores quedan detenidos. Pulsa RESET en la placa para repetirlo.', 'com')], 'loop');
      addLinea(0, null, [tok('}', 'punct')], 'loop');
    }

    emitirCabecera();
    emitirMotores();
    if (usaSensor(tree)) emitirSensores();
    emitirSetup();
    emitirLoop();

    return { lineas: lineas, lineasPorBloque: lineasPorBloque, bloquePorLinea: bloquePorLinea };
  };

  /**
   * renderTexto(tree) — String form, derived from the SAME line records as
   * render() (never a second/independent printer), so a copied .ino is
   * always byte-identical to what the code panel displays.
   */
  RS.cppView.renderTexto = function (tree, opts) {
    var resultado = RS.cppView.render(tree, opts);
    return resultado.lineas.map(function (l) {
      return '  '.repeat(l.indent) + l.texto;
    }).join('\n');
  };
})(typeof window !== 'undefined' ? window : this);
