/**
 * RS.lessons.progress — tracks which lessons the student has completed and
 * derives lesson unlock state from RS.lessons.CONTENIDO order: a lesson
 * unlocks only once the previous one in the array is completed, and the
 * first lesson always starts unlocked. Completion persists in localStorage
 * so a page reload doesn't wipe progress — only the Blockly workspace itself
 * stays session-only (see main.js).
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.lessons = RS.lessons || {};

  var CLAVE_STORAGE = 'rs-lecciones-completadas';

  function leerCompletadas() {
    try {
      var crudo = global.localStorage ? global.localStorage.getItem(CLAVE_STORAGE) : null;
      var lista = crudo ? JSON.parse(crudo) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];
    }
  }

  function guardarCompletadas(lista) {
    try {
      if (global.localStorage) global.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(lista));
    } catch (e) {
      // localStorage no disponible (modo privado, cuota, etc.): el progreso
      // sigue funcionando en memoria, solo que no sobrevive a un reload.
    }
  }

  var completadas = leerCompletadas();

  function estaCompletada(id) {
    return completadas.indexOf(id) !== -1;
  }

  function marcarCompletada(id) {
    if (estaCompletada(id)) return;
    completadas.push(id);
    guardarCompletadas(completadas);
  }

  function estaDesbloqueada(id) {
    var lista = RS.lessons.CONTENIDO || [];
    var indice = -1;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) { indice = i; break; }
    }
    if (indice <= 0) return true; // primera lección o id desconocido: nunca bloqueada
    return estaCompletada(lista[indice - 1].id);
  }

  RS.lessons.progress = {
    estaCompletada: estaCompletada,
    estaDesbloqueada: estaDesbloqueada,
    marcarCompletada: marcarCompletada
  };
})(typeof window !== 'undefined' ? window : this);
