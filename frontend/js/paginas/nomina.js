/* =========================================================
   paginas/nomina.js — Nómina (nomina.html)
   -----------------------------------------------------------
   - Administrador / RRHH: liquidan el mes a partir de la
     asistencia real (vista previa -> guardar -> ajustar ->
     aprobar -> pagar) y ven el desprendible de cada empleado.
   - Todos: sección "Mis desprendibles" con sus nóminas
     aprobadas o pagadas.
   El valor en pesos lo calcula la base de datos (columna
   generada pm.nomina.total_pagar); aquí solo se muestra.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const cuerpoMias = document.getElementById("cuerpoMisDesprendibles");
  if (!cuerpoMias) return;

  const sesion = exigirSesion();
  if (!sesion) return;

  const gestiona = tieneRol(sesion, ROLES_ADMINISTRAN_USUARIOS);
  const $ = function (id) { return document.getElementById(id); };
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const ESTADOS_NOMINA = {
    calculada: { etiqueta: "Calculada", clase: "badge-estado-pendiente" },
    aprobada: { etiqueta: "Aprobada", clase: "badge-asistencia-justificado" },
    pagada: { etiqueta: "Pagada", clase: "badge-estado-confirmado" },
  };

  let liquidacion = null;

  function badgeEstadoNomina(estado) {
    if (!estado) return '<span class="badge badge-estado badge-asistencia-sinmarcar">Sin guardar</span>';
    const info = ESTADOS_NOMINA[estado];
    return '<span class="badge badge-estado ' + info.clase + '">' + info.etiqueta + "</span>";
  }

  // ======================================================
  // Desprendible (lo usan gestores y empleados)
  // ======================================================
  async function abrirDesprendible(idNomina) {
    const contenedor = $("contenidoDesprendible");
    contenedor.innerHTML = '<p class="text-muted">Cargando desprendible...</p>';
    bootstrap.Modal.getOrCreateInstance($("modalDesprendible")).show();

    try {
      const d = await nominaService.obtenerDetalle(idNomina);
      const n = d.nomina;
      const t = d.tarifas;
      const fila = function (concepto, cantidad, valorUnitario, total, clase) {
        return "<tr" + (clase ? ' class="' + clase + '"' : "") + "><td>" + concepto + '</td><td class="text-end">' + cantidad +
          '</td><td class="text-end">' + valorUnitario + '</td><td class="text-end">' + total + "</td></tr>";
      };

      const detalleTurnos = d.calculo.detalle.map(function (x) {
        return "<tr><td>" + formatearFecha(x.fecha) + (x.festivo ? ' <span class="badge text-bg-warning">D/F</span>' : "") + "</td>" +
          "<td>" + escaparHtml(x.horario) + "</td>" +
          '<td class="text-end">' + formatearNumero(x.min_ordinarios / 60) + "</td>" +
          '<td class="text-end">' + formatearNumero((x.min_extra_diurnos + x.min_extra_nocturnos) / 60) + "</td>" +
          '<td class="small">' + escaparHtml(x.nota) + (x.alerta ? '<div class="text-danger">' + escaparHtml(x.alerta) + "</div>" : "") + "</td></tr>";
      }).join("");

      contenedor.innerHTML =
        '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">' +
        '<div><h3 class="h5 mb-1">Desprendible de pago</h3><div class="text-muted">PeopleManager · ' + escaparHtml(d.periodo.nombre) + "</div></div>" +
        "<div>" + badgeEstadoNomina(n.estado) + "</div></div>" +
        '<div class="row g-2 mb-3 small">' +
        '<div class="col-sm-6"><strong>Empleado:</strong> ' + escaparHtml(n.nombre_usuario) + "</div>" +
        '<div class="col-sm-6"><strong>Documento:</strong> ' + escaparHtml(n.numero_documento) + "</div>" +
        '<div class="col-sm-6"><strong>Cargo:</strong> ' + escaparHtml(n.nombre_cargo || "—") + "</div>" +
        '<div class="col-sm-6"><strong>Área:</strong> ' + escaparHtml(n.nombre_area || "—") + "</div>" +
        '<div class="col-sm-6"><strong>Periodo:</strong> ' + formatearFecha(d.periodo.desde, false) + " a " + formatearFecha(d.periodo.hasta, false) + "</div>" +
        '<div class="col-sm-6"><strong>Calculada el:</strong> ' + formatearFechaHora(n.fecha_calculo) + "</div></div>" +
        (d.coincide_con_asistencia ? "" :
          '<div class="alert alert-warning small py-2">Los valores guardados no coinciden con la asistencia registrada hoy (la nómina se registró manualmente o la asistencia cambió después del cálculo).</div>') +
        '<div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Concepto</th><th class="text-end">Cantidad</th><th class="text-end">Valor unitario</th><th class="text-end">Total</th></tr></thead><tbody>' +
        fila("Horas ordinarias", formatearNumero(n.horas_ordinarias) + " h", formatearMoneda(t.ordinaria), formatearMoneda(n.horas_ordinarias * t.ordinaria)) +
        fila("Horas extra diurnas", formatearNumero(n.horas_extra_diurna) + " h", formatearMoneda(t.extraDiurna), formatearMoneda(n.horas_extra_diurna * t.extraDiurna)) +
        fila("Horas extra nocturnas", formatearNumero(n.horas_extra_noct) + " h", formatearMoneda(t.extraNocturna), formatearMoneda(n.horas_extra_noct * t.extraNocturna)) +
        fila("Recargo dominical / festivo", formatearNumero(d.calculo.horas_en_festivo) + " h", "—", formatearMoneda(n.recargo_festivo)) +
        fila("Bonificaciones", "", "", formatearMoneda(n.bonificaciones)) +
        fila("Descuentos", "", "", "− " + formatearMoneda(n.descuentos), "text-danger") +
        '</tbody><tfoot><tr class="fw-bold"><td colspan="3">Total a pagar</td><td class="text-end fs-5">' + formatearMoneda(n.total_pagar) + "</td></tr></tfoot></table></div>" +
        '<h4 class="h6 mt-4">Detalle por turno (según la asistencia registrada)</h4>' +
        '<div class="table-responsive"><table class="table table-sm table-striped align-middle small"><thead><tr><th>Fecha</th><th>Horario</th><th class="text-end">H. ord.</th><th class="text-end">H. extra</th><th>Observación</th></tr></thead><tbody>' +
        (detalleTurnos || '<tr><td colspan="5" class="text-muted">Sin turnos en el periodo.</td></tr>') +
        "</tbody></table></div>" +
        '<p class="small text-muted mb-0">Tarifas por hora definidas en la base de datos. La incapacidad por enfermedad general se paga al 66,67 % (50 % desde el día 91); las vacaciones, completas; los permisos no son remunerados.</p>';
    } catch (error) {
      contenedor.innerHTML = '<div class="alert alert-danger">' + escaparHtml(error.message) + "</div>";
    }
  }

  $("btnImprimirDesprendible").addEventListener("click", function () { window.print(); });

  // ======================================================
  // Mis desprendibles (todos los roles)
  // ======================================================
  async function cargarMisDesprendibles() {
    filaMensaje(cuerpoMias, 5, "Cargando...");
    try {
      const mias = await nominaService.obtenerMias();
      $("avisoSinDesprendibles").classList.toggle("d-none", mias.length > 0);
      cuerpoMias.innerHTML = "";
      if (!mias.length) {
        filaMensaje(cuerpoMias, 5, "Aún no tienes nóminas aprobadas.");
        return;
      }
      mias.forEach(function (n) {
        const fila = document.createElement("tr");
        fila.innerHTML =
          "<td>" + MESES[n.periodo_mes - 1] + " " + n.periodo_anio + "</td>" +
          '<td class="text-end">' + formatearNumero(n.horas_ordinarias + n.horas_extra_diurna + n.horas_extra_noct) + " h</td>" +
          '<td class="text-end fw-semibold">' + formatearMoneda(n.total_pagar) + "</td>" +
          "<td>" + badgeEstadoNomina(n.estado) + "</td>" +
          '<td class="text-end"></td>';
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn btn-sm btn-outline-primary";
        boton.innerHTML = '<i class="bi bi-receipt" aria-hidden="true"></i> Ver desprendible';
        boton.addEventListener("click", function () { abrirDesprendible(n.id_nomina); });
        fila.lastElementChild.appendChild(boton);
        cuerpoMias.appendChild(fila);
      });
    } catch (error) {
      filaMensaje(cuerpoMias, 5, error.message, "text-danger");
    }
  }

  cargarMisDesprendibles();
  if (!gestiona) return;

  // ======================================================
  // Liquidación (Administrador y RRHH)
  // ======================================================
  const selectMes = $("nominaMes");
  const campoAnio = $("nominaAnio");
  const cuerpoTabla = $("cuerpoTablaNomina");
  const COLUMNAS = 10;

  MESES.forEach(function (nombre, i) {
    const opcion = document.createElement("option");
    opcion.value = i + 1;
    opcion.textContent = nombre;
    selectMes.appendChild(opcion);
  });
  // Por defecto, el mes anterior (el último mes cerrado).
  const hoy = new Date();
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  selectMes.value = mesAnterior.getMonth() + 1;
  campoAnio.value = mesAnterior.getFullYear();

  async function cargarLiquidacion() {
    filaMensaje(cuerpoTabla, COLUMNAS, "Calculando a partir de la asistencia...");
    try {
      liquidacion = await nominaService.previsualizar(campoAnio.value, selectMes.value);
      renderizarLiquidacion();
    } catch (error) {
      liquidacion = null;
      filaMensaje(cuerpoTabla, COLUMNAS, error.message, "text-danger");
      ["kpiEmpleados", "kpiHoras", "kpiTotalCalculado", "kpiTotalGuardado"].forEach(function (id) { $(id).textContent = "—"; });
    }
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

  function renderizarLiquidacion() {
    const p = liquidacion.parametros;
    $("textoParametros").textContent =
      "Tarifas por hora de la BD: ordinaria " + formatearMoneda(p.tarifas.ordinaria) + ", extra diurna " + formatearMoneda(p.tarifas.extraDiurna) +
      ", extra nocturna " + formatearMoneda(p.tarifas.extraNocturna) + ". Recargo dominical/festivo: " + p.recargo_dominical_porcentaje +
      " %. Horario nocturno desde las " + p.inicio_nocturno + ".";
    $("alertaMesEnCurso").classList.toggle("d-none", liquidacion.periodo.cerrado);

    $("kpiEmpleados").textContent = liquidacion.empleados.length;
    $("kpiHoras").textContent = formatearNumero(liquidacion.totales.horas) + " h";
    $("kpiTotalCalculado").textContent = formatearMoneda(liquidacion.totales.calculado);
    $("kpiTotalGuardado").textContent = formatearMoneda(liquidacion.totales.guardado);

    cuerpoTabla.innerHTML = "";
    if (!liquidacion.empleados.length) {
      filaMensaje(cuerpoTabla, COLUMNAS, "No hay turnos ni nóminas en " + liquidacion.periodo.nombre + ".");
      return;
    }

    liquidacion.empleados.forEach(function (e) {
      const c = e.calculo;
      const g = e.guardada;
      // Si ya hay nómina guardada se muestran sus valores; si la asistencia cambió, el aviso lo indica.
      const valores = g || c;
      const total = g ? g.total_pagar : c.total_estimado;
      const avisos = [];
      if (e.diferente && g.estado === "calculada") avisos.push("La asistencia cambió: vuelva a guardar para actualizar");
      if (e.diferente && g.estado !== "calculada") avisos.push("Difiere de la asistencia actual");
      if (c.alertas.length) avisos.push(c.alertas.join(" · "));
      if (c.ausencias) avisos.push(c.ausencias + " ausencia(s)");
      if (c.pendientes) avisos.push(c.pendientes + " turno(s) aún sin trabajar");

      const fila = document.createElement("tr");
      fila.innerHTML =
        '<td><span class="fw-semibold">' + escaparHtml(e.nombre_usuario) + '</span><div class="small text-muted">' + escaparHtml(e.nombre_area || "—") + " · " + c.turnos + " turnos</div>" +
        (avisos.length ? '<div class="small text-warning-emphasis"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i> ' + escaparHtml(avisos.join(" · ")) + "</div>" : "") + "</td>" +
        "<td>" + badgeEstadoNomina(g && g.estado) + "</td>" +
        '<td class="text-end">' + formatearNumero(valores.horas_ordinarias) + "</td>" +
        '<td class="text-end">' + formatearNumero(valores.horas_extra_diurna) + "</td>" +
        '<td class="text-end">' + formatearNumero(valores.horas_extra_noct) + "</td>" +
        '<td class="text-end">' + formatearMoneda(valores.recargo_festivo) + "</td>" +
        '<td class="text-end">' + formatearMoneda(valores.bonificaciones) + "</td>" +
        '<td class="text-end">' + formatearMoneda(valores.descuentos) + "</td>" +
        '<td class="text-end fw-semibold">' + formatearMoneda(total) + (g ? "" : '<div class="small text-muted fw-normal">estimado</div>') + "</td>" +
        '<td class="acciones-turno"></td>';

      const grupo = document.createElement("div");
      grupo.className = "d-flex flex-wrap gap-1 justify-content-end";
      const esPropia = e.id_usuario === sesion.id_usuario;
      if (g) {
        grupo.appendChild(crearBoton("Ver", "bi-receipt", "btn-outline-primary", "Ver desprendible de " + e.nombre_usuario, function () { abrirDesprendible(g.id_nomina); }));
        if (!esPropia && g.estado === "calculada") {
          grupo.appendChild(crearBoton("Ajustar", "bi-sliders", "btn-outline-secondary", "Ajustar nómina de " + e.nombre_usuario, function () { abrirAjuste(e); }));
          grupo.appendChild(crearBoton("Aprobar", "bi-check2-circle", "btn-success", "Aprobar nómina de " + e.nombre_usuario, function () { cambiarEstado(e, "aprobar"); }));
        }
        if (!esPropia && g.estado === "aprobada") {
          grupo.appendChild(crearBoton("Pagada", "bi-cash-coin", "btn-primary", "Marcar como pagada la nómina de " + e.nombre_usuario, function () { cambiarEstado(e, "pagar"); }));
        }
        if (esPropia && g.estado !== "pagada") {
          const nota = document.createElement("span");
          nota.className = "small text-muted";
          nota.textContent = "La gestiona otra persona";
          grupo.appendChild(nota);
        }
      } else {
        const nota = document.createElement("span");
        nota.className = "small text-muted";
        nota.textContent = "Guarde la nómina del mes";
        grupo.appendChild(nota);
      }
      fila.querySelector(".acciones-turno").appendChild(grupo);
      cuerpoTabla.appendChild(fila);
    });
  }

  async function guardarNomina() {
    if (!liquidacion) return;
    const bloqueadas = liquidacion.empleados.filter(function (e) { return e.guardada && e.guardada.estado !== "calculada"; }).length;
    const respuesta = await confirmarAccion({
      titulo: "Guardar nómina de " + liquidacion.periodo.nombre,
      mensaje: "Se guardarán (o recalcularán) las nóminas en estado \"Calculada\" con las horas de la asistencia registrada. " +
        (bloqueadas ? bloqueadas + " nómina(s) aprobadas o pagadas no se modificarán. " : "") +
        (liquidacion.periodo.cerrado ? "" : "Atención: el mes aún no termina; los turnos pendientes no suman horas."),
      textoBoton: "Guardar nómina",
    });
    if (!respuesta.confirmado) return;

    const boton = $("btnGuardarNomina");
    boton.disabled = true;
    try {
      const r = await nominaService.calcular(Number(campoAnio.value), Number(selectMes.value));
      mostrarNotificacion(r.mensaje + ".", r.omitidas.length ? "warning" : "success");
      await cargarLiquidacion();
    } catch (error) {
      mostrarNotificacion(error.message, "danger");
    } finally {
      boton.disabled = false;
    }
  }

  async function cambiarEstado(e, accion) {
    const aprobar = accion === "aprobar";
    const respuesta = await confirmarAccion({
      titulo: aprobar ? "Aprobar nómina" : "Registrar pago",
      mensaje: (aprobar
        ? "¿Aprobar la nómina de " + e.nombre_usuario + " por " + formatearMoneda(e.guardada.total_pagar) + "? Después ya no se podrá recalcular ni ajustar, y el empleado podrá ver su desprendible."
        : "¿Confirmar que se pagaron " + formatearMoneda(e.guardada.total_pagar) + " a " + e.nombre_usuario + "?"),
      textoBoton: aprobar ? "Aprobar" : "Marcar como pagada",
      claseBoton: aprobar ? "btn-success" : "btn-primary",
    });
    if (!respuesta.confirmado) return;
    try {
      const r = aprobar ? await nominaService.aprobar(e.guardada.id_nomina) : await nominaService.pagar(e.guardada.id_nomina);
      mostrarNotificacion(r.mensaje + ".");
      await Promise.all([cargarLiquidacion(), cargarMisDesprendibles()]);
    } catch (error) {
      mostrarNotificacion(error.message, "danger");
    }
  }

  // ---------- Ajustes (bonificaciones y descuentos) ----------
  function abrirAjuste(e) {
    $("formAjuste").reset();
    $("mensajeAjuste").classList.add("d-none");
    $("ajusteId").value = e.guardada.id_nomina;
    $("ajusteNombre").textContent = e.nombre_usuario + " — " + liquidacion.periodo.nombre;
    $("ajusteBonificaciones").value = e.guardada.bonificaciones;
    $("ajusteDescuentos").value = e.guardada.descuentos;
    bootstrap.Modal.getOrCreateInstance($("modalAjuste")).show();
  }

  $("formAjuste").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const error = $("mensajeAjuste");
    const bonificaciones = Number($("ajusteBonificaciones").value || 0);
    const descuentos = Number($("ajusteDescuentos").value || 0);
    const motivo = $("ajusteMotivo").value.trim();
    const mostrar = function (texto) { error.textContent = texto; error.classList.remove("d-none"); };

    if (bonificaciones < 0 || descuentos < 0) return mostrar("Los valores no pueden ser negativos.");
    if (motivo.length < 5) return mostrar("Indique el motivo del ajuste (mínimo 5 caracteres).");

    const boton = evento.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      await nominaService.ajustar($("ajusteId").value, bonificaciones, descuentos, motivo);
      bootstrap.Modal.getOrCreateInstance($("modalAjuste")).hide();
      mostrarNotificacion("Ajustes guardados. El total se recalculó.");
      await cargarLiquidacion();
    } catch (err) {
      mostrar(err.message);
    } finally {
      boton.disabled = false;
    }
  });

  function exportar() {
    if (!liquidacion || !liquidacion.empleados.length) {
      mostrarNotificacion("No hay datos para exportar.", "warning");
      return;
    }
    exportarCSV("nomina_" + liquidacion.periodo.anio + "_" + String(liquidacion.periodo.mes).padStart(2, "0") + ".csv", [
      { titulo: "Empleado", valor: function (e) { return e.nombre_usuario; } },
      { titulo: "Área", valor: function (e) { return e.nombre_area; } },
      { titulo: "Estado", valor: function (e) { return e.guardada ? e.guardada.estado : "sin guardar"; } },
      { titulo: "Turnos", valor: function (e) { return e.calculo.turnos; } },
      { titulo: "Ausencias", valor: function (e) { return e.calculo.ausencias; } },
      { titulo: "Horas ordinarias", valor: function (e) { return formatearNumero((e.guardada || e.calculo).horas_ordinarias); } },
      { titulo: "Horas extra diurnas", valor: function (e) { return formatearNumero((e.guardada || e.calculo).horas_extra_diurna); } },
      { titulo: "Horas extra nocturnas", valor: function (e) { return formatearNumero((e.guardada || e.calculo).horas_extra_noct); } },
      { titulo: "Recargo festivo", valor: function (e) { return (e.guardada || e.calculo).recargo_festivo; } },
      { titulo: "Bonificaciones", valor: function (e) { return (e.guardada || e.calculo).bonificaciones; } },
      { titulo: "Descuentos", valor: function (e) { return (e.guardada || e.calculo).descuentos; } },
      { titulo: "Total a pagar", valor: function (e) { return e.guardada ? e.guardada.total_pagar : e.calculo.total_estimado; } },
    ], liquidacion.empleados);
  }

  selectMes.addEventListener("change", cargarLiquidacion);
  campoAnio.addEventListener("change", cargarLiquidacion);
  $("btnGuardarNomina").addEventListener("click", guardarNomina);
  $("btnExportarNomina").addEventListener("click", exportar);

  cargarLiquidacion();
});
