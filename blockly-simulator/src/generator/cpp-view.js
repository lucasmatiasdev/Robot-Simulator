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
 * carries a `seccion`: 'cabecera' | 'variables' | 'motores' | 'sensores' | 'setup' | 'guion' | 'loop'.
 * Only `seccion === 'guion'` lines (the student's own program, unrolled
 * inside setup()) ever carry a blockId — addLinea() only registers
 * lineasPorBloque/bloquePorLinea when blockId is truthy, so every
 * scaffolding line (headers, motor/sensor function bodies, pin config,
 * loop()) is simply absent from both maps. The 'variables' section (one
 * zero-initialised global per declared variable) is scaffolding too, so its
 * lines carry a null blockId; the `x = init;` assignment at each declarar
 * node's tree position is part of 'guion' and does carry the blockId. This is why highlight.js,
 * code-panel.js, interpreter.js, scheduler.js and program-tree.js require
 * NO changes at all.
 *
 * For `repetir`/`si`/`si_sino`/`repetir_hasta`/`por_siempre` nodes, only the
 * header line carries the blockId (never the closing brace), matching the
 * pre-existing highlighting rule. A `detener` action emits just `detener();`
 * (with its blockId): it is non-terminal, so no `return;` is ever added. A
 * `salir` node emits `break;` (with its blockId).
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

  /** True iff a value expression (program-tree.js Expr) reads the sensor, at any depth. */
  function exprUsaSensor(expr) {
    if (!expr || typeof expr !== 'object') return false;
    if (expr.k === 'medirDistancia' || expr.k === 'hayObstaculo' || expr.k === 'noHayObstaculo') return true;
    if (expr.k === 'comparar') return exprUsaSensor(expr.izq) || exprUsaSensor(expr.der);
    return false;
  }

  /**
   * True iff the tree contains any `si`/`si_sino`/`repetir_hasta`
   * (sensor-dependent) node, or any value expression that reads the sensor
   * (e.g. `declarar d = medirDistancia()` with no `si` at all), at any depth.
   */
  function usaSensor(cuerpo) {
    for (var i = 0; i < cuerpo.length; i++) {
      var node = cuerpo[i];
      if (node.tipo === 'si' || node.tipo === 'si_sino' || node.tipo === 'repetir_hasta' || node.tipo === 'mientras') return true;
      if ((node.tipo === 'declarar' || node.tipo === 'asignar' || node.tipo === 'accion') && exprUsaSensor(node.valor)) return true;
      if ((node.tipo === 'repetir' || node.tipo === 'por_siempre') && usaSensor(node.cuerpo)) return true;
    }
    return false;
  }

  /** Collects {nombre, tipoDato} per declared variable, pre-order, first declaration wins. */
  function recolectarVariables(cuerpo, acc) {
    acc = acc || [];
    for (var i = 0; i < (cuerpo || []).length; i++) {
      var node = cuerpo[i];
      if (node.tipo === 'declarar' && !acc.some(function (v) { return v.nombre === node.nombre; })) {
        acc.push({ nombre: node.nombre, tipoDato: node.tipoDato === 'bool' ? 'bool' : 'int' });
      }
      if (node.cuerpo) recolectarVariables(node.cuerpo, acc);
      if (node.sino) recolectarVariables(node.sino, acc);
    }
    return acc;
  }

  // Names a student variable must never take: they would collide with (or be
  // shadowed by) identifiers the generated sketch already uses. Case-sensitive.
  var MACROS_Y_PINES = ['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB', 'TRIG', 'ECHO',
    'VELOCIDAD', 'RANGO_MAX', 'UMBRAL_OBSTACULO', 'HIGH', 'LOW', 'INPUT', 'OUTPUT'];
  var FUNCIONES_SKETCH = ['setup', 'loop', 'delay', 'delayMicroseconds', 'max', 'min', 'abs',
    'pinMode', 'digitalWrite', 'analogWrite', 'pulseIn', 'medirDistancia', 'hayObstaculo',
    'duracion', 'distanciaCm'];
  var PALABRAS_CPP = ['int', 'bool', 'void', 'long', 'short', 'unsigned', 'signed', 'char', 'float',
    'double', 'byte', 'boolean', 'const', 'static', 'volatile', 'auto', 'true', 'false', 'if', 'else',
    'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'goto', 'new',
    'delete', 'class', 'struct', 'enum', 'union', 'typedef', 'namespace', 'using', 'template', 'this',
    'public', 'private', 'protected', 'virtual', 'friend', 'inline', 'operator', 'sizeof', 'try',
    'catch', 'throw', 'nullptr', 'NULL', 'and', 'or', 'not', 'xor', 'register', 'extern', 'mutable',
    'explicit', 'typename', 'asm', 'main'];

  RS.cppView = RS.cppView || {};

  /** True iff `n` cannot be used as a variable name (see validarVariables in program-tree.js). */
  RS.cppView.esNombreReservado = function (n) {
    if (CONTADORES.indexOf(n) !== -1) return true;
    if (/^i\d+$/.test(n)) return true;
    var nombreCpp = (RS.config && RS.config.nombreCpp) || {};
    var nombres = ['avanzar', 'retroceder', 'girarIzquierda', 'girarDerecha', 'detener'];
    for (var clave in nombreCpp) {
      if (Object.prototype.hasOwnProperty.call(nombreCpp, clave)) nombres.push(nombreCpp[clave]);
    }
    return nombres.indexOf(n) !== -1 ||
      MACROS_Y_PINES.indexOf(n) !== -1 ||
      FUNCIONES_SKETCH.indexOf(n) !== -1 ||
      PALABRAS_CPP.indexOf(n) !== -1;
  };

  /** Renders a value expression (program-tree.js Expr) as a C++ expression. */
  function valorATexto(expr) {
    if (!expr) return '0';
    if (expr.k === 'numero') return String(expr.v);
    if (expr.k === 'booleano') return expr.v ? 'true' : 'false';
    if (expr.k === 'variable') return expr.nombre;
    if (expr.k === 'medirDistancia') return 'medirDistancia()';
    if (expr.k === 'hayObstaculo') return 'hayObstaculo()';
    if (expr.k === 'noHayObstaculo') return '!hayObstaculo()';
    if (expr.k === 'comparar') return '(' + valorATexto(expr.izq) + ' ' + expr.op + ' ' + valorATexto(expr.der) + ')';
    return '0';
  }

  /** Renders one {k, [v]} comparator operand (program-tree.js) as a C++ expression. */
  function operandoATexto(operando) {
    if (!operando) return '0';
    return valorATexto(operando);
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
      // Bare boolean variable / literal used directly as the condition.
      if (node.condicion.k === 'variable' || node.condicion.k === 'booleano') return valorATexto(node.condicion);
      return operandoATexto(node.condicion.izq) + ' ' + node.condicion.op + ' ' + operandoATexto(node.condicion.der);
    }
    if (node.sensor === 'noHayObstaculo') return '!hayObstaculo()';
    // Default shadow (no rs_comparar swapped in): bare hayObstaculo().
    return 'hayObstaculo()';
  }

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
    // Section: variables — ONLY emitted when the program declares any.
    // One global per name (globals are zero-initialised in C++, like the
    // interpreter's pre-seeded environment); the declarar node's tree
    // position emits the `x = init;` assignment inside setup().
    // ---------------------------------------------------------------
    function emitirVariables() {
      var variables = recolectarVariables(tree);
      if (variables.length === 0) return;
      addLinea(0, null, [tok('// Variables del programa (globales, arrancan en cero).', 'com')], 'variables');
      variables.forEach(function (v) {
        addLinea(0, null, [tok(v.tipoDato, 'tipo'), tok(' ' + v.nombre + ';', 'punct')], 'variables');
      });
      blanco('variables');
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
      addLinea(0, null, [tok('// detener: apaga AMBOS motores (direccion en LOW y PWM en 0).', 'com')], 'motores');
      addLinea(0, null, [tok('void ', 'tipo'), tok(nDetener, 'fn'), tok('() {', 'punct')], 'motores');
      pines('LOW', 'LOW', 'LOW', 'LOW');
      addLinea(1, null, [tok('analogWrite(ENA, 0);', 'punct')], 'motores');
      addLinea(1, null, [tok('analogWrite(ENB, 0);', 'punct')], 'motores');
      addLinea(0, null, [tok('}', 'punct')], 'motores');
      blanco('motores');

      // Motor functions only set the pins and PWM: no duration, no auto-stop.
      // The motors stay as set until another motor call or detener(); time
      // passes only in delay(ms) (the Delay block).
      function funcionMotor(nombre, comentario, in1, in2, in3, in4) {
        addLinea(0, null, [tok('// ' + comentario, 'com')], 'motores');
        addLinea(0, null, [tok('void ', 'tipo'), tok(nombre, 'fn'), tok('() {', 'punct')], 'motores');
        pines(in1, in2, in3, in4);
        addLinea(1, null, [tok('analogWrite(ENA, VELOCIDAD);', 'punct')], 'motores');
        addLinea(1, null, [tok('analogWrite(ENB, VELOCIDAD);', 'punct')], 'motores');
        addLinea(0, null, [tok('}', 'punct')], 'motores');
        blanco('motores');
      }

      funcionMotor(nAvanzar, 'avanzar: enciende AMBOS motores hacia adelante (siguen asi hasta otra orden).', 'HIGH', 'LOW', 'HIGH', 'LOW');
      funcionMotor(nRetroceder, 'retroceder: enciende AMBOS motores hacia atras (siguen asi hasta otra orden).', 'LOW', 'HIGH', 'LOW', 'HIGH');
      funcionMotor(nIzquierda, 'izquierda: motor izquierdo hacia atras y motor derecho hacia adelante (el robot gira a la izquierda).', 'LOW', 'HIGH', 'HIGH', 'LOW');
      funcionMotor(nDerecha, 'derecha: motor izquierdo hacia adelante y motor derecho hacia atras (el robot gira a la derecha).', 'HIGH', 'LOW', 'LOW', 'HIGH');
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
    // What each motor call does to the (izq, der) pair, shown as a trailing
    // comment so the student reads the motor state next to the call.
    var COMENTARIO_MOTORES = {
      avanzar: '// izq: adelante, der: adelante',
      retroceder: '// izq: atras, der: atras',
      izquierda: '// izq: atras, der: adelante',
      derecha: '// izq: adelante, der: atras',
      detener: '// izq: apagado, der: apagado'
    };

    function accionTokens(node) {
      if (node.accion === 'esperar') {
        // 'esperar' is simulator/sketch-only (not part of RS.config.ACCIONES);
        // it maps directly to Arduino's built-in delay(ms), no custom
        // function scaffold needed. A variable-driven duration is clamped,
        // matching the interpreter: delay() with a negative int would wait
        // for ~49 days.
        var valorTokens = (node.valor && typeof node.valor === 'object')
          ? [tok('max', 'call'), tok('(0, ' + valorATexto(node.valor) + ')', 'punct')]
          : [tok(String(node.valor), 'num')];
        return [tok('delay', 'call'), tok('(', 'punct')].concat(valorTokens, [tok(')', 'punct'), tok(';', 'punct')]);
      }

      // avanzar / retroceder / izquierda / derecha / detener: no arguments.
      var nombre = nombreCpp[node.accion] || node.accion;
      var tokens = [tok(nombre, 'call'), tok('(', 'punct'), tok(')', 'punct'), tok(';', 'punct')];
      if (COMENTARIO_MOTORES[node.accion]) tokens.push(tok('  ' + COMENTARIO_MOTORES[node.accion], 'com'));
      return tokens;
    }

    // detener() is non-terminal (it only turns the motors off), so no
    // `return;` is ever emitted after it.
    function renderCuerpo(cuerpo, indent, depth) {
      for (var i = 0; i < cuerpo.length; i++) {
        renderNodo(cuerpo[i], indent, depth);
      }
    }

    function renderNodo(node, indent, depth) {
      if (node.tipo === 'por_siempre') {
        // Plain infinite loop, uncapped: it runs until a `break;` (Salir).
        addLinea(indent, node.blockId, [
          tok('while', 'kw'), tok(' (', 'punct'), tok('true', 'kw'), tok(') {', 'punct')
        ], 'guion');
        renderCuerpo(node.cuerpo, indent + 1, depth + 1);
        addLinea(indent, null, [tok('}', 'punct')], 'guion');
        return;
      }
      if (node.tipo === 'mientras') {
        addLinea(indent, node.blockId, [
          tok('while', 'kw'), tok(' (' + condicionATexto(node) + ') {', 'punct')
        ], 'guion');
        renderCuerpo(node.cuerpo, indent + 1, depth + 1);
        addLinea(indent, null, [tok('}', 'punct')], 'guion');
        return;
      }
      if (node.tipo === 'accion') {
        addLinea(indent, node.blockId, accionTokens(node), 'guion');
        return;
      }
      if (node.tipo === 'salir') {
        addLinea(indent, node.blockId, [tok('break', 'kw'), tok(';', 'punct')], 'guion');
        return;
      }
      if (node.tipo === 'declarar' || node.tipo === 'asignar') {
        var valorInicial = node.valor || { k: node.tipoDato === 'bool' ? 'booleano' : 'numero', v: node.tipoDato === 'bool' ? false : 0 };
        addLinea(indent, node.blockId, [
          tok(node.nombre, 'punct'), tok(' = ', 'punct'),
          tok(valorATexto(valorInicial), valorInicial.k === 'numero' ? 'num' : (valorInicial.k === 'booleano' ? 'kw' : 'punct')),
          tok(';', 'punct')
        ], 'guion');
        return;
      }
      if (node.tipo === 'cambiar') {
        var delta = Number(node.delta) || 0;
        addLinea(indent, node.blockId, [
          tok(node.nombre, 'punct'), tok(delta < 0 ? ' -= ' : ' += ', 'punct'), tok(String(Math.abs(delta)), 'num'), tok(';', 'punct')
        ], 'guion');
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
        // Uncapped, like por_siempre: it ends when the condition turns true
        // or a `break;` (Salir) runs.
        var condHasta = condicionATexto(node);
        addLinea(indent, node.blockId, [
          tok('while', 'kw'), tok(' (!(' + condHasta + ')) {', 'punct')
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
      addLinea(1, null, [tok('// Los motores quedan como los dejo tu programa (si no los apagas con detener(), siguen girando).', 'com')], 'loop');
      addLinea(1, null, [tok('// Pulsa RESET en la placa para repetirlo.', 'com')], 'loop');
      addLinea(0, null, [tok('}', 'punct')], 'loop');
    }

    emitirCabecera();
    emitirVariables();
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
