/* =========================================================
   paginas/activos.js — Activos de la empresa (activos.html)
   -----------------------------------------------------------
   Módulo de PRODUCTOS: el inventario de equipos que se entregan
   al personal.
   - Administrador / RRHH: crean, editan, eliminan, asignan,
     reciben devoluciones y trasladan activos entre áreas.
   - Supervisor: consulta el inventario y el historial.
   - Todos: "Mis equipos asignados".
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const cuerpoMios = document.getElementById("cuerpoMisActivos");
  if (!cuerpoMios) return;

  const sesion = exigirSesion();
  if (!sesion) return;

  const gestiona = tieneRol(sesion, ROLES_ADMINISTRAN_USUARIOS);
  const consulta = esGestor(sesion);
  const $ = function (id) { return document.getElementById(id); };

  // ---------- Mis equipos (todos los roles) ----------
  async function cargarMios() {
    filaMensaje(cuerpoMios, 4, "Cargando...");
    try {
      const mios = await activoService.obtenerMios();
      cuerpoMios.innerHTML = "";
      if (!mios.length) {
        filaMensaje(cuerpoMios, 4, "No tienes equipos asignados.");
        return;
      }
      mios.forEach(function (a) {
        const fila = document.createElement("tr");
        fila.innerHTML =
          '<td class="fw-semibold">' + escaparHtml(a.nombre_activo) + "</td>" +
          "<td><code>" + escaparHtml(a.serial) + "</code></td>" +
          "<td>" + escaparHtml(a.nombre_area || "—") + "</td>" +
          "<td>" + formatearFecha(a.fecha_asignacion) + "</td>";
        cuerpoMios.appendChild(fila);
      });
    } catch (error) {
      filaMensaje(cuerpoMios, 4, error.message, "text-danger");
    }
  }

  cargarMios();
  if (!consulta) return;

  // ---------- Inventario (gestores) ----------
  const cuerpoTabla = $("cuerpoTablaActivos");
  const COLUMNAS = 5;
  const campoBusqueda = $("buscarActivo");
  const selectArea = $("filtroAreaActivo");
  const selectEstado = $("filtroEstadoActivo");
  let activos = [];
  let areas = [];

  if (!gestiona) {
    document.querySelectorAll("[data-solo-gestion]").forEach(function (el) { el.classList.add("d-none"); });
  }

  async function cargarCatalogos() {
    try {
      areas = await catalogoService.obtenerAreas();
      [selectArea, $("activoArea"), $("trasladoArea")].forEach(function (select) {
        llenarSelect(select, areas, function (a) { return a.id_area; }, function (a) { return a.nombre_area; });
      });
      if (gestiona) {
        const empleados = await usuarioService.obtenerTodos({ estado: "activo" });
        llenarSelect($("asignarEmpleado"), empleados, function (u) { return u.id_usuario; }, function (u) {
          return u.nombre_completo + (u.nombre_area ? " — " + u.nombre_area : "");
        });
      }
    } catch (error) {
      mostrarNotificacion("No se pudieron cargar los catálogos: " + error.message, "danger");
    }
  }

  async function cargarActivos() {
    filaMensaje(cuerpoTabla, COLUMNAS, "Cargando inventario...");
    try {
      activos = await activoService.obtenerTodos();
      aplicarFiltros();
    } catch (error) {
      filaMensaje(cuerpoTabla, COLUMNAS, error.message, "text-danger");
    }
  }

  function aplicarFiltros() {
    const texto = campoBusqueda.value.trim().toLowerCase();
    const area = selectArea.value;
    const estado = selectEstado.value;

    $("kpiActivosTotal").textContent = activos.length;
    $("kpiActivosAsignados").textContent = activos.filter(function (a) { return a.id_asignacion; }).length;
    $("kpiActivosDisponibles").textContent = activos.filter(function (a) { return !a.id_asignacion; }).length;

    const filtrados = activos.filter(function (a) {
      const coincideTexto = [a.nombre_activo, a.serial, a.nombre_usuario].join(" ").toLowerCase().includes(texto);
      const coincideArea = area === "todas" || String(a.id_area) === area;
      let coincideEstado = true;
      if (estado === "asignado") coincideEstado = Boolean(a.id_asignacion);
      if (estado === "disponible") coincideEstado = !a.id_asignacion;
      return coincideTexto && coincideArea && coincideEstado;
    });
    renderizar(filtrados);
    $("contadorActivos").textContent = filtrados.length + (filtrados.length === 1 ? " activo" : " activos");
  }

  function crearBoton(texto, icono, clase, etiqueta, accion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-sm " + clase;
    boton.innerHTML = '<i class="bi ' + icono + '" aria-hidden="true"></i> ' + texto;
    boton.setAttribute("aria-label", etiqueta);
    boton.addEventListener("click", accion);
    return boton;
  }

  function renderizar(lista) {
    cuerpoTabla.innerHTML = "";
    if (!lista.length) {
      filaMensaje(cuerpoTabla, COLUMNAS, activos.length ? "No hay activos con los filtros seleccionados." : "Aún no hay activos registrados.");
      return;
    }
    lista.forEach(function (a) {
      const fila = document.createElement("tr");
      const asignacion = a.id_asignacion
        ? '<span class="fw-semibold">' + escaparHtml(a.nombre_usuario) + '</span><div class="small text-muted">Desde el ' + formatearFecha(a.fecha_asignacion) + "</div>"
        : '<span class="badge badge-estado badge-estado-confirmado">Disponible</span>';
      fila.innerHTML =
        '<td><span class="fw-semibold">' + escaparHtml(a.nombre_activo) + "</span><div><code>" + escaparHtml(a.serial) + "</code></div></td>" +
        "<td>" + escaparHtml(a.nombre_area || "—") + "</td>" +
        "<td>" + asignacion + "</td>" +
        '<td class="text-center">' + a.traslados + "</td>" +
        '<td class="acciones-turno"></td>';

      const grupo = document.createElement("div");
      grupo.className = "d-flex flex-wrap gap-1";
      const nombre = a.nombre_activo + " (" + a.serial + ")";
      grupo.appendChild(crearBoton("Historial", "bi-clock-history", "btn-outline-secondary", "Historial de " + nombre, function () { abrirHistorial(a); }));
      if (gestiona) {
        grupo.appendChild(crearBoton("Editar", "bi-pencil", "btn-outline-primary", "Editar " + nombre, function () { abrirEdicion(a); }));
        if (a.id_asignacion) {
          grupo.appendChild(crearBoton("Devolver", "bi-box-arrow-in-left", "btn-warning", "Registrar devolución de " + nombre, function () { devolver(a); }));
        } else {
          grupo.appendChild(crearBoton("Asignar", "bi-person-check", "btn-success", "Asignar " + nombre, function () { abrirAsignar(a); }));
        }
        grupo.appendChild(crearBoton("Trasladar", "bi-arrow-left-right", "btn-outline-primary", "Trasladar " + nombre, function () { abrirTraslado(a); }));
        const boton = crearBoton("Eliminar", "bi-trash", "btn-outline-danger", "Eliminar " + nombre, function () { eliminar(a); });
        if (a.id_asignacion || a.traslados > 0) {
          boton.disabled = true;
          boton.title = a.id_asignacion ? "Está asignado: primero registre la devolución" : "Tiene historial de traslados";
        }
        grupo.appendChild(boton);
      }
      fila.querySelector(".acciones-turno").appendChild(grupo);
      cuerpoTabla.appendChild(fila);
    });
  }

  // ---------- Historial ----------
  async function abrirHistorial(a) {
    const contenido = $("contenidoHistorialActivo");
    $("tituloHistorialActivo").textContent = a.nombre_activo + " · " + a.serial;
    contenido.innerHTML = '<p class="text-muted">Cargando...</p>';
    bootstrap.Modal.getOrCreateInstance($("modalHistorialActivo")).show();
    try {
      const h = await activoService.obtenerHistorial(a.id_activo);
      if (!h.movimientos.length) {
        contenido.innerHTML = '<p class="text-muted mb-0">Este activo aún no tiene movimientos registrados por el sistema.</p>';
        return;
      }
      contenido.innerHTML = '<ul class="list-group">' + h.movimientos.map(function (m) {
        return '<li class="list-group-item"><div class="d-flex justify-content-between flex-wrap gap-2"><span class="badge text-bg-light border">' +
          escaparHtml(m.tipo) + '</span><span class="small text-muted">' + formatearFechaHora(m.fecha) + "</span></div>" +
          '<div class="mt-1">' + escaparHtml(m.detalle || "") + "</div>" +
          (m.realizado_por ? '<div class="small text-muted">Por ' + escaparHtml(m.realizado_por) + "</div>" : "") + "</li>";
      }).join("") + "</ul>";
    } catch (error) {
      contenido.innerHTML = '<div class="alert alert-danger">' + escaparHtml(error.message) + "</div>";
    }
  }

  if (!gestiona) {
    cargarCatalogos().then(cargarActivos);
    [selectArea, selectEstado].forEach(function (s) { s.addEventListener("change", aplicarFiltros); });
    campoBusqueda.addEventListener("input", aplicarFiltros);
    return;
  }

  // ---------- Crear / editar ----------
  const modalActivo = $("modalActivo");
  const errorActivo = $("mensajeModalActivo");
  const mostrarError = function (elemento, texto) { elemento.textContent = texto; elemento.classList.remove("d-none"); };

  function prepararModal(a) {
    $("formActivo").reset();
    errorActivo.classList.add("d-none");
    $("activoIdEditando").value = a ? a.id_activo : "";
    $("modalActivoLabel").textContent = a ? "Editar activo" : "Nuevo activo";
    $("btnGuardarActivo").textContent = a ? "Guardar cambios" : "Registrar activo";
    // El área de un activo existente solo cambia con un traslado (queda historial).
    $("grupoAreaActivo").classList.toggle("d-none", Boolean(a));
    if (a) {
      $("activoNombre").value = a.nombre_activo;
      $("activoSerial").value = a.serial;
    }
  }

  function abrirEdicion(a) {
    prepararModal(a);
    bootstrap.Modal.getOrCreateInstance(modalActivo).show();
  }

  $("btnNuevoActivo").addEventListener("click", function () {
    prepararModal(null);
    bootstrap.Modal.getOrCreateInstance(modalActivo).show();
  });

  $("formActivo").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const idEditando = $("activoIdEditando").value;
    const datos = {
      nombre_activo: $("activoNombre").value.trim(),
      serial: $("activoSerial").value.trim().toUpperCase(),
      id_area: $("activoArea").value || null,
    };
    if (datos.nombre_activo.length < 2) return mostrarError(errorActivo, "Escriba el nombre del activo.");
    if (!/^[A-Z0-9][A-Z0-9\-_./]{1,99}$/.test(datos.serial)) {
      return mostrarError(errorActivo, "El serial solo admite letras, números, guion, punto, barra o guion bajo (mínimo 2 caracteres).");
    }
    const boton = $("btnGuardarActivo");
    boton.disabled = true;
    try {
      if (idEditando) await activoService.actualizar(idEditando, datos);
      else await activoService.crear(datos);
      bootstrap.Modal.getOrCreateInstance(modalActivo).hide();
      mostrarNotificacion(idEditando ? "Activo actualizado correctamente." : "Activo registrado correctamente.");
      await cargarActivos();
    } catch (error) {
      mostrarError(errorActivo, error.message);
    } finally {
      boton.disabled = false;
    }
  });

  // ---------- Asignar ----------
  function abrirAsignar(a) {
    $("formAsignar").reset();
    $("mensajeAsignar").classList.add("d-none");
    $("asignarId").value = a.id_activo;
    $("asignarNombre").textContent = a.nombre_activo + " · " + a.serial;
    bootstrap.Modal.getOrCreateInstance($("modalAsignar")).show();
  }

  $("formAsignar").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const idUsuario = $("asignarEmpleado").value;
    if (!idUsuario) return mostrarError($("mensajeAsignar"), "Seleccione el empleado que recibe el equipo.");
    const boton = evento.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      const r = await activoService.asignar($("asignarId").value, idUsuario);
      bootstrap.Modal.getOrCreateInstance($("modalAsignar")).hide();
      mostrarNotificacion(r.mensaje + ".");
      await Promise.all([cargarActivos(), cargarMios()]);
    } catch (error) {
      mostrarError($("mensajeAsignar"), error.message);
    } finally {
      boton.disabled = false;
    }
  });

  // ---------- Trasladar ----------
  function abrirTraslado(a) {
    $("formTraslado").reset();
    $("mensajeTraslado").classList.add("d-none");
    $("trasladoId").value = a.id_activo;
    $("trasladoNombre").textContent = a.nombre_activo + " · " + a.serial + " — área actual: " + (a.nombre_area || "sin área");
    bootstrap.Modal.getOrCreateInstance($("modalTraslado")).show();
  }

  $("formTraslado").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const idArea = $("trasladoArea").value;
    if (!idArea) return mostrarError($("mensajeTraslado"), "Seleccione el área de destino.");
    const boton = evento.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      const r = await activoService.trasladar($("trasladoId").value, idArea);
      bootstrap.Modal.getOrCreateInstance($("modalTraslado")).hide();
      mostrarNotificacion(r.mensaje + ".");
      await cargarActivos();
    } catch (error) {
      mostrarError($("mensajeTraslado"), error.message);
    } finally {
      boton.disabled = false;
    }
  });

  // ---------- Devolver y eliminar ----------
  async function devolver(a) {
    const r = await confirmarAccion({
      titulo: "Registrar devolución",
      mensaje: a.nombre_usuario + " entrega " + a.nombre_activo + " (" + a.serial + "). El equipo quedará disponible.",
      textoBoton: "Registrar devolución",
      claseBoton: "btn-warning",
      campoTexto: { etiqueta: "Observación (opcional)", placeholder: "Ej.: entregado en buen estado" },
    });
    if (!r.confirmado) return;
    try {
      const respuesta = await activoService.devolver(a.id_activo, r.texto);
      mostrarNotificacion(respuesta.mensaje + ".");
      await Promise.all([cargarActivos(), cargarMios()]);
    } catch (error) {
      mostrarNotificacion(error.message, "danger");
    }
  }

  async function eliminar(a) {
    const r = await confirmarAccion({
      titulo: "Eliminar activo",
      mensaje: "¿Eliminar " + a.nombre_activo + " (" + a.serial + ") del inventario? Esta acción no se puede deshacer.",
      textoBoton: "Eliminar",
      claseBoton: "btn-danger",
    });
    if (!r.confirmado) return;
    try {
      await activoService.eliminar(a.id_activo);
      mostrarNotificacion("Activo eliminado correctamente.");
      await cargarActivos();
    } catch (error) {
      mostrarNotificacion(error.message, "danger");
    }
  }

  function exportar() {
    if (!activos.length) return;
    exportarCSV("inventario_activos_" + fechaLocalISO() + ".csv", [
      { titulo: "Activo", valor: function (a) { return a.nombre_activo; } },
      { titulo: "Serial", valor: function (a) { return a.serial; } },
      { titulo: "Área", valor: function (a) { return a.nombre_area; } },
      { titulo: "Asignado a", valor: function (a) { return a.nombre_usuario || "Disponible"; } },
      { titulo: "Desde", valor: function (a) { return a.fecha_asignacion ? formatearFecha(a.fecha_asignacion, false) : ""; } },
      { titulo: "Traslados", valor: function (a) { return a.traslados; } },
    ], activos);
  }

  [selectArea, selectEstado].forEach(function (s) { s.addEventListener("change", aplicarFiltros); });
  campoBusqueda.addEventListener("input", aplicarFiltros);
  $("btnExportarActivos").addEventListener("click", exportar);

  cargarCatalogos().then(cargarActivos);
});
