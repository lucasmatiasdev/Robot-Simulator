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
 * For `repetir`/`si` nodes, only the header line carries the blockId
 * (never the closing brace), matching the pre-existing highlighting rule.
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

  /** True iff the tree contains any `si` (sensor-dependent) node, at any depth. */
  function usaSensor(cuerpo) {
    for (var i = 0; i < cuerpo.length; i++) {
      var node = cuerpo[i];
      if (node.tipo === 'si') return true;
      if (node.tipo === 'repetir' && usaSensor(node.cuerpo)) return true;
    }
    return false;
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
      addLinea(0, null, [tok('#define LED_PIN ' + arduino.LED_PIN, 'pre'), tok('  // LED integrado del Arduino UNO', 'com')], 'cabecera');
      addLinea(0, null, [tok('const int VELOCIDAD = ' + velocidad + ';', 'tipo'), tok('  // 0-255', 'com')], 'cabecera');
      blanco('cabecera');
    }

    // ---------------------------------------------------------------
    // Section: motores — real, callable motor + LED functions.
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
      var nLed = nombreCpp.led || 'led';

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

      // led(int estado)
      addLinea(0, null, [tok('// Enciende o apaga el LED integrado (1 = encendido, 0 = apagado).', 'com')], 'motores');
      addLinea(0, null, [tok('void ', 'tipo'), tok(nLed, 'fn'), tok('(', 'punct'), tok('int', 'tipo'), tok(' estado) {', 'punct')], 'motores');
      addLinea(1, null, [tok('digitalWrite(LED_PIN, estado);', 'punct')], 'motores');
      addLinea(0, null, [tok('}', 'punct')], 'motores');
      blanco('motores');
    }

    // ---------------------------------------------------------------
    // Section: sensores — ONLY emitted when the tree uses a `si` node.
    // Honest stub: hayObstaculo() always returns false on this hardware.
    // NEVER called from the guion — see renderNodo('si') below, which emits
    // only a comment, never a real if(hayObstaculo()) call.
    // ---------------------------------------------------------------
    function emitirSensores() {
      addLinea(0, null, [tok('// ATENCION: este robot (Arduino UNO) todavia no tiene sensor de distancia.', 'com')], 'sensores');
      addLinea(0, null, [tok('// Estas funciones son un stub honesto: no se llaman desde el programa de', 'com')], 'sensores');
      addLinea(0, null, [tok('// abajo. Para agregar un sensor real conecta un HC-SR04 (TRIG y ECHO', 'com')], 'sensores');
      addLinea(0, null, [tok('// pueden usar los pines 2 y 3, libres a proposito) y reemplaza el cuerpo.', 'com')], 'sensores');
      addLinea(0, null, [tok('bool ', 'tipo'), tok('hayObstaculo', 'fn'), tok('() { ', 'punct'), tok('return', 'kw'), tok(' false; }', 'punct')], 'sensores');
      addLinea(0, null, [tok('int ', 'tipo'), tok('medirDistancia', 'fn'), tok('() { ', 'punct'), tok('return', 'kw'), tok(' 100; }', 'punct'), tok('  // cm, valor fijo sin sensor', 'com')], 'sensores');
      blanco('sensores');
    }

    // ---------------------------------------------------------------
    // Section: guion (inside setup) — the student's program, walked from
    // the exact same tree the simulator interpreter walks. `repetir`
    // unrolls into a real `for` loop (compilable); `si` never becomes
    // executable code — see the Unsupported Sensor Blocks contract.
    // ---------------------------------------------------------------
    function accionTokens(node) {
      var nombre = nombreCpp[node.accion] || node.accion;

      if (node.accion === 'detener') {
        return [tok(nombre, 'call'), tok('(', 'punct'), tok(')', 'punct'), tok(';', 'punct')];
      }
      // avanzar / retroceder / izquierda / derecha / led — all take one
      // numeric argument (ms, or 0/1 for led's `int estado`).
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
        // Per the "Unsupported Sensor Blocks" contract: this hardware has no
        // real sensor. We do NOT emit `if (hayObstaculo())` and we do NOT
        // fabricate a call to it — only a comment at this exact position.
        // The body is intentionally not translated into executable code.
        addLinea(indent, node.blockId, [
          tok('// ATENCION: bloque "si hay obstaculo" sin sensor real en este hardware;', 'com')
        ], 'guion');
        addLinea(indent, null, [
          tok('// no se ejecuta (ver hayObstaculo() en la seccion de sensores arriba).', 'com')
        ], 'guion');
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
      addLinea(1, null, [tok('pinMode(LED_PIN, OUTPUT);', 'punct')], 'setup');
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
