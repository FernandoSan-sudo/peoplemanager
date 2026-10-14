/* =========================================================
   paginas/turnos.js — Gestión de turnos (turnos.html)
   -----------------------------------------------------------
   - Administrador / Supervisor: asignan (un día o varios días a
     la vez), editan y eliminan turnos.
   - RRHH: consulta todos los turnos (solo lectura).
   - Empleado: ve únicamente "Mis turnos".
   Las reglas (cruces de horario, vacaciones, fechas pasadas) las
   valida el backend; aquí se validan antes para dar respuesta
   inmediata, y se muestra el mensaje de la API si algo falla.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const cuerpoTabla = document.getElementById("cuerpoTablaTurnos");
  if (!cuerpoTabla) return;

  const sesion = exigirSesion();
  if (!sesion) return;

  const puedePlanificar = tieneRol(sesion, ROLES_PLANIFICAN_TURNOS);
  const verTodos = esGestor(sesion);
  const COLUMNAS = 6;
  const hoy = fechaLocalISO();

  const $ = function (id) { return document.getElementById(id); };
  const selectFiltroArea = $("filtroArea");
  const campoBusqueda = $("buscarEmpleado");
  const campoDesde = $("filtroDesde");
  const campoHasta = $("filtroHasta");
  const formNuevoTurno = $("formNuevoTurno");
  const selectEmpleado = $("nuevoEmpleado");
  const selectArea = $("nuevaArea");
  const elementoModal = $("modalNuevoTurno");
  const mensajeError = $("mensajeModalTurno");

  let turnos = [];
  let empleados = [];

  // ---------- Ajustes según el rol ----------
  if (!verTodos) {
    $("tituloTurnos").textContent = "Mis turnos";
    $("subtituloTurnos").textContent = "Consulta los turnos que tienes asignados y su estado de asistencia.";
    document.querySelectorAll("[data-solo-gestor]").forEach(function (el) { el.classList.add("d-none"); });
  }
  if (!puedePlanificar) {
    document.querySelectorAll("[data-solo-planificador]").forEach(function (el) { el.classList.add("d-none"); });
  }

  // Rango por defecto: la semana pasada y el próximo mes.
  campoDesde.value = sumarDiasISO(hoy, -7);
  campoHasta.value = sumarDiasISO(hoy, 30);

  // ---------- Carga de datos ----------
  async function cargarCatalogos() {
    try {
      const areas = await catalogoService.obtenerAreas();
      llenarSelect(selectFiltroArea, areas, function (a) { return a.id_area; }, function (a) { return a.nombre_area; });
      llenarSelect(selectArea, areas, function (a) { return a.id_area; }, function (a) { return a.nombre_area; });

      if (puedePlanificar) {
        empleados = await usuarioService.obtenerTodos({ estado: "activo" });
        llenarSelect(selectEmpleado, empleados, function (u) { return u.id_usuario; }, function (u) {
          return u.nombre_completo + (u.nombre_area ? " — " + u.nombre_area : "");
        });
      }
    } catch (error) {
      mostrarNotificacion("No se pudieron cargar los catálogos: " + error.message, "danger");
    }
  }

  async function cargarTurnos() {
    filaMensaje(cuerpoTabla, COLUMNAS, "Cargando turnos...");
    try {
      turnos = await turnoService.obtenerTodos({
        desde: campoDesde.value,
        hasta: campoHasta.value,
        id_area: selectFiltroArea.value === "todas" ? "" : selectFiltroArea.value,
      });
      aplicarFiltrosYRenderizar();
    } catch (error) {
      filaMensaje(cuerpoTabla, COLUMNAS, error.message || "No se pudieron cargar los turnos.", "text-danger");
    }
  }

  // ---------- Tabla ----------
  function aplicarFiltrosYRenderizar() {
    const textoBusqueda = campoBusqueda ? campoBusqueda.value.trim().toLowerCase() : "";
    const filtrados = turnos.filter(function (turno) {
      return (turno.nombre_usuario || "").toLowerCase().includes(textoBusqueda);
    });
    // Orden cronológico: lo más cercano a hoy arriba.
    filtrados.sort(function (a, b) {
      return (a.fecha_turno + a.hora_inicio).localeCompare(b.fecha_turno + b.hora_inicio);
    });
    renderizarTurnos(filtrados);
    $("contadorTurnos").textContent = filtrados.length + (filtrados.length === 1 ? " turno" : " turnos");
  }

  function motivoBloqueoEdicion(turno) {
    if (turno.id_asistencia) return "Ya tiene asistencia registrada";
    if (turno.fecha_turno < hoy) return "Es de una fecha pasada (historial)";
    return null;
  }

  function renderizarTurnos(lista) {
    cuerpoTabla.innerHTML = "";
    if (lista.length === 0) {
      filaMensaje(cuerpoTabla, COLUMNAS, "No hay turnos en el rango y los filtros seleccionados.");
      return;
    }

    lista.forEach(function (turno) {
      const fila = document.createElement("tr");
      if (turno.fecha_turno === hoy) fila.classList.add("fila-hoy");

      fila.innerHTML =
        "<td><span class=\"fw-semibold\">" + escaparHtml(turno.nombre_usuario) + "</span></td>" +
        "<td>" + escaparHtml(turno.nombre_area || "—") + "</td>" +
        "<td>" + formatearFecha(turno.fecha_turno) + (turno.fecha_turno === hoy ? ' <span class="badge text-bg-primary">Hoy</span>' : "") + "</td>" +
        "<td>" + badgeHorario(turno) + "</td>" +
        "<td>" + badgeEstadoAsistencia(turno) + "</td>" +
        '<td class="acciones-turno"></td>';

      const celdaAcciones = fila.querySelector(".acciones-turno");

      if (puedePlanificar) {
        const bloqueo = motivoBloqueoEdicion(turno);

        const botonEditar = document.createElement("button");
        botonEditar.type = "button";
        botonEditar.className = "btn btn-sm btn-outline-primary me-2";
        botonEditar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i> Editar';
        botonEditar.setAttribute("aria-label", "Editar turno de " + turno.nombre_usuario + " del " + formatearFecha(turno.fecha_turno, false));
        botonEditar.disabled = Boolean(bloqueo);
        if (bloqueo) botonEditar.title = "No se puede editar: " + bloqueo;
        botonEditar.addEventListener("click", function () { abrirModalEdicion(turno); });

        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "btn btn-sm btn-outline-danger btn-eliminar-turno";
        botonEliminar.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i> Eliminar';
        botonEliminar.setAttribute("aria-label", "Eliminar turno de " + turno.nombre_usuario + " del " + formatearFecha(turno.fecha_turno, false));
        botonEliminar.disabled = Boolean(bloqueo);
        if (bloqueo) botonEliminar.title = "No se puede eliminar: " + bloqueo;
        botonEliminar.addEventListener("click", function () { eliminarTurno(turno); });

        celdaAcciones.appendChild(botonEditar);
        celdaAcciones.appendChild(botonEliminar);
      } else {
        const detalle = document.createElement("span");
        detalle.className = "text-muted small";
        detalle.textContent = turno.hora_entrada
          ? "Entrada " + formatearHoraDeTimestamp(turno.hora_entrada) + (turno.hora_salida ? " · Salida " + formatearHoraDeTimestamp(turno.hora_salida) : "")
          : "—";
        celdaAcciones.appendChild(detalle);
      }

      cuerpoTabla.appendChild(fila);
    });
  }

  async function eliminarTurno(turno) {
    const respuesta = await confirmarAccion({
      titulo: "Eliminar turno",
      mensaje: "¿Eliminar el turno de " + turno.nombre_usuario + " del " + formatearFecha(turno.fecha_turno) +
        " (" + formatearHora(turno.hora_inicio) + " - " + formatearHora(turno.hora_fin) + ")?",
      textoBoton: "Eliminar",
      claseBoton: "btn-danger",
    });
    if (!respuesta.confirmado) return;

    try {
      await turnoService.eliminar(turno.id_turno);
      mostrarNotificacion("Turno eliminado correctamente.");
      await cargarTurnos();
    } catch (error) {
      mostrarNotificacion(error.message || "No se pudo eliminar el turno.", "danger");
    }
  }

  // ---------- Modal: crear / editar ----------
  function modoSeleccionado() {
    const marcado = document.querySelector('input[name="modoTurno"]:checked');
    return marcado ? marcado.value : "uno";
  }

  function actualizarModo() {
    const varios = modoSeleccionado() === "varios";
    $("grupoFechaUnica").classList.toggle("d-none", varios);
    $("grupoRango").classList.toggle("d-none", !varios);
  }

  function actualizarDuracion() {
    const inicio = $("nuevaHoraInicio").value;
    const fin = $("nuevaHoraFin").value;
    const salida = $("duracionTurno");
    if (!inicio || !fin) {
      salida.textContent = "";
      return;
    }
    const minutos = (Number(fin.slice(0, 2)) * 60 + Number(fin.slice(3, 5))) - (Number(inicio.slice(0, 2)) * 60 + Number(inicio.slice(3, 5)));
    if (minutos <= 0) {
      salida.textContent = "La hora de fin debe ser posterior a la de inicio.";
      salida.className = "form-text text-danger";
      return;
    }
    salida.textContent = "Duración: " + Math.floor(minutos / 60) + " h" + (minutos % 60 ? " " + (minutos % 60) + " min" : "") +
      " · Franja: " + obtenerFranjaHoraria(inicio);
    salida.className = "form-text";
  }

  function mostrarError(texto) {
    mensajeError.textContent = texto;
    mensajeError.classList.remove("d-none");
    mensajeError.focus();
  }

  function prepararModalNuevo() {
    formNuevoTurno.reset();
    $("turnoIdEditando").value = "";
    selectEmpleado.disabled = false;
    document.querySelectorAll("[data-solo-creacion]").forEach(function (el) { el.classList.remove("d-none"); });
    $("modalNuevoTurnoLabel").textContent = "Asignar turno";
    $("btnGuardarTurno").textContent = "Guardar turno";
    mensajeError.classList.add("d-none");
    $("nuevaFecha").value = hoy;
    $("loteDesde").value = hoy;
    $("loteHasta").value = sumarDiasISO(hoy, 6);
    actualizarModo();
    actualizarDuracion();
  }

  function abrirModalEdicion(turno) {
    prepararModalNuevo();
    $("turnoIdEditando").value = turno.id_turno;
    selectEmpleado.value = turno.id_usuario;
    selectEmpleado.disabled = true; // no se reasigna el turno a otra persona
    document.querySelectorAll("[data-solo-creacion]").forEach(function (el) { el.classList.add("d-none"); });
    $("modoUno").checked = true;
    actualizarModo();
    selectArea.value = turno.id_area || "";
    $("nuevaFecha").value = turno.fecha_turno;
    $("nuevaHoraInicio").value = formatearHora(turno.hora_inicio);
    $("nuevaHoraFin").value = formatearHora(turno.hora_fin);
    $("modalNuevoTurnoLabel").textContent = "Editar turno de " + turno.nombre_usuario;
    $("btnGuardarTurno").textContent = "Guardar cambios";
    actualizarDuracion();
    bootstrap.Modal.getOrCreateInstance(elementoModal).show();
  }

  function mostrarResultadoLote(respuesta) {
    const alerta = $("alertaResultadoLote");
    if (!respuesta.omitidos || !respuesta.omitidos.length) {
      alerta.classList.add("d-none");
      return;
    }
    alerta.innerHTML =
      "<strong>" + escaparHtml(respuesta.mensaje) + ".</strong> Días omitidos:" +
      '<ul class="mb-0 mt-1">' + respuesta.omitidos.map(function (o) {
        return "<li>" + formatearFecha(o.fecha) + ": " + escaparHtml(o.motivo) + "</li>";
      }).join("") + "</ul>" +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>';
    alerta.classList.remove("d-none");
  }

  if (puedePlanificar && formNuevoTurno) {
    $("btnAsignarTurno").addEventListener("click", function () {
      prepararModalNuevo();
      bootstrap.Modal.getOrCreateInstance(elementoModal).show();
    });

    document.querySelectorAll('input[name="modoTurno"]').forEach(function (radio) {
      radio.addEventListener("change", actualizarModo);
    });
    ["nuevaHoraInicio", "nuevaHoraFin"].forEach(function (id) { $(id).addEventListener("input", actualizarDuracion); });

    // Plantillas de horario frecuentes.
    document.querySelectorAll("[data-plantilla]").forEach(function (boton) {
      boton.addEventListener("click", function () {
        const partes = boton.dataset.plantilla.split("-");
        $("nuevaHoraInicio").value = partes[0];
        $("nuevaHoraFin").value = partes[1];
        actualizarDuracion();
      });
    });

    // Al elegir empleado se propone su área.
    selectEmpleado.addEventListener("change", function () {
      const empleado = empleados.find(function (u) { return String(u.id_usuario) === selectEmpleado.value; });
      if (empleado && empleado.id_area) selectArea.value = empleado.id_area;
    });

    ["nuevaFecha", "loteDesde", "loteHasta"].forEach(function (id) { $(id).setAttribute("min", hoy); });

    formNuevoTurno.addEventListener("submit", async function (evento) {
      evento.preventDefault();

      const idEditando = $("turnoIdEditando").value;
      const varios = !idEditando && modoSeleccionado() === "varios";
      const datos = {
        id_usuario: selectEmpleado.value,
        id_area: selectArea.value || null,
        hora_inicio: $("nuevaHoraInicio").value,
        hora_fin: $("nuevaHoraFin").value,
      };

      if (!datos.id_usuario || !datos.hora_inicio || !datos.hora_fin) return mostrarError("Seleccione el empleado y el horario del turno.");
      if (datos.hora_fin <= datos.hora_inicio) return mostrarError("La hora de fin debe ser posterior a la hora de inicio.");

      if (varios) {
        datos.fecha_inicio = $("loteDesde").value;
        datos.fecha_fin = $("loteHasta").value;
        datos.dias_semana = Array.from(document.querySelectorAll(".dia-semana:checked")).map(function (c) { return Number(c.value); });
        if (!datos.fecha_inicio || !datos.fecha_fin) return mostrarError("Indique el rango de fechas.");
        if (datos.fecha_fin < datos.fecha_inicio) return mostrarError("La fecha final no puede ser anterior a la inicial.");
        if (datos.fecha_inicio < hoy) return mostrarError("No se pueden asignar turnos en fechas anteriores a hoy.");
        if (!datos.dias_semana.length) return mostrarError("Seleccione al menos un día de la semana.");
      } else {
        datos.fecha_turno = $("nuevaFecha").value;
        if (!datos.fecha_turno) return mostrarError("Indique la fecha del turno.");
        if (datos.fecha_turno < hoy) return mostrarError("No se pueden asignar turnos en fechas anteriores a hoy.");
      }

      mensajeError.classList.add("d-none");
      const botonGuardar = $("btnGuardarTurno");
      botonGuardar.disabled = true;

      try {
        let mensaje;
        let tipo = "success";
        if (idEditando) {
          await turnoService.actualizar(idEditando, datos);
          mensaje = "Turno actualizado correctamente.";
        } else if (varios) {
          const respuesta = await turnoService.crearLote(datos);
          mensaje = respuesta.mensaje + ".";
          if (respuesta.omitidos.length) tipo = "warning";
          mostrarResultadoLote(respuesta);
        } else {
          await turnoService.crear(datos);
          mensaje = "Turno asignado correctamente.";
        }

        bootstrap.Modal.getOrCreateInstance(elementoModal).hide();
        await cargarTurnos();
        mostrarNotificacion(mensaje, tipo);
      } catch (error) {
        // En el lote, un 409 trae la lista de días omitidos: se muestra en el modal.
        if (error.cuerpo && error.cuerpo.omitidos && error.cuerpo.omitidos.length) {
          mostrarError(error.message + ". Ejemplo: " + formatearFecha(error.cuerpo.omitidos[0].fecha) + " — " + error.cuerpo.omitidos[0].motivo);
        } else {
          mostrarError(error.message || "No se pudo guardar el turno.");
        }
      } finally {
        botonGuardar.disabled = false;
      }
    });
  }

  // ---------- Filtros ----------
  document.querySelectorAll("[data-rango]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      const rango = boton.dataset.rango;
      if (rango === "hoy") {
        campoDesde.value = hoy;
        campoHasta.value = hoy;
      } else if (rango === "semana") {
        const diaSemana = new Date().getDay() || 7; // lunes = 1 ... domingo = 7
        campoDesde.value = sumarDiasISO(hoy, 1 - diaSemana);
        campoHasta.value = sumarDiasISO(hoy, 7 - diaSemana);
      } else if (rango === "proximos") {
        campoDesde.value = hoy;
        campoHasta.value = sumarDiasISO(hoy, 30);
      } else {
        campoDesde.value = "";
        campoHasta.value = "";
      }
      cargarTurnos();
    });
  });

  [selectFiltroArea, campoDesde, campoHasta].forEach(function (campo) {
    if (campo) campo.addEventListener("change", cargarTurnos);
  });
  if (campoBusqueda) campoBusqueda.addEventListener("input", aplicarFiltrosYRenderizar);

  cargarCatalogos().then(cargarTurnos);
});
