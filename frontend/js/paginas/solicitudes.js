/* =========================================================
   paginas/solicitudes.js — Solicitudes de personal (solicitudes.html)
   -----------------------------------------------------------
   - Todos pueden crear solicitudes (permiso, vacaciones,
     incapacidad) y ver las suyas.
   - Gestores (Administrador, Supervisor, RRHH) ven todas y las
     aprueban o rechazan; al rechazar deben escribir el motivo.
     Nadie responde sus propias solicitudes y un Supervisor solo
     las de su área (el backend lo valida también).
   - Un gestor puede radicar una solicitud a nombre de otro
     empleado (por ejemplo, una incapacidad).
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const cuerpoTabla = document.getElementById("cuerpoTablaSolicitudes");
  if (!cuerpoTabla) return;

  const sesion = exigirSesion();
  if (!sesion) return;

  const verTodas = esGestor(sesion);
  const COLUMNAS = 8;
  const hoy = fechaLocalISO();
  const $ = function (id) { return document.getElementById(id); };

  const ESTADOS_SOLICITUD_INFO = {
    pendiente: { etiqueta: "Pendiente", clase: "badge-estado-pendiente" },
    aprobada: { etiqueta: "Aprobada", clase: "badge-estado-confirmado" },
    rechazada: { etiqueta: "Rechazada", clase: "badge-estado-cancelado" },
  };

  const selectEstado = $("filtroEstadoSolicitud");
  const selectTipoFiltro = $("filtroTipoSolicitud");
  const campoBusqueda = $("buscarEmpleadoSolicitud");
  const selectTipo = $("solicitudTipo");
  const selectEmpleado = $("solicitudEmpleado");
  const campoInicio = $("solicitudFechaInicio");
  const campoFin = $("solicitudFechaFin");
  const campoMotivo = $("solicitudMotivo");
  const formNuevaSolicitud = $("formNuevaSolicitud");
  const elementoModal = $("modalNuevaSolicitud");
  const mensajeError = $("mensajeModalSolicitud");

  let solicitudes = [];
  let tipos = [];

  if (!verTodas) {
    $("tituloSolicitudes").textContent = "Mis solicitudes";
    $("subtituloSolicitudes").textContent = "Solicita permisos, vacaciones o reporta incapacidades, y consulta su respuesta.";
    document.querySelectorAll("[data-solo-gestor]").forEach(function (el) { el.classList.add("d-none"); });
  } else if (selectEstado) {
    selectEstado.value = "pendiente"; // lo que requiere acción, primero
  }

  // ---------- Permisos por fila ----------
  function puedeResponder(solicitud) {
    if (!verTodas || solicitud.estado !== "pendiente") return false;
    if (solicitud.id_usuario === sesion.id_usuario) return false;
    if (sesion.nombre_rol === ROLES.SUPERVISOR && solicitud.id_area !== sesion.id_area) return false;
    return true;
  }

  // ---------- Carga ----------
  async function cargarCatalogos() {
    try {
      tipos = await catalogoService.obtenerTiposSolicitud();
      llenarSelect(selectTipo, tipos, function (t) { return t.id_tipo; }, function (t) { return t.nombre_tipo; });
      llenarSelect(selectTipoFiltro, tipos, function (t) { return t.id_tipo; }, function (t) { return t.nombre_tipo; });

      if (verTodas && selectEmpleado) {
        const empleados = await usuarioService.obtenerTodos({ estado: "activo" });
        llenarSelect(selectEmpleado, empleados.filter(function (u) { return u.id_usuario !== sesion.id_usuario; }),
          function (u) { return u.id_usuario; }, function (u) { return u.nombre_completo; });
      }
    } catch (error) {
      mostrarNotificacion("No se pudieron cargar los catálogos: " + error.message, "danger");
    }
  }

  async function cargarSolicitudes() {
    filaMensaje(cuerpoTabla, COLUMNAS, "Cargando solicitudes...");
    try {
      solicitudes = await solicitudService.obtenerTodas();
      aplicarFiltrosYRenderizar();
    } catch (error) {
      filaMensaje(cuerpoTabla, COLUMNAS, error.message || "No se pudieron cargar las solicitudes.", "text-danger");
    }
  }

  function aplicarFiltrosYRenderizar() {
    const estado = selectEstado ? selectEstado.value : "todas";
    const tipo = selectTipoFiltro ? selectTipoFiltro.value : "todos";
    const texto = campoBusqueda ? campoBusqueda.value.trim().toLowerCase() : "";

    const conteo = { pendiente: 0, aprobada: 0, rechazada: 0 };
    solicitudes.forEach(function (s) { conteo[s.estado] += 1; });
    $("contadorPendientes").textContent = conteo.pendiente;
    $("contadorAprobadas").textContent = conteo.aprobada;
    $("contadorRechazadas").textContent = conteo.rechazada;

    const filtradas = solicitudes.filter(function (s) {
      return (estado === "todas" || s.estado === estado) &&
        (tipo === "todos" || String(s.id_tipo) === tipo) &&
        ((s.nombre_usuario || "").toLowerCase().includes(texto) || (s.motivo || "").toLowerCase().includes(texto));
    });

    renderizarSolicitudes(filtradas);
    $("avisoSinSolicitudes").classList.toggle("d-none", solicitudes.length > 0);
  }

  function renderizarSolicitudes(lista) {
    cuerpoTabla.innerHTML = "";
    if (lista.length === 0) {
      filaMensaje(cuerpoTabla, COLUMNAS, solicitudes.length ? "No hay solicitudes con los filtros seleccionados." : "No hay solicitudes registradas.");
      return;
    }

    lista.forEach(function (s) {
      const info = ESTADOS_SOLICITUD_INFO[s.estado] || ESTADOS_SOLICITUD_INFO.pendiente;
      const fila = document.createElement("tr");
      const respuesta = s.estado === "pendiente"
        ? '<span class="text-muted small">Radicada el ' + formatearFechaHora(s.fecha_creacion) + "</span>"
        : '<div class="small"><strong>' + escaparHtml(s.nombre_aprobador || "—") + "</strong> · " + formatearFechaHora(s.fecha_respuesta) + "</div>" +
          (s.observacion_resp ? '<div class="small text-muted">' + escaparHtml(s.observacion_resp) + "</div>" : "");

      fila.innerHTML =
        '<td><span class="fw-semibold">' + escaparHtml(s.nombre_usuario) + "</span>" +
        (s.nombre_area ? '<div class="small text-muted">' + escaparHtml(s.nombre_area) + "</div>" : "") + "</td>" +
        "<td>" + escaparHtml(s.nombre_tipo) + "</td>" +
        '<td class="text-nowrap">' + formatearFecha(s.fecha_inicio) + "<br>" + formatearFecha(s.fecha_fin) + "</td>" +
        '<td class="text-center">' + escaparHtml(s.dias) + "</td>" +
        '<td class="celda-motivo">' + escaparHtml(s.motivo) + "</td>" +
        '<td><span class="badge badge-estado ' + info.clase + '">' + info.etiqueta + "</span></td>" +
        "<td>" + respuesta + "</td>" +
        '<td class="acciones-turno"></td>';

      const celda = fila.querySelector(".acciones-turno");
      if (puedeResponder(s)) {
        const botonAprobar = document.createElement("button");
        botonAprobar.type = "button";
        botonAprobar.className = "btn btn-sm btn-success me-2";
        botonAprobar.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i> Aprobar';
        botonAprobar.setAttribute("aria-label", "Aprobar solicitud de " + s.nombre_usuario);
        botonAprobar.addEventListener("click", function () { responder(s, "aprobar"); });

        const botonRechazar = document.createElement("button");
        botonRechazar.type = "button";
        botonRechazar.className = "btn btn-sm btn-outline-danger";
        botonRechazar.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i> Rechazar';
        botonRechazar.setAttribute("aria-label", "Rechazar solicitud de " + s.nombre_usuario);
        botonRechazar.addEventListener("click", function () { responder(s, "rechazar"); });

        celda.appendChild(botonAprobar);
        celda.appendChild(botonRechazar);
      } else {
        const texto = document.createElement("span");
        texto.className = "text-muted small";
        if (s.estado !== "pendiente") texto.textContent = "Resuelta";
        else if (s.id_usuario === sesion.id_usuario) texto.textContent = "En revisión";
        else texto.textContent = "Otra área";
        celda.appendChild(texto);
      }

      cuerpoTabla.appendChild(fila);
    });
  }

  async function responder(solicitud, accion) {
    const aprobar = accion === "aprobar";
    const detalle = solicitud.nombre_tipo + " de " + solicitud.nombre_usuario + " del " + formatearFecha(solicitud.fecha_inicio) +
      " al " + formatearFecha(solicitud.fecha_fin) + " (" + solicitud.dias + (Number(solicitud.dias) === 1 ? " día" : " días") + ").";

    const respuesta = await confirmarAccion({
      titulo: aprobar ? "Aprobar solicitud" : "Rechazar solicitud",
      mensaje: detalle + (aprobar ? " Los turnos de esas fechas quedarán como justificados." : ""),
      textoBoton: aprobar ? "Aprobar" : "Rechazar",
      claseBoton: aprobar ? "btn-success" : "btn-danger",
      campoTexto: aprobar
        ? { etiqueta: "Observación (opcional)", placeholder: "Ej.: Aprobado según calendario del área" }
        : { etiqueta: "Motivo del rechazo (obligatorio)", requerido: true, minimo: 5, placeholder: "Explique al empleado por qué se rechaza" },
    });
    if (!respuesta.confirmado) return;

    try {
      if (aprobar) await solicitudService.aprobar(solicitud.id_solicitud, respuesta.texto);
      else await solicitudService.rechazar(solicitud.id_solicitud, respuesta.texto);
      mostrarNotificacion("Solicitud " + (aprobar ? "aprobada" : "rechazada") + " correctamente.");
      await cargarSolicitudes();
    } catch (error) {
      mostrarNotificacion(error.message || "No se pudo procesar la solicitud.", "danger");
    }
  }

  // ---------- Nueva solicitud ----------
  function tipoSeleccionadoEsIncapacidad() {
    const tipo = tipos.find(function (t) { return String(t.id_tipo) === selectTipo.value; });
    return Boolean(tipo) && tipo.nombre_tipo.toLowerCase() === "incapacidad";
  }

  function actualizarLimitesYDias() {
    // Las incapacidades se pueden reportar hasta 30 días después; lo demás, desde hoy.
    const minimo = tipoSeleccionadoEsIncapacidad() ? sumarDiasISO(hoy, -30) : hoy;
    campoInicio.setAttribute("min", minimo);
    campoFin.setAttribute("min", campoInicio.value || minimo);

    const salida = $("diasSolicitud");
    if (campoInicio.value && campoFin.value && campoFin.value >= campoInicio.value) {
      const inicio = campoInicio.value.split("-").map(Number);
      const fin = campoFin.value.split("-").map(Number);
      const dias = Math.round((new Date(fin[0], fin[1] - 1, fin[2]) - new Date(inicio[0], inicio[1] - 1, inicio[2])) / 86400000) + 1;
      salida.textContent = dias + (dias === 1 ? " día solicitado" : " días solicitados");
    } else {
      salida.textContent = "";
    }
  }

  function mostrarError(texto) {
    mensajeError.textContent = texto;
    mensajeError.classList.remove("d-none");
    mensajeError.focus();
  }

  if (formNuevaSolicitud) {
    elementoModal.addEventListener("show.bs.modal", function () {
      formNuevaSolicitud.reset();
      mensajeError.classList.add("d-none");
      $("contadorMotivo").textContent = "0/500";
      actualizarLimitesYDias();
    });

    [selectTipo, campoInicio, campoFin].forEach(function (campo) { campo.addEventListener("change", actualizarLimitesYDias); });
    campoMotivo.addEventListener("input", function () {
      $("contadorMotivo").textContent = campoMotivo.value.length + "/500";
    });

    formNuevaSolicitud.addEventListener("submit", async function (evento) {
      evento.preventDefault();

      const datos = {
        id_tipo: selectTipo.value,
        fecha_inicio: campoInicio.value,
        fecha_fin: campoFin.value,
        motivo: campoMotivo.value.trim(),
      };
      if (verTodas && selectEmpleado && selectEmpleado.value) datos.id_usuario = selectEmpleado.value;

      if (!datos.id_tipo || !datos.fecha_inicio || !datos.fecha_fin || !datos.motivo) return mostrarError("Complete todos los campos para crear la solicitud.");
      if (datos.fecha_fin < datos.fecha_inicio) return mostrarError("La fecha 'hasta' no puede ser anterior a la fecha 'desde'.");
      if (!tipoSeleccionadoEsIncapacidad() && datos.fecha_inicio < hoy) return mostrarError("Solo las incapacidades pueden iniciar en una fecha pasada.");
      if (datos.motivo.length < 10) return mostrarError("Describa el motivo con al menos 10 caracteres.");

      mensajeError.classList.add("d-none");
      const boton = $("btnGuardarSolicitud");
      boton.disabled = true;

      try {
        await solicitudService.crear(datos);
        bootstrap.Modal.getOrCreateInstance(elementoModal).hide();
        if (selectEstado && verTodas) selectEstado.value = "pendiente";
        await cargarSolicitudes();
        mostrarNotificacion("Solicitud enviada correctamente. Quedó pendiente de aprobación.");
      } catch (error) {
        mostrarError(error.message || "No se pudo crear la solicitud.");
      } finally {
        boton.disabled = false;
      }
    });
  }

  [selectEstado, selectTipoFiltro].forEach(function (s) { if (s) s.addEventListener("change", aplicarFiltrosYRenderizar); });
  if (campoBusqueda) campoBusqueda.addEventListener("input", aplicarFiltrosYRenderizar);

  cargarCatalogos().then(cargarSolicitudes);
});
