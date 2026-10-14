/* =========================================================
   paginas/dashboard.js — Inicio (index.html)
   -----------------------------------------------------------
   Sin sesión muestra la presentación del sistema. Con sesión
   pinta el resumen EN VIVO del día desde GET /api/reportes/
   resumen: turnos de hoy por estado, solicitudes pendientes y
   tardanzas del mes. Un Empleado ve solo sus propios números.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const panel = document.getElementById("panelResumen");
  if (!panel) return;

  const sesion = obtenerSesion();
  if (!sesion) return;

  const esDeGestion = esGestor(sesion);
  const $ = function (id) { return document.getElementById(id); };
  const poner = function (id, valor) { if ($(id)) $(id).textContent = valor; };

  // Encabezado personalizado y accesos rápidos según el rol.
  poner("tituloBienvenida", "Hola, " + sesion.nombre_completo.split(" ")[0]);
  poner("subtituloBienvenida", esDeGestion
    ? "Este es el estado de la operación de hoy, " + formatearFecha(fechaLocalISO()) + "."
    : "Este es tu resumen de hoy, " + formatearFecha(fechaLocalISO()) + ".");

  const accesos = [
    { texto: "Marcar asistencia", href: "asistencia.html", icono: "bi-clock-history", visible: true },
    { texto: "Asignar turnos", href: "turnos.html", icono: "bi-calendar-plus", visible: tieneRol(sesion, ROLES_PLANIFICAN_TURNOS) },
    { texto: esDeGestion ? "Revisar solicitudes" : "Nueva solicitud", href: "solicitudes.html", icono: "bi-clipboard-check", visible: true },
    { texto: "Gestionar usuarios", href: "usuarios.html", icono: "bi-people", visible: tieneRol(sesion, ROLES_ADMINISTRAN_USUARIOS) },
    { texto: tieneRol(sesion, ROLES_ADMINISTRAN_USUARIOS) ? "Liquidar nómina" : "Mis desprendibles", href: "nomina.html", icono: "bi-cash-coin", visible: true },
    { texto: "Ver reportes", href: "reportes.html", icono: "bi-bar-chart-line", visible: esDeGestion },
  ];
  const contenedorAccesos = $("accesosRapidos");
  if (contenedorAccesos) {
    contenedorAccesos.innerHTML = accesos
      .filter(function (a) { return a.visible; })
      .map(function (a, i) {
        return '<a class="btn ' + (i === 0 ? "btn-primary" : "btn-outline-primary") + '" href="' + a.href + '">' +
          '<i class="bi ' + a.icono + ' me-1" aria-hidden="true"></i>' + escaparHtml(a.texto) + "</a>";
      })
      .join("");
  }

  document.querySelectorAll("[data-solo-gestor]").forEach(function (el) { el.classList.toggle("d-none", !esDeGestion); });
  document.querySelectorAll("[data-solo-empleado]").forEach(function (el) { el.classList.toggle("d-none", esDeGestion); });

  async function cargarResumen() {
    try {
      const resumen = await reporteService.obtenerResumen();
      const e = resumen.turnos_hoy.por_estado;
      const presentes = e.completo;
      const novedades = e.tardanza + e.salida_anticipada;
      const total = resumen.turnos_hoy.total;

      poner("heroTotalTurnos", total);
      poner("heroPresentes", presentes);
      poner("heroNovedades", novedades);
      poner("heroPendientes", e.pendiente);
      poner("heroAusentes", e.ausente);
      poner("heroJustificados", e.justificado);
      poner("heroEnTurno", resumen.turnos_hoy.en_turno);

      poner("statPresentes", presentes);
      poner("statPendientes", e.pendiente);
      poner("statNovedades", novedades);
      poner("statAusentes", e.ausente);
      poner("statSolicitudesPendientes", resumen.solicitudes_pendientes);
      poner("statEmpleadosActivos", resumen.empleados_activos);
      poner("statTardanzasMes", resumen.tardanzas_mes);
      poner("statMinutosTardanzaMes", resumen.minutos_tardanza_mes + " min");
      poner("statCuentasBloqueadas", resumen.cuentas_bloqueadas);

      const alertaBloqueadas = $("alertaCuentasBloqueadas");
      if (alertaBloqueadas) {
        alertaBloqueadas.classList.toggle("d-none", !(resumen.cuentas_bloqueadas > 0 && tieneRol(sesion, ROLES_ADMINISTRAN_USUARIOS)));
      }

      // Gráfico de torta con conic-gradient (sin librerías externas).
      const grafico = $("heroPieChart");
      if (grafico) {
        const segmentos = [
          { valor: presentes, color: "var(--pm-success)" },
          { valor: novedades, color: "var(--pm-warning)" },
          { valor: e.ausente, color: "var(--pm-danger)" },
          { valor: e.justificado, color: "var(--pm-info)" },
          { valor: e.pendiente, color: "var(--pm-neutral)" },
        ];
        if (total === 0) {
          grafico.style.background = "var(--pm-neutral)";
        } else {
          let inicio = 0;
          grafico.style.background = "conic-gradient(" + segmentos.map(function (s) {
            const fin = inicio + (s.valor / total) * 360;
            const tramo = s.color + " " + inicio + "deg " + fin + "deg";
            inicio = fin;
            return tramo;
          }).join(", ") + ")";
        }
        grafico.setAttribute("aria-label",
          "Turnos de hoy: " + presentes + " presentes, " + novedades + " con novedad, " + e.ausente + " ausentes, " +
          e.justificado + " justificados y " + e.pendiente + " sin marcar.");
      }

      poner("ultimaActualizacion", "Actualizado a las " + formatearHoraDeTimestamp(new Date()));
    } catch (error) {
      mostrarNotificacion(error.message || "No se pudo cargar el resumen.", "danger");
    }
  }

  cargarResumen();
  // Se refresca solo cada minuto mientras la pestaña esté visible.
  setInterval(function () {
    if (document.visibilityState === "visible") cargarResumen();
  }, 60000);
});
