/**
 * RS.config — global constants and display configuration.
 * No ES modules: this file attaches to the global `RS` object.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};

  RS.config = {
    // --- World / canvas ---
    WORLD_WIDTH: 800,
    WORLD_HEIGHT: 600,

    // --- Grid (authoring/storage format only; see src/sim/gridAdapter.js).
    // CELL_SIZE * GRID_COLS/GRID_ROWS MUST equal WORLD_WIDTH/WORLD_HEIGHT
    // exactly (zero remainder), per design D1-D3. ---
    CELL_SIZE: 40, // px per grid cell (10cm at ESCALA=4)
    GRID_COLS: 20, // 20 * 40 = 800 = WORLD_WIDTH
    GRID_ROWS: 15, // 15 * 40 = 600 = WORLD_HEIGHT

    // --- Sensors ---
    ESCALA: 4, // px per simulated cm
    RANGO_MAX: 100, // max simulated distance (cm)
    UMBRAL_OBSTACULO: 20, // hayObstaculo() = medirDistancia() <= 20 (cm)
    UMBRAL_CELDAS: 2, // UMBRAL_OBSTACULO (20cm) / CELL_SIZE-as-cm (10cm) = 2 cells

    // Minimum corridor width, in cells, that keeps the 40px robot AABB's
    // lateral slack (+-40px) safe against free-angle drift under normal
    // traversal (design D3). A narrower corridor is reserved for deliberate
    // Nivel 3 precision segments.
    MIN_CORREDOR_CELDAS: 3,

    // --- Kinematics ---
    GIRO: 0.18, // degrees per ms (izquierda/derecha), value NOT divided by 4
    VEL: 0.12, // px per ms (avanzar/retroceder)

    // Mandatory safety bound for rs_repetir_hasta (pre-test "while not" loop).
    // The interpreter's tree walker is an explicit-stack loop that can spin
    // synchronously forever if the loop body yields no leaf action and the
    // condition never becomes true (e.g. an empty body) -- see
    // src/runtime/interpreter.js's `repetir_hasta` handling. This cap makes
    // that walk provably terminating. Mirrors rs_repetir's existing
    // FieldNumber(4,1,1000) ceiling.
    MAX_ITER_REPETIR_HASTA: 1000,

    // Max simulated ms advanced per collision-checked sub-step within a single
    // requestAnimationFrame callback. A real rAF frame's dt can spike well
    // beyond a normal ~16ms frame (backgrounded tab, GC pause, slow device),
    // and at VEL px/ms a single uncapped step can jump clean over a thin
    // obstacle without ever landing on an overlapping position (tunneling).
    // Capping the distance advanced per checked step to a few px keeps AABB
    // collision detection correct regardless of real-world frame timing,
    // without switching to a swept/continuous collision test.
    MAX_SUBSTEP_MS: 16,

    // --- Robot geometry ---
    ROBOT_SIZE: 40, // px (10cm at ESCALA=4)

    // --- Action vocabulary: strict subset of example/control_PaperOne/mqtt_handler.h ---
    // bailar() intentionally excluded — no block, no action, no reference.
    ACCIONES: ['avanzar', 'retroceder', 'izquierda', 'derecha', 'detener'],

    // --- Arduino sketch generator: real C++ function names (must be valid
    // identifiers — they now name emitted `void` definitions, not just call
    // sites, so cpp-view.js reads this same map for both). ---
    nombreCpp: {
      avanzar: 'avanzar',
      retroceder: 'retroceder',
      izquierda: 'girarIzquierda',
      derecha: 'girarDerecha',
      detener: 'detener'
    },

    // Deprecated/unused by cpp-view.js since rev 3: the sketch generator now
    // always emits a real `for` loop for `repetir` nodes (compilability is
    // mandatory — `repetir(4){}` is not valid C++). Kept only so older
    // callers referencing this key do not throw; no behavior reads it.
    estiloRepetir: 'for',

    // --- Arduino UNO pin map (generic L298N H-bridge + HC-SR04), per design
    // rev 4. ENA/ENB are the two PWM speed pins; IN1-IN4 are direction pins.
    // TRIG/ECHO drive the HC-SR04 ultrasonic distance sensor (pins 2/3,
    // previously reserved for exactly this). Pins 0/1 (Serial) untouched. ---
    arduino: {
      ENA: 5,   // PWM — velocidad motor 1 (izquierdo)
      IN1: 7,   // Direccion motor 1 (izquierdo), terminal A
      IN2: 8,   // Direccion motor 1 (izquierdo), terminal B
      ENB: 6,   // PWM — velocidad motor 2 (derecho)
      IN3: 4,   // Direccion motor 2 (derecho), terminal A
      IN4: 12,  // Direccion motor 2 (derecho), terminal B
      TRIG: 2,  // HC-SR04 — pulso de disparo (salida)
      ECHO: 3,  // HC-SR04 — pulso de retorno (entrada)
      VELOCIDAD: 200 // 0-255, mirrors firmware pwm_potencia default
    },

    // --- Canvas robot palette (shared with styles/main.css tokens by value,
    // since canvas fillStyle cannot read CSS custom properties directly). ---
    paleta: {
      chasis: '#3477eb',
      chasisError: '#c0392b',
      rueda: '#141c24',
      ruedaHub: '#2b3948',
      nariz: '#0f1720'
    }
  };
})(typeof window !== 'undefined' ? window : this);
