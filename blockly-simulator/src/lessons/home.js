/**
 * RS.lessons.home — renders the Home screen as a full-page reading view of
 * the student's CURRENT lesson (the first one in RS.lessons.CONTENIDO not
 * yet marked complete by RS.lessons.progress), with an "Iniciar Desafío"
 * button at the end. Progression is linear: there is no lesson picker here
 * — main.js's progress module is what decides which lesson this is. Lesson/
 * sandbox selection itself lives in main.js (it owns the Blockly workspace
 * and the view switch); this module only builds the screen and reports clicks.
 */
(function (global) {
  'use strict';

  var RS = global.RS = global.RS || {};
  RS.lessons = RS.lessons || {};

  function leccionActual() {
    var lista = RS.lessons.CONTENIDO || [];
    var progreso = RS.lessons.progress;
    for (var i = 0; i < lista.length; i++) {
      if (!progreso || !progreso.estaCompletada(lista[i].id)) return lista[i];
    }
    return null; // todas las lecciones completadas
  }

  function crearBoton(texto, clase, alHacerClick) {
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = clase;
    boton.textContent = texto;
    boton.addEventListener('click', alHacerClick);
    return boton;
  }

  function renderizarLeccion(contenedor, leccion, callbacks) {
    var articulo = document.createElement('article');
    articulo.className = 'home-leccion';

    var h2 = document.createElement('h2');
    h2.className = 'leccion-titulo';
    h2.textContent = 'Lección ' + leccion.id + ' — ' + leccion.titulo;
    articulo.appendChild(h2);

    RS.lessons.SECCIONES.forEach(function (seccion) {
      var bloque = document.createElement('section');
      bloque.className = 'leccion-seccion';

      var h3 = document.createElement('h3');
      h3.textContent = seccion.titulo;
      bloque.appendChild(h3);

      var p = document.createElement('p');
      p.textContent = leccion[seccion.clave];
      bloque.appendChild(p);

      articulo.appendChild(bloque);
    });

    contenedor.appendChild(articulo);

    contenedor.appendChild(crearBoton('Iniciar Desafío', 'home-iniciar-btn', function () {
      callbacks.onIniciarLeccion(leccion.id);
    }));

    contenedor.appendChild(crearBoton('Entrar al sandbox', 'home-sandbox-btn', callbacks.onIniciarSandbox));
  }

  function renderizarModuloCompleto(contenedor, callbacks) {
    var articulo = document.createElement('article');
    articulo.className = 'home-leccion';

    var h2 = document.createElement('h2');
    h2.className = 'leccion-titulo';
    h2.textContent = '¡Completaste todas las lecciones!';
    articulo.appendChild(h2);

    var p = document.createElement('p');
    p.className = 'home-tarjeta-resumen';
    p.textContent = 'Terminaste el módulo de aprendizaje. Podés seguir practicando libremente en el sandbox.';
    articulo.appendChild(p);

    contenedor.appendChild(articulo);
    contenedor.appendChild(crearBoton('Entrar al sandbox', 'home-iniciar-btn', callbacks.onIniciarSandbox));
  }

  RS.lessons.home = {
    init: function (contenedor, callbacks) {
      if (!contenedor) return;
      contenedor.innerHTML = '';

      var leccion = leccionActual();
      if (leccion) {
        renderizarLeccion(contenedor, leccion, callbacks);
      } else {
        renderizarModuloCompleto(contenedor, callbacks);
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);
