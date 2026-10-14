/* =========================================================
   paginas/reportes.js — Reportes (reportes.html)
   -----------------------------------------------------------
   Gestores: consolidado de asistencia por empleado en un rango
   de fechas (turnos, asistidos, tardanzas, ausencias, horas
   programadas vs. trabajadas, % de cumplimiento), exportable a
   CSV. El Administrador ve además la bitácora de auditoría.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const cuerpoTabla = document.getElementById("cuerpoTablaReporte");
  if (!cuerpoTabla) return;

  const sesion = exigirSesion(ROLES_GESTORES);
  if (!sesion) return;

  const COLUMNAS = 10;
  const hoy = fechaLocalISO();
  const $ = function (id) { return document.getElementById(id); };
  const campoDesde = $("repDesde");
  const campoHasta = $("repHasta");
  const selectArea = $("repArea");

  let datosReporte = null;
  let registrosAuditoria = [];

  campoDesde.value = hoy.slice(0, 8) + "01";
  campoHasta.value = hoy;

  function claseCumplimiento(porcentaje) {
    if (porcentaje === null) return "bg-secondary";
    if (porcentaje >= 90) return "bg-success";
    if (porcentaje >= 75) return "bg-warning";
    return "bg-danger";
  }

  function barraCumplimiento(porcentaje) {
    if (porcentaje === null) return '<span class="text-muted small">Sin turnos exigibles</span>';
    return '<div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1 barra-cumplimiento" role="progressbar" aria-label="Cumplimiento" aria-valuenow="' +
      porcentaje + '" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar ' + claseCumplimiento(porcentaje) + '" style="width: ' + porcentaje + '%"></div></div>' +
      '<span class="small fw-semibold">' + porcentaje + "%</span></div>";
  }

  async function cargarReporte() {
    if (campoDesde.value && campoHasta.value && campoHasta.value < campoDesde.value) {
      mostrarNotificacion("La fecha final no puede ser anterior a la inicial.", "warning");
      return;
    }
    filaMensaje(cuerpoTabla, COLUMNAS, "Generando reporte...");
    try {
      datosReporte = await reporteService.obtenerAsistenciaPorEmpleado({
        desde: campoDesde.value,
        hasta: campoHasta.value,
        id_area: selectArea.value === "todas" ? "" : selectArea.value,
      });
      renderizarReporte();
    } catch (error) {
      filaMensaje(cuerpoTabla, COLUMNAS, error.message || "No se pudo generar el reporte.", "text-danger");
    }
  }

  function renderizarReporte() {
    const t = datosReporte.totales;
    $("periodoReporte").textContent = "Del " + formatearFecha(datosReporte.desde) + " al " + formatearFecha(datosReporte.hasta);
    $("kpiTurnos").textContent = t.turnos;
    $("kpiAsistencia").textContent = t.porcentaje_asistencia === null ? "—" : t.porcentaje_asistencia + "%";
    $("kpiTardanzas").textContent = t.tardanzas;
    $("kpiMinutos").textContent = t.minutos_tardanza + " min";
    $("kpiAusencias").textContent = t.ausencias;
    $("kpiJustificados").textContent = t.justificados;
    $("kpiHoras").textContent = t.horas_trabajadas + " / " + t.horas_programadas + " h";

    cuerpoTabla.innerHTML = "";
    if (!datosReporte.empleados.length) {
      filaMensaje(cuerpoTabla, COLUMNAS, "No hay turnos programados en este periodo.");
      return;
    }
    datosReporte.empleados.forEach(function (e) {
      const fila = document.createElement("tr");
      fila.innerHTML =
        '<td><span class="fw-semibold">' + escaparHtml(e.nombre_usuario) + '</span><div class="small text-muted">' + escaparHtml(e.areas || "—") + "</div></td>" +
        '<td class="text-center">' + e.turnos + "</td>" +
        '<td class="text-center">' + e.asistidos + "</td>" +
        '<td class="text-center">' + (e.tardanzas ? '<span class="text-warning-emphasis fw-semibold">' + e.tardanzas + "</span>" : 0) + "</td>" +
        '<td class="text-center">' + e.minutos_tardanza + "</td>" +
        '<td class="text-center">' + (e.ausencias ? '<span class="text-danger fw-semibold">' + e.ausencias + "</span>" : 0) + "</td>" +
        '<td class="text-center">' + e.justificados + "</td>" +
        '<td class="text-center">' + e.horas_programadas + "</td>" +
        '<td class="text-center">' + e.horas_trabajadas + "</td>" +
        '<td style="min-width: 160px;">' + barraCumplimiento(e.porcentaje_asistencia) + "</td>";
      cuerpoTabla.appendChild(fila);
    });
  }

  function exportarReporte() {
    if (!datosReporte || !datosReporte.empleados.length) {
      mostrarNotificacion("Genere un reporte con datos antes de exportar.", "warning");
      return;
    }
    exportarCSV("reporte_asistencia_" + datosReporte.desde + "_a_" + datosReporte.hasta + ".csv", [
      { titulo: "Empleado", valor: function (e) { return e.nombre_usuario; } },
      { titulo: "Documento", valor: function (e) { return e.numero_documento; } },
      { titulo: "Área(s)", valor: function (e) { return e.areas; } },
      { titulo: "Turnos", valor: function (e) { return e.turnos; } },
      { titulo: "Asistidos", valor: function (e) { return e.asistidos; } },
      { titulo: "Tardanzas", valor: function (e) { return e.tardanzas; } },
      { titulo: "Minutos de tardanza", valor: function (e) { return e.minutos_tardanza; } },
      { titulo: "Salidas anticipadas", valor: function (e) { return e.salidas_anticipadas; } },
      { titulo: "Ausencias", valor: function (e) { return e.ausencias; } },
      { titulo: "Justificados", valor: function (e) { return e.justificados; } },
      { titulo: "Pendientes", valor: function (e) { return e.pendientes; } },
      { titulo: "Horas programadas", valor: function (e) { return String(e.horas_programadas).replace(".", ","); } },
      { titulo: "Horas trabajadas", valor: function (e) { return String(e.horas_trabajadas).replace(".", ","); } },
      { titulo: "% Asistencia", valor: function (e) { return e.porcentaje_asistencia === null ? "" : e.porcentaje_asistencia; } },
    ], datosReporte.empleados);
  }

  // ---------- Auditoría (solo Administrador) ----------
  const esAdmin = sesion.nombre_rol === ROLES.ADMIN;
  const cuerpoAuditoria = $("cuerpoTablaAuditoria");

  async function cargarAuditoria() {
    if (!esAdmin || !cuerpoAuditoria) return;
    filaMensaje(cuerpoAuditoria, 5, "Cargando bitácora...");
    try {
      registrosAuditoria = await reporteService.obtenerAuditoria({
        accion: $("filtroAccionAuditoria").value === "todas" ? "" : $("filtroAccionAuditoria").value,
        limite: $("limiteAuditoria").value,
      });
      cuerpoAuditoria.innerHTML = "";
      if (!registrosAuditoria.length) {
        filaMensaje(cuerpoAuditoria, 5, "No hay registros de auditoría.");
        return;
      }
      registrosAuditoria.forEach(function (a) {
        const fila = document.createElement("tr");
        fila.innerHTML =
          '<td class="text-nowrap">' + formatearFechaHora(a.fecha_accion) + "</td>" +
          "<td>" + escaparHtml(a.nombre_usuario || "Sistema") + "</td>" +
          '<td><span class="badge text-bg-light border">' + escaparHtml(a.accion) + "</span></td>" +
          '<td class="small text-muted">' + escaparHtml(a.tabla_afectada || "") + (a.id_registro ? " #" + escaparHtml(a.id_registro) : "") + "</td>" +
          "<td>" + escaparHtml(a.detalle || "") + "</td>";
        cuerpoAuditoria.appendChild(fila);
      });
    } catch (error) {
      filaMensaje(cuerpoAuditoria, 5, error.message, "text-danger");
    }
  }

  async function cargarAccionesAuditoria() {
    if (!esAdmin) return;
    try {
      const acciones = await reporteService.obtenerAccionesAuditoria();
      llenarSelect($("filtroAccionAuditoria"), acciones, function (a) { return a; }, function (a) { return a; });
    } catch (error) {
      mostrarNotificacion("No se pudieron cargar las acciones de auditoría: " + error.message, "danger");
    }
  }

  // ---------- Eventos ----------
  document.querySelectorAll("[data-periodo]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      const periodo = boton.dataset.periodo;
      if (periodo === "mes") {
        campoDesde.value = hoy.slice(0, 8) + "01";
        campoHasta.value = hoy;
      } else if (periodo === "mes-anterior") {
        const primeroEsteMes = hoy.slice(0, 8) + "01";
        const ultimoMesAnterior = sumarDiasISO(primeroEsteMes, -1);
        campoDesde.value = ultimoMesAnterior.slice(0, 8) + "01";
        campoHasta.value = ultimoMesAnterior;
      } else if (periodo === "7") {
        campoDesde.value = sumarDiasISO(hoy, -6);
        campoHasta.value = hoy;
      } else if (periodo === "proximos") {
        campoDesde.value = hoy;
        campoHasta.value = sumarDiasISO(hoy, 30);
      }
      cargarReporte();
    });
  });
  [campoDesde, campoHasta, selectArea].forEach(function (c) { c.addEventListener("change", cargarReporte); });
  $("btnExportarReporte").addEventListener("click", exportarReporte);

  if (esAdmin) {
    $("filtroAccionAuditoria").addEventListener("change", cargarAuditoria);
    $("limiteAuditoria").addEventListener("change", cargarAuditoria);
    $("btnExportarAuditoria").addEventListener("click", function () {
      if (!registrosAuditoria.length) return;
      exportarCSV("auditoria_" + hoy + ".csv", [
        { titulo: "Fecha", valor: function (a) { return formatearFechaHora(a.fecha_accion); } },
        { titulo: "Usuario", valor: function (a) { return a.nombre_usuario || "Sistema"; } },
        { titulo: "Acción", valor: function (a) { return a.accion; } },
        { titulo: "Tabla", valor: function (a) { return a.tabla_afectada; } },
        { titulo: "Id registro", valor: function (a) { return a.id_registro; } },
        { titulo: "Detalle", valor: function (a) { return a.detalle; } },
      ], registrosAuditoria);
    });
  }

  catalogoService.obtenerAreas()
    .then(function (areas) {
      llenarSelect(selectArea, areas, function (a) { return a.id_area; }, function (a) { return a.nombre_area; });
    })
    .catch(function (error) { mostrarNotificacion("No se pudieron cargar las áreas: " + error.message, "danger"); })
    .then(cargarReporte);

  cargarAccionesAuditoria().then(cargarAuditoria);
});
