/* =========================================================
   paginas/asistencia.js — Control de asistencia (asistencia.html)
   -----------------------------------------------------------
   No duplica datos: lee los turnos de la API y, por cada uno,
   permite registrar entrada/salida. El estado (a tiempo,
   tardanza, salida anticipada, ausente, justificado) y la hora
   siempre los pone el backend.
     - Panel "Mi turno de hoy": botón grande para marcar la
       propia asistencia (cualquier rol que tenga turno hoy).
     - Tabla: un gestor ve y puede marcar a todo el personal; un
       Empleado solo ve lo suyo.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const cuerpoTabla = document.getElementById("cuerpoTablaAsistencia");
  if (!cuerpoTabla) return;

  const sesion = exigirSesion();
  if (!sesion) return;

  const verTodos = esGestor(sesion);
  const COLUMNAS = 8;
  const hoy = fechaLocalISO();
  const $ = function (id) { return document.getElementById(id); };

  const selectFiltroArea = $("filtroAreaAsistencia");
  const campoFiltroFecha = $("filtroFechaAsistencia");
  const campoBusqueda = $("buscarEmpleadoAsistencia");
  const selectEstado = $("filtroEstadoAsistencia");

  let turnos = [];
  let filtradosActuales = [];

  if (!verTodos) {
    $("tituloAsistencia").textContent = "Mi asistencia";
    $("subtituloAsistencia").textContent = "Registra tu entrada y salida, y consulta el estado de tus turnos.";
    document.querySelectorAll("[data-solo-gestor]").forEach(function (el) { el.classList.add("d-none"); });
  }

  campoFiltroFecha.value = hoy;

  // ---------- Reloj ----------
  function actualizarReloj() {
    const ahora = new Date();
    $("relojActual").textContent = dosDigitos(ahora.getHours()) + ":" + dosDigitos(ahora.getMinutes()) + ":" + dosDigitos(ahora.getSeconds());
  }
  actualizarReloj();
  setInterval(actualizarReloj, 1000);

  // ---------- Acciones ----------
  function crearBotonAccion(turno, grande) {
    const tamano = grande ? "btn-lg" : "btn-sm";
    if (turno.fecha_turno !== hoy || turno.estado_asistencia === "justificado") return null;

    if (!turno.hora_entrada) {
      if (turno.estado_asistencia === "ausente") return null; // el turno ya terminó sin marcar
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn btn-success " + tamano;
      boton.innerHTML = '<i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Registrar entrada';
      boton.setAttribute("aria-label", "Registrar entrada de " + turno.nombre_usuario);
      boton.addEventListener("click", function () { registrar("entrada", turno, boton); });
      return boton;
    }
    if (!turno.hora_salida) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn btn-outline-primary " + tamano;
      boton.innerHTML = '<i class="bi bi-box-arrow-right" aria-hidden="true"></i> Registrar salida';
      boton.setAttribute("aria-label", "Registrar salida de " + turno.nombre_usuario);
      boton.addEventListener("click", function () { registrar("salida", turno, boton); });
      return boton;
    }
    return null;
  }

  async function registrar(tipo, turno, boton) {
    const esPropio = turno.id_usuario === sesion.id_usuario;
    if (!esPropio) {
      const respuesta = await confirmarAccion({
        titulo: tipo === "entrada" ? "Registrar entrada" : "Registrar salida",
        mensaje: "¿Registrar la " + tipo + " de " + turno.nombre_usuario + " con la hora actual (" + formatearHoraDeTimestamp(new Date()) + ")?",
        textoBoton: "Registrar",
      });
      if (!respuesta.confirmado) return;
    }

    boton.disabled = true;
    try {
      const respuesta = tipo === "entrada"
        ? await asistenciaService.registrarEntrada(turno.id_turno)
        : await asistenciaService.registrarSalida(turno.id_turno);
      const estado = respuesta.asistencia && respuesta.asistencia.estado_registro;
      mostrarNotificacion(respuesta.mensaje, estado === "tardanza" || estado === "salida_anticipada" ? "warning" : "success");
      await cargarTodo();
    } catch (error) {
      mostrarNotificacion(error.message || "No se pudo registrar la " + tipo + ".", "danger");
      boton.disabled = false;
    }
  }

  // ---------- Panel "Mi turno de hoy" ----------
  async function cargarMiTurno() {
    const contenedor = $("contenidoMiTurno");
    try {
      const misTurnos = await turnoService.obtenerTodos({ fecha: hoy, id_usuario: sesion.id_usuario });
      if (!misTurnos.length) {
        contenedor.innerHTML = '<p class="text-muted mb-0"><i class="bi bi-calendar-x me-1" aria-hidden="true"></i>No tienes turnos asignados para hoy.</p>';
        return;
      }
      contenedor.innerHTML = "";
      misTurnos.sort(function (a, b) { return a.hora_inicio.localeCompare(b.hora_inicio); }).forEach(function (turno) {
        const bloque = document.createElement("div");
        bloque.className = "mi-turno d-flex flex-wrap align-items-center gap-3";
        bloque.innerHTML =
          '<div class="flex-grow-1"><div class="fs-5 fw-semibold">' + formatearHora(turno.hora_inicio) + " – " + formatearHora(turno.hora_fin) + "</div>" +
          '<div class="small text-muted">' + escaparHtml(turno.nombre_area || "Sin área") +
          (turno.hora_entrada ? " · Entrada " + formatearHoraDeTimestamp(turno.hora_entrada) : "") +
          (turno.hora_salida ? " · Salida " + formatearHoraDeTimestamp(turno.hora_salida) : "") +
          (turno.minutos_tardanza > 0 ? " · " + turno.minutos_tardanza + " min de tardanza" : "") +
          "</div></div>" +
          "<div>" + badgeEstadoAsistencia(turno) + "</div>";
        const boton = crearBotonAccion(turno, true);
        if (boton) bloque.appendChild(boton);
        contenedor.appendChild(bloque);
      });
    } catch (error) {
      contenedor.innerHTML = '<p class="text-danger mb-0">' + escaparHtml(error.message) + "</p>";
    }
  }

  // ---------- Tabla ----------
  async function cargarTurnos() {
    filaMensaje(cuerpoTabla, COLUMNAS, "Cargando...");
    try {
      const filtros = campoFiltroFecha.value
        ? { fecha: campoFiltroFecha.value }
        : { desde: sumarDiasISO(hoy, -30), hasta: sumarDiasISO(hoy, 7) };
      if (selectFiltroArea && selectFiltroArea.value !== "todas") filtros.id_area = selectFiltroArea.value;
      turnos = await turnoService.obtenerTodos(filtros);
      aplicarFiltrosYRenderizar();
    } catch (error) {
      filaMensaje(cuerpoTabla, COLUMNAS, error.message || "No se pudo cargar la asistencia.", "text-danger");
    }
  }

  function aplicarFiltrosYRenderizar() {
    const textoBusqueda = campoBusqueda ? campoBusqueda.value.trim().toLowerCase() : "";
    const estado = selectEstado ? selectEstado.value : "todos";

    const coincidenBusqueda = turnos.filter(function (turno) {
      return (turno.nombre_usuario || "").toLowerCase().includes(textoBusqueda);
    });
    // Las tarjetas resumen reflejan la fecha/área/búsqueda, sin el filtro de estado.
    actualizarResumen(coincidenBusqueda);

    filtradosActuales = coincidenBusqueda.filter(function (turno) {
      if (estado === "todos") return true;
      if (estado === "tardanza") return turno.estado_asistencia === "tardanza" || turno.estado_asistencia === "salida_anticipada";
      return turno.estado_asistencia === estado;
    });

    renderizarAsistencia(filtradosActuales);
    $("contadorAsistencia").textContent = filtradosActuales.length + (filtradosActuales.length === 1 ? " registro" : " registros");
    $("avisoSinTurnos").classList.toggle("d-none", turnos.length > 0);
  }

  function actualizarResumen(lista) {
    const conteo = { completo: 0, tardanza: 0, salida_anticipada: 0, ausente: 0, pendiente: 0, justificado: 0 };
    lista.forEach(function (turno) {
      if (conteo[turno.estado_asistencia] !== undefined) conteo[turno.estado_asistencia] += 1;
    });
    $("statPresentes").textContent = conteo.completo;
    $("statTardanzas").textContent = conteo.tardanza + conteo.salida_anticipada;
    $("statAusencias").textContent = conteo.ausente;
    $("statSinMarcar").textContent = conteo.pendiente;
    $("statJustificados").textContent = conteo.justificado;
  }

  function renderizarAsistencia(lista) {
    cuerpoTabla.innerHTML = "";
    if (lista.length === 0) {
      filaMensaje(cuerpoTabla, COLUMNAS, "No hay turnos que coincidan con la búsqueda o los filtros seleccionados.");
      return;
    }

    lista.forEach(function (turno) {
      const fila = document.createElement("tr");
      const tardanza = turno.minutos_tardanza > 0 ? ' <span class="small text-warning-emphasis">(+' + turno.minutos_tardanza + " min)</span>" : "";

      fila.innerHTML =
        '<td><span class="fw-semibold">' + escaparHtml(turno.nombre_usuario) + "</span></td>" +
        "<td>" + escaparHtml(turno.nombre_area || "—") + "</td>" +
        "<td>" + formatearFecha(turno.fecha_turno) + "</td>" +
        "<td>" + badgeHorario(turno) + "</td>" +
        "<td>" + formatearHoraDeTimestamp(turno.hora_entrada) + tardanza + "</td>" +
        "<td>" + formatearHoraDeTimestamp(turno.hora_salida) + "</td>" +
        "<td>" + badgeEstadoAsistencia(turno) +
        (turno.observaciones ? '<div class="small text-muted mt-1">' + escaparHtml(turno.observaciones) + "</div>" : "") + "</td>" +
        '<td class="acciones-turno"></td>';

      const celda = fila.querySelector(".acciones-turno");
      const boton = crearBotonAccion(turno, false);
      if (boton) {
        celda.appendChild(boton);
      } else {
        const texto = document.createElement("span");
        texto.className = "text-muted small";
        if (turno.hora_salida) texto.textContent = "Jornada cerrada";
        else if (turno.estado_asistencia === "justificado") texto.textContent = "Con novedad aprobada";
        else if (turno.estado_asistencia === "ausente") texto.textContent = "Sin registro";
        else if (turno.fecha_turno > hoy) texto.textContent = "Programado";
        else texto.textContent = "—";
        celda.appendChild(texto);
      }

      cuerpoTabla.appendChild(fila);
    });
  }

  function exportar() {
    if (!filtradosActuales.length) {
      mostrarNotificacion("No hay registros para exportar con los filtros actuales.", "warning");
      return;
    }
    exportarCSV("asistencia_" + (campoFiltroFecha.value || "ultimos_30_dias") + ".csv", [
      { titulo: "Empleado", valor: function (t) { return t.nombre_usuario; } },
      { titulo: "Documento", valor: function (t) { return t.numero_documento; } },
      { titulo: "Área", valor: function (t) { return t.nombre_area; } },
      { titulo: "Fecha", valor: function (t) { return formatearFecha(t.fecha_turno, false); } },
      { titulo: "Hora inicio", valor: function (t) { return formatearHora(t.hora_inicio); } },
      { titulo: "Hora fin", valor: function (t) { return formatearHora(t.hora_fin); } },
      { titulo: "Entrada", valor: function (t) { return t.hora_entrada ? formatearHoraDeTimestamp(t.hora_entrada) : ""; } },
      { titulo: "Salida", valor: function (t) { return t.hora_salida ? formatearHoraDeTimestamp(t.hora_salida) : ""; } },
      { titulo: "Minutos de tardanza", valor: function (t) { return t.minutos_tardanza || 0; } },
      { titulo: "Estado", valor: function (t) { return (ESTADOS_ASISTENCIA_INFO[t.estado_asistencia] || {}).etiqueta; } },
      { titulo: "Observaciones", valor: function (t) { return t.observaciones || t.justificacion || ""; } },
    ], filtradosActuales);
  }

  async function cargarAreas() {
    if (!selectFiltroArea || !verTodos) return;
    try {
      const areas = await catalogoService.obtenerAreas();
      llenarSelect(selectFiltroArea, areas, function (a) { return a.id_area; }, function (a) { return a.nombre_area; });
    } catch (error) {
      mostrarNotificacion("No se pudieron cargar las áreas: " + error.message, "danger");
    }
  }

  function cargarTodo() {
    return Promise.all([cargarMiTurno(), cargarTurnos()]);
  }

  // ---------- Eventos ----------
  document.querySelectorAll("[data-fecha]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      const opcion = boton.dataset.fecha;
      if (opcion === "hoy") campoFiltroFecha.value = hoy;
      else if (opcion === "ayer") campoFiltroFecha.value = sumarDiasISO(hoy, -1);
      else campoFiltroFecha.value = "";
      cargarTurnos();
    });
  });
  if (selectFiltroArea) selectFiltroArea.addEventListener("change", cargarTurnos);
  campoFiltroFecha.addEventListener("change", cargarTurnos);
  if (campoBusqueda) campoBusqueda.addEventListener("input", aplicarFiltrosYRenderizar);
  if (selectEstado) selectEstado.addEventListener("change", aplicarFiltrosYRenderizar);
  $("btnExportarAsistencia").addEventListener("click", exportar);

  cargarAreas().then(cargarTodo);

  // Refresco automático cada minuto: un turno sin marcar pasa a "Ausente" cuando termina.
  setInterval(function () {
    if (document.visibilityState === "visible" && !document.querySelector(".modal.show")) cargarTodo();
  }, 60000);
});
