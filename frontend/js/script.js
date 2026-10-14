/* =========================================================
   PeopleManager - script.js
   -----------------------------------------------------------
   Lógica del sistema, ya conectada a la API real (ver
   js/services/*.js) en vez de a Local Storage. Organizada por
   secciones:
     1. Constantes y utilidades generales
     2. Navegación activa
     3. Sesión de usuario (sessionStorage, datos reales del login)
     4. Formulario de inicio de sesión
     5. Módulo de turnos (turnos.html)
     6. Módulo de asistencia (asistencia.html)
     7. Módulo de solicitudes (solicitudes.html)
     8. Dashboard de estadísticas (index.html)
   ========================================================= */

/* =========================================================
   1. Constantes y utilidades generales
   ========================================================= */

const CLAVE_SESION = "pm_sesion";

function inicializarTema() {
  const botonTema = document.getElementById("themeToggle");
  const temaGuardado = localStorage.getItem("pm-theme") || "light";
  aplicarTema(temaGuardado);

  if (botonTema) {
    botonTema.addEventListener("click", function () {
      const temaActual = document.body.dataset.theme === "dark" ? "light" : "dark";
      aplicarTema(temaActual);
    });
  }
}

function aplicarTema(tema) {
  const temaFinal = tema === "dark" ? "dark" : "light";
  document.body.dataset.theme = temaFinal;
  document.documentElement.dataset.theme = temaFinal;
  localStorage.setItem("pm-theme", temaFinal);

  const botonTema = document.getElementById("themeToggle");
  if (botonTema) {
    botonTema.innerHTML = temaFinal === "dark"
      ? '<i class="bi bi-sun-fill"></i> Claro'
      : '<i class="bi bi-moon-fill"></i> Oscuro';
    botonTema.setAttribute("aria-pressed", String(temaFinal === "dark"));
  }

  const mensajeFechaTurno = document.getElementById("mensajeFechaTurno");
  if (mensajeFechaTurno) {
    mensajeFechaTurno.style.color = temaFinal === "dark" ? "#f8fafc" : "";
    mensajeFechaTurno.style.fontWeight = temaFinal === "dark" ? "600" : "";
    mensajeFechaTurno.style.opacity = "1";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  inicializarTema();
  marcarEnlaceActivo();
  inicializarSesionNavbar();
  inicializarLogin();
  inicializarProteccionEnlaces();
  inicializarTurnos();
  inicializarAsistencia();
  inicializarSolicitudes();
  inicializarDashboard();
});

/* =========================================================
   2. Navegación activa
   ========================================================= */

function marcarEnlaceActivo() {
  const paginaActual = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".navbar-nav .nav-link").forEach(function (enlace) {
    if (enlace.getAttribute("href") === paginaActual) {
      enlace.classList.add("active");
      enlace.setAttribute("aria-current", "page");
    }
  });
}

/* =========================================================
   3. Sesión de usuario (sessionStorage)
   -----------------------------------------------------------
   Solo se guarda lo mínimo necesario para identificar al
   usuario en pantalla (id, nombre, correo, rol). La contraseña
   nunca se guarda en el navegador.
   ========================================================= */

function obtenerSesion() {
  try {
    const crudo = sessionStorage.getItem(CLAVE_SESION);
    return crudo ? JSON.parse(crudo) : null;
  } catch (error) {
    return null;
  }
}

function guardarSesion(usuario) {
  sessionStorage.setItem(
    CLAVE_SESION,
    JSON.stringify({
      id_usuario: usuario.id_usuario,
      nombre_completo: usuario.nombre_completo,
      correo: usuario.correo,
      id_rol: usuario.id_rol || null,
      nombre_rol: usuario.nombre_rol || null,
    })
  );
}

function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);
}

/**
 * Ajusta el botón "Iniciar sesión" de la barra de navegación según si hay
 * una sesión guardada: lo convierte en "Cerrar sesión" y muestra un
 * saludo con el nombre, o lo deja como enlace a login.html.
 */
function inicializarSesionNavbar() {
  const botonAuth = document.getElementById("btnAuthAction");
  const itemSaludo = document.getElementById("navSaludoItem");
  const textoSaludo = document.getElementById("saludoUsuario");
  const botonHeroLogin = document.getElementById("btnHeroLogin");
  if (!botonAuth && !botonHeroLogin) return;

  const sesion = obtenerSesion();

  if (sesion) {
    if (botonAuth) {
      botonAuth.textContent = "Cerrar sesión";
      botonAuth.setAttribute("href", "#");
      botonAuth.classList.remove("d-none");
      botonAuth.onclick = function (evento) {
        evento.preventDefault();
        cerrarSesion();
        window.location.href = "index.html";
      };
    }

    if (botonHeroLogin) {
      botonHeroLogin.classList.add("d-none");
    }

    if (itemSaludo && textoSaludo) {
      textoSaludo.textContent = "Hola, " + sesion.nombre_completo;
      itemSaludo.classList.remove("d-none");
    }
  } else {
    if (botonAuth) {
      botonAuth.textContent = "Iniciar sesión";
      botonAuth.setAttribute("href", "login.html");
      botonAuth.classList.remove("d-none");
      botonAuth.onclick = null;
    }

    if (botonHeroLogin) {
      botonHeroLogin.classList.remove("d-none");
    }

    if (itemSaludo) itemSaludo.classList.add("d-none");
  }
}

/**
 * Intercepta los clics en cualquier enlace marcado con [data-protected-link]
 * y, si no hay una sesión guardada, cancela la navegación y redirige a
 * login.html.
 */
function inicializarProteccionEnlaces() {
  const enlacesProtegidos = document.querySelectorAll("[data-protected-link]");
  const alerta = document.getElementById("alertaTurnosNoAuth");

  if (!enlacesProtegidos.length) return;

  enlacesProtegidos.forEach(function (enlace) {
    enlace.addEventListener("click", function (evento) {
      if (obtenerSesion()) {
        return;
      }

      evento.preventDefault();
      if (alerta) {
        alerta.classList.remove("d-none");
        alerta.setAttribute("tabindex", "-1");
        alerta.focus();
      }

      setTimeout(function () {
        window.location.href = "login.html";
      }, 1400);
    });
  });
}

/**
 * Protege una página completa (no solo un enlace): si no hay sesión,
 * redirige de inmediato a login.html. Se usa en turnos.html,
 * asistencia.html y solicitudes.html.
 */
function exigirSesionOEnviarALogin() {
  if (!obtenerSesion()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

/* =========================================================
   4. Formulario de inicio de sesión (login.html)
   ========================================================= */

function inicializarLogin() {
  const formulario = document.getElementById("formLogin");
  if (!formulario) return;

  const campoEmail = document.getElementById("email");
  const campoPassword = document.getElementById("password");
  const botonMostrarPassword = document.getElementById("togglePassword");
  const alertaExito = document.getElementById("loginExito");
  const alertaError = document.getElementById("loginError");

  const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const LONGITUD_MIN_PASSWORD = 6;

  function marcarCampoInvalido(campo, mensaje) {
    campo.classList.add("is-invalid");
    campo.classList.remove("is-valid");
    const feedback = document.getElementById(campo.id + "Feedback");
    if (feedback) feedback.textContent = mensaje;
  }

  function marcarCampoValido(campo) {
    campo.classList.remove("is-invalid");
    campo.classList.add("is-valid");
  }

  function validarEmail() {
    const valor = campoEmail.value.trim();
    if (valor === "") {
      marcarCampoInvalido(campoEmail, "El correo electrónico es obligatorio.");
      return false;
    }
    if (!REGEX_EMAIL.test(valor)) {
      marcarCampoInvalido(campoEmail, "Ingrese un correo electrónico con un formato válido (ejemplo: usuario@dominio.com).");
      return false;
    }
    marcarCampoValido(campoEmail);
    return true;
  }

  function validarPassword() {
    const valor = campoPassword.value;
    if (valor === "") {
      marcarCampoInvalido(campoPassword, "La contraseña es obligatoria.");
      return false;
    }
    if (valor.length < LONGITUD_MIN_PASSWORD) {
      marcarCampoInvalido(campoPassword, "La contraseña debe tener mínimo " + LONGITUD_MIN_PASSWORD + " caracteres.");
      return false;
    }
    marcarCampoValido(campoPassword);
    return true;
  }

  campoEmail.addEventListener("blur", validarEmail);
  campoPassword.addEventListener("blur", validarPassword);
  campoEmail.addEventListener("input", function () {
    if (campoEmail.classList.contains("is-invalid")) validarEmail();
  });
  campoPassword.addEventListener("input", function () {
    if (campoPassword.classList.contains("is-invalid")) validarPassword();
  });

  if (botonMostrarPassword) {
    botonMostrarPassword.addEventListener("click", function () {
      const seEstaMostrando = campoPassword.getAttribute("type") === "text";
      campoPassword.setAttribute("type", seEstaMostrando ? "password" : "text");
      botonMostrarPassword.setAttribute("aria-pressed", String(!seEstaMostrando));
      botonMostrarPassword.textContent = seEstaMostrando ? "Mostrar" : "Ocultar";
    });
  }

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    alertaExito.classList.add("d-none");
    if (alertaError) {
      alertaError.classList.add("d-none");
      alertaError.textContent = "Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.";
    }

    const emailValido = validarEmail();
    const passwordValido = validarPassword();

    if (!emailValido || !passwordValido) {
      const primerCampoInvalido = formulario.querySelector(".is-invalid");
      if (primerCampoInvalido) primerCampoInvalido.focus();
      return;
    }

    const botonEnviar = formulario.querySelector('button[type="submit"]');
    if (botonEnviar) botonEnviar.disabled = true;

    try {
      // 1) Verifica las credenciales contra la API real (POST /api/usuarios/login)
      const respuesta = await usuarioService.login(campoEmail.value.trim(), campoPassword.value);
      const usuarioBasico = respuesta.usuario; // { id_usuario, nombre_completo, correo }

      // 2) Trae el registro completo del usuario para conocer su rol
      //    (el login no lo devuelve, pero GET /api/usuarios/:id sí).
      let usuarioCompleto = usuarioBasico;
      try {
        usuarioCompleto = await usuarioService.obtenerPorId(usuarioBasico.id_usuario);
      } catch (errorPerfil) {
        // Si falla, se sigue con los datos básicos del login: no es crítico.
      }

      guardarSesion(usuarioCompleto);

      alertaExito.classList.remove("d-none");
      alertaExito.setAttribute("tabindex", "-1");
      alertaExito.focus();
      formulario.reset();
      [campoEmail, campoPassword].forEach(function (campo) {
        campo.classList.remove("is-valid");
      });

      setTimeout(function () {
        window.location.href = "turnos.html";
      }, 1200);
    } catch (error) {
      if (alertaError) {
        alertaError.textContent = error.message || "Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.";
        alertaError.classList.remove("d-none");
        alertaError.setAttribute("tabindex", "-1");
        alertaError.focus();
      }
      campoPassword.focus();
    } finally {
      if (botonEnviar) botonEnviar.disabled = false;
    }
  });
}

/* =========================================================
   Utilidades compartidas entre Turnos y Asistencia
   ========================================================= */

/** Deriva "Mañana"/"Tarde"/"Noche" a partir de la hora de inicio, solo para el color del badge. */
function obtenerFranjaHoraria(horaInicio) {
  if (!horaInicio) return "Noche";
  const hora = Number(String(horaInicio).slice(0, 2));
  if (hora < 12) return "Mañana";
  if (hora < 18) return "Tarde";
  return "Noche";
}

function obtenerClaseBadgeTurno(horaInicio) {
  const franja = obtenerFranjaHoraria(horaInicio);
  if (franja === "Mañana") return "badge-turno-manana";
  if (franja === "Tarde") return "badge-turno-tarde";
  return "badge-turno-noche";
}

/** Traduce el estado_asistencia calculado por el backend a una etiqueta legible y su clase de badge. */
const ESTADOS_ASISTENCIA_INFO = {
  pendiente: { etiqueta: "Sin marcar", clase: "badge-asistencia-sinmarcar" },
  completo: { etiqueta: "Presente", clase: "badge-asistencia-presente" },
  tardanza: { etiqueta: "Tardanza", clase: "badge-asistencia-tardanza" },
  salida_anticipada: { etiqueta: "Salida anticipada", clase: "badge-asistencia-tardanza" },
  ausente: { etiqueta: "Ausente", clase: "badge-asistencia-ausente" },
};

function obtenerInfoEstadoAsistencia(estado) {
  return ESTADOS_ASISTENCIA_INFO[estado] || ESTADOS_ASISTENCIA_INFO.pendiente;
}

function formatearHora(horaHHMMSS) {
  if (!horaHHMMSS) return "";
  return String(horaHHMMSS).slice(0, 5);
}

function mostrarToast(idToast, idTextoToast, mensaje) {
  const toast = document.getElementById(idToast);
  const textoToast = document.getElementById(idTextoToast);
  if (!toast) return;
  if (textoToast && mensaje) textoToast.textContent = mensaje;
  const instanciaToast = bootstrap.Toast.getInstance(toast) || new bootstrap.Toast(toast);
  instanciaToast.show();
}

/* =========================================================
   5. Módulo de turnos (turnos.html)
   ========================================================= */

function inicializarTurnos() {
  const cuerpoTabla = document.getElementById("cuerpoTablaTurnos");
  if (!cuerpoTabla) return;
  if (!exigirSesionOEnviarALogin()) return;

  const sesion = obtenerSesion();
  const selectFiltroArea = document.getElementById("filtroArea");
  const campoBusqueda = document.getElementById("buscarEmpleado");
  const formNuevoTurno = document.getElementById("formNuevoTurno");
  const selectEmpleado = document.getElementById("nuevoEmpleado");
  const selectArea = document.getElementById("nuevaArea");
  const elementoModal = document.getElementById("modalNuevoTurno");

  let turnos = [];

  async function cargarCatalogos() {
    try {
      const [usuarios, areas] = await Promise.all([usuarioService.obtenerTodos(), catalogoService.obtenerAreas()]);

      if (selectEmpleado) {
        usuarios
          .filter(function (u) { return u.estado === "activo"; })
          .forEach(function (usuario) {
            const opcion = document.createElement("option");
            opcion.value = usuario.id_usuario;
            opcion.textContent = usuario.nombre_completo;
            selectEmpleado.appendChild(opcion);
          });
      }

      [selectArea, selectFiltroArea].forEach(function (select) {
        if (!select) return;
        areas.forEach(function (area) {
          const opcion = document.createElement("option");
          opcion.value = area.id_area;
          opcion.textContent = area.nombre_area;
          select.appendChild(opcion);
        });
      });
    } catch (error) {
      console.error("No se pudieron cargar los catálogos:", error);
    }
  }

  async function cargarTurnos() {
    cuerpoTabla.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Cargando turnos...</td></tr>';
    try {
      turnos = await turnoService.obtenerTodos();
      aplicarFiltrosYRenderizar();
    } catch (error) {
      cuerpoTabla.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">' + (error.message || "No se pudieron cargar los turnos.") + "</td></tr>";
    }
  }

  function aplicarFiltrosYRenderizar() {
    const areaSeleccionada = selectFiltroArea ? selectFiltroArea.value : "todas";
    const textoBusqueda = campoBusqueda ? campoBusqueda.value.trim().toLowerCase() : "";

    const turnosFiltrados = turnos.filter(function (turno) {
      const coincideArea = areaSeleccionada === "todas" || String(turno.id_area) === String(areaSeleccionada);
      const coincideBusqueda = (turno.nombre_usuario || "").toLowerCase().includes(textoBusqueda);
      return coincideArea && coincideBusqueda;
    });

    renderizarTurnos(turnosFiltrados);
  }

  function renderizarTurnos(listaTurnos) {
    cuerpoTabla.innerHTML = "";

    if (listaTurnos.length === 0) {
      cuerpoTabla.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No hay turnos que coincidan con la búsqueda o el filtro seleccionado.</td></tr>';
      return;
    }

    listaTurnos.forEach(function (turno) {
      const infoEstado = obtenerInfoEstadoAsistencia(turno.estado_asistencia);
      const fila = document.createElement("tr");

      fila.innerHTML =
        "<td>" + turno.nombre_usuario + "</td>" +
        "<td>" + (turno.nombre_area || "—") + "</td>" +
        "<td>" + turno.fecha_turno + "</td>" +
        '<td><span class="badge ' + obtenerClaseBadgeTurno(turno.hora_inicio) + '">' + formatearHora(turno.hora_inicio) + " - " + formatearHora(turno.hora_fin) + "</span></td>" +
        '<td><span class="badge badge-estado ' + infoEstado.clase + '">' + infoEstado.etiqueta + "</span></td>" +
        '<td class="acciones-turno"></td>';

      const celdaAcciones = fila.querySelector(".acciones-turno");

      const botonEditar = document.createElement("button");
      botonEditar.type = "button";
      botonEditar.className = "btn btn-sm btn-outline-primary me-2";
      botonEditar.textContent = "Editar";
      botonEditar.setAttribute("aria-label", "Editar turno de " + turno.nombre_usuario);
      botonEditar.addEventListener("click", function () {
        abrirModalEdicion(turno);
      });

      const botonEliminar = document.createElement("button");
      botonEliminar.type = "button";
      botonEliminar.className = "btn btn-sm btn-outline-danger btn-eliminar-turno";
      botonEliminar.textContent = "Eliminar";
      botonEliminar.setAttribute("aria-label", "Eliminar turno de " + turno.nombre_usuario);
      botonEliminar.addEventListener("click", function () {
        eliminarTurno(turno);
      });

      celdaAcciones.appendChild(botonEditar);
      celdaAcciones.appendChild(botonEliminar);
      cuerpoTabla.appendChild(fila);
    });
  }

  async function eliminarTurno(turno) {
    const confirmarEliminacion = window.confirm("¿Está seguro de que desea eliminar el turno de " + turno.nombre_usuario + "?");
    if (!confirmarEliminacion) return;

    try {
      await turnoService.eliminar(turno.id_turno);
      await cargarTurnos();
    } catch (error) {
      window.alert(error.message || "No se pudo eliminar el turno.");
    }
  }

  function abrirModalEdicion(turno) {
    const mensajeError = document.getElementById("mensajeModalTurno");

    document.getElementById("turnoIdEditando").value = turno.id_turno;
    if (selectEmpleado) {
      selectEmpleado.value = turno.id_usuario;
      selectEmpleado.disabled = true; // no se puede reasignar el turno a otro empleado
    }
    document.getElementById("nuevaArea").value = turno.id_area || "";
    document.getElementById("nuevaFecha").value = turno.fecha_turno;
    document.getElementById("nuevaHoraInicio").value = formatearHora(turno.hora_inicio);
    document.getElementById("nuevaHoraFin").value = formatearHora(turno.hora_fin);
    document.getElementById("modalNuevoTurnoLabel").textContent = "Editar turno";
    document.getElementById("btnGuardarTurno").textContent = "Guardar cambios";
    if (mensajeError) ocultarMensajeError(mensajeError);

    const instanciaModal = bootstrap.Modal.getInstance(elementoModal) || new bootstrap.Modal(elementoModal);
    instanciaModal.show();
  }

  function mostrarMensajeError(mensajeError, texto) {
    mensajeError.textContent = texto;
    mensajeError.classList.remove("d-none");
  }

  function ocultarMensajeError(mensajeError) {
    mensajeError.classList.add("d-none");
  }

  cargarCatalogos().then(cargarTurnos);

  if (selectFiltroArea) selectFiltroArea.addEventListener("change", aplicarFiltrosYRenderizar);
  if (campoBusqueda) campoBusqueda.addEventListener("input", aplicarFiltrosYRenderizar);

  if (formNuevoTurno) {
    const campoFecha = document.getElementById("nuevaFecha");
    if (campoFecha) {
      const hoy = new Date();
      campoFecha.setAttribute("min", hoy.toISOString().split("T")[0]);
    }

    const botonAsignar = document.getElementById("btnAsignarTurno");
    if (elementoModal) {
      elementoModal.addEventListener("show.bs.modal", function (evento) {
        if (evento.relatedTarget === botonAsignar) {
          document.getElementById("turnoIdEditando").value = "";
          formNuevoTurno.reset();
          if (selectEmpleado) selectEmpleado.disabled = false;
          document.getElementById("modalNuevoTurnoLabel").textContent = "Asignar nuevo turno";
          document.getElementById("btnGuardarTurno").textContent = "Guardar turno";
          const mensajeError = document.getElementById("mensajeModalTurno");
          if (mensajeError) ocultarMensajeError(mensajeError);
        }
      });
    }

    formNuevoTurno.addEventListener("submit", async function (evento) {
      evento.preventDefault();

      const idEditando = document.getElementById("turnoIdEditando").value;
      const idEmpleado = selectEmpleado ? selectEmpleado.value : "";
      const idArea = selectArea ? selectArea.value : "";
      const fecha = document.getElementById("nuevaFecha").value;
      const horaInicio = document.getElementById("nuevaHoraInicio").value;
      const horaFin = document.getElementById("nuevaHoraFin").value;
      const mensajeError = document.getElementById("mensajeModalTurno");
      const botonGuardar = document.getElementById("btnGuardarTurno");

      if (!idEmpleado || !fecha || !horaInicio || !horaFin) {
        mostrarMensajeError(mensajeError, "Complete todos los campos para asignar el turno.");
        return;
      }

      if (horaFin <= horaInicio) {
        mostrarMensajeError(mensajeError, "La hora de fin debe ser posterior a la hora de inicio.");
        return;
      }

      const fechaSeleccionada = new Date(fecha + "T00:00:00");
      const fechaHoy = new Date(new Date().toISOString().split("T")[0] + "T00:00:00");
      if (fechaSeleccionada < fechaHoy) {
        mostrarMensajeError(mensajeError, "No se pueden asignar turnos en fechas anteriores a hoy.");
        return;
      }

      ocultarMensajeError(mensajeError);
      botonGuardar.disabled = true;

      try {
        if (idEditando) {
          await turnoService.actualizar(idEditando, {
            fecha_turno: fecha, hora_inicio: horaInicio, hora_fin: horaFin, id_area: idArea || null,
          });
        } else {
          await turnoService.crear({
            id_usuario: idEmpleado, fecha_turno: fecha, hora_inicio: horaInicio, hora_fin: horaFin,
            id_area: idArea || null, creado_por: sesion.id_usuario,
          });
        }

        formNuevoTurno.reset();
        document.getElementById("turnoIdEditando").value = "";
        const instanciaModal = bootstrap.Modal.getInstance(elementoModal) || new bootstrap.Modal(elementoModal);
        instanciaModal.hide();
        await cargarTurnos();
        setTimeout(function () {
          mostrarToast("toastTurnoAsignado", "toastTurnoAsignadoTexto", idEditando ? "Turno actualizado correctamente." : "Turno asignado correctamente.");
        }, 250);
      } catch (error) {
        mostrarMensajeError(mensajeError, error.message || "No se pudo guardar el turno.");
      } finally {
        botonGuardar.disabled = false;
      }
    });
  }
}

/* =========================================================
   6. Módulo de asistencia (asistencia.html)
   -----------------------------------------------------------
   No duplica datos: lee los mismos turnos de la API y, por cada
   uno, permite registrar entrada/salida. El estado (a tiempo,
   tardanza, etc.) siempre lo calcula el backend.
   ========================================================= */

function inicializarAsistencia() {
  const cuerpoTabla = document.getElementById("cuerpoTablaAsistencia");
  if (!cuerpoTabla) return;
  if (!exigirSesionOEnviarALogin()) return;

  const selectFiltroArea = document.getElementById("filtroAreaAsistencia");
  const campoFiltroFecha = document.getElementById("filtroFechaAsistencia");
  const campoBusqueda = document.getElementById("buscarEmpleadoAsistencia");
  const avisoSinTurnos = document.getElementById("avisoSinTurnos");

  let turnos = [];

  function actualizarResumen(todosLosTurnos) {
    const statPresentes = document.getElementById("statPresentes");
    const statTardanzas = document.getElementById("statTardanzas");
    const statAusencias = document.getElementById("statAusencias");
    const statSinMarcar = document.getElementById("statSinMarcar");

    const conteo = { completo: 0, tardanza: 0, salida_anticipada: 0, ausente: 0, pendiente: 0 };
    todosLosTurnos.forEach(function (turno) {
      const estado = turno.estado_asistencia || "pendiente";
      if (conteo[estado] !== undefined) conteo[estado] += 1;
    });

    if (statPresentes) statPresentes.textContent = conteo.completo;
    if (statTardanzas) statTardanzas.textContent = conteo.tardanza + conteo.salida_anticipada;
    if (statAusencias) statAusencias.textContent = conteo.ausente;
    if (statSinMarcar) statSinMarcar.textContent = conteo.pendiente;
  }

  async function cargarTurnos() {
    cuerpoTabla.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Cargando...</td></tr>';
    try {
      turnos = await turnoService.obtenerTodos();
      aplicarFiltrosYRenderizar();
    } catch (error) {
      cuerpoTabla.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">' + (error.message || "No se pudo cargar la asistencia.") + "</td></tr>";
    }
  }

  function renderizarAsistencia(listaTurnos) {
    cuerpoTabla.innerHTML = "";

    if (listaTurnos.length === 0) {
      cuerpoTabla.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No hay turnos que coincidan con la búsqueda o los filtros seleccionados.</td></tr>';
      return;
    }

    listaTurnos.forEach(function (turno) {
      const infoEstado = obtenerInfoEstadoAsistencia(turno.estado_asistencia);
      const fila = document.createElement("tr");

      fila.innerHTML =
        "<td>" + turno.nombre_usuario + "</td>" +
        "<td>" + (turno.nombre_area || "—") + "</td>" +
        "<td>" + turno.fecha_turno + "</td>" +
        '<td><span class="badge ' + obtenerClaseBadgeTurno(turno.hora_inicio) + '">' + formatearHora(turno.hora_inicio) + " - " + formatearHora(turno.hora_fin) + "</span></td>" +
        '<td><span class="badge badge-estado ' + infoEstado.clase + '">' + infoEstado.etiqueta + "</span></td>" +
        '<td class="acciones-turno"></td>';

      const celdaAcciones = fila.querySelector(".acciones-turno");

      if (!turno.hora_entrada) {
        const botonEntrada = document.createElement("button");
        botonEntrada.type = "button";
        botonEntrada.className = "btn btn-sm btn-success";
        botonEntrada.textContent = "Registrar entrada";
        botonEntrada.addEventListener("click", function () {
          registrarEntrada(turno, botonEntrada);
        });
        celdaAcciones.appendChild(botonEntrada);
      } else if (!turno.hora_salida) {
        const botonSalida = document.createElement("button");
        botonSalida.type = "button";
        botonSalida.className = "btn btn-sm btn-outline-primary";
        botonSalida.textContent = "Registrar salida";
        botonSalida.addEventListener("click", function () {
          registrarSalida(turno, botonSalida);
        });
        celdaAcciones.appendChild(botonSalida);
      } else {
        const textoCompletado = document.createElement("span");
        textoCompletado.className = "text-muted small";
        textoCompletado.textContent = "Jornada completa";
        celdaAcciones.appendChild(textoCompletado);
      }

      cuerpoTabla.appendChild(fila);
    });
  }

  async function registrarEntrada(turno, boton) {
    boton.disabled = true;
    try {
      const respuesta = await asistenciaService.registrarEntrada(turno.id_turno, turno.id_usuario);
      await cargarTurnos();
      mostrarToast("toastAsistenciaGuardada", "toastAsistenciaGuardadaTexto", respuesta.mensaje || "Entrada registrada.");
    } catch (error) {
      window.alert(error.message || "No se pudo registrar la entrada.");
      boton.disabled = false;
    }
  }

  async function registrarSalida(turno, boton) {
    boton.disabled = true;
    try {
      const respuesta = await asistenciaService.registrarSalida(turno.id_turno);
      await cargarTurnos();
      mostrarToast("toastAsistenciaGuardada", "toastAsistenciaGuardadaTexto", respuesta.mensaje || "Salida registrada.");
    } catch (error) {
      window.alert(error.message || "No se pudo registrar la salida.");
      boton.disabled = false;
    }
  }

  function aplicarFiltrosYRenderizar() {
    if (avisoSinTurnos) {
      avisoSinTurnos.classList.toggle("d-none", turnos.length > 0);
    }

    const areaSeleccionada = selectFiltroArea ? selectFiltroArea.value : "todas";
    const fechaSeleccionada = campoFiltroFecha ? campoFiltroFecha.value : "";
    const textoBusqueda = campoBusqueda ? campoBusqueda.value.trim().toLowerCase() : "";

    const turnosFiltrados = turnos.filter(function (turno) {
      const coincideArea = areaSeleccionada === "todas" || String(turno.id_area) === String(areaSeleccionada);
      const coincideFecha = !fechaSeleccionada || turno.fecha_turno === fechaSeleccionada;
      const coincideBusqueda = (turno.nombre_usuario || "").toLowerCase().includes(textoBusqueda);
      return coincideArea && coincideFecha && coincideBusqueda;
    });

    renderizarAsistencia(turnosFiltrados);
    actualizarResumen(turnos);
  }

  async function cargarAreas() {
    if (!selectFiltroArea) return;
    try {
      const areas = await catalogoService.obtenerAreas();
      areas.forEach(function (area) {
        const opcion = document.createElement("option");
        opcion.value = area.id_area;
        opcion.textContent = area.nombre_area;
        selectFiltroArea.appendChild(opcion);
      });
    } catch (error) {
      console.error("No se pudieron cargar las áreas:", error);
    }
  }

  cargarAreas().then(cargarTurnos);

  if (selectFiltroArea) selectFiltroArea.addEventListener("change", aplicarFiltrosYRenderizar);
  if (campoFiltroFecha) campoFiltroFecha.addEventListener("change", aplicarFiltrosYRenderizar);
  if (campoBusqueda) campoBusqueda.addEventListener("input", aplicarFiltrosYRenderizar);
}

/* =========================================================
   7. Módulo de solicitudes (solicitudes.html)
   ========================================================= */

const ESTADOS_SOLICITUD_INFO = {
  pendiente: { etiqueta: "Pendiente", clase: "badge-estado-pendiente" },
  aprobada: { etiqueta: "Aprobada", clase: "badge-estado-confirmado" },
  rechazada: { etiqueta: "Rechazada", clase: "badge-estado-cancelado" },
};

function inicializarSolicitudes() {
  const cuerpoTabla = document.getElementById("cuerpoTablaSolicitudes");
  if (!cuerpoTabla) return;
  if (!exigirSesionOEnviarALogin()) return;

  const sesion = obtenerSesion();
  const avisoSinSolicitudes = document.getElementById("avisoSinSolicitudes");
  const selectTipo = document.getElementById("solicitudTipo");
  const formNuevaSolicitud = document.getElementById("formNuevaSolicitud");
  const elementoModal = document.getElementById("modalNuevaSolicitud");

  async function cargarTiposSolicitud() {
    if (!selectTipo) return;
    try {
      const tipos = await catalogoService.obtenerTiposSolicitud();
      tipos.forEach(function (tipo) {
        const opcion = document.createElement("option");
        opcion.value = tipo.id_tipo;
        opcion.textContent = tipo.nombre_tipo;
        selectTipo.appendChild(opcion);
      });
    } catch (error) {
      console.error("No se pudieron cargar los tipos de solicitud:", error);
    }
  }

  async function cargarSolicitudes() {
    cuerpoTabla.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Cargando solicitudes...</td></tr>';
    try {
      const solicitudes = await solicitudService.obtenerTodas();
      renderizarSolicitudes(solicitudes);
      if (avisoSinSolicitudes) avisoSinSolicitudes.classList.toggle("d-none", solicitudes.length > 0);
    } catch (error) {
      cuerpoTabla.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-3">' + (error.message || "No se pudieron cargar las solicitudes.") + "</td></tr>";
    }
  }

  function renderizarSolicitudes(solicitudes) {
    cuerpoTabla.innerHTML = "";

    if (solicitudes.length === 0) {
      cuerpoTabla.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No hay solicitudes registradas.</td></tr>';
      return;
    }

    solicitudes.forEach(function (solicitud) {
      const infoEstado = ESTADOS_SOLICITUD_INFO[solicitud.estado] || ESTADOS_SOLICITUD_INFO.pendiente;
      const fila = document.createElement("tr");

      fila.innerHTML =
        "<td>" + solicitud.nombre_usuario + "</td>" +
        "<td>" + solicitud.nombre_tipo + "</td>" +
        "<td>" + solicitud.fecha_inicio + "</td>" +
        "<td>" + solicitud.fecha_fin + "</td>" +
        '<td class="text-truncate" style="max-width: 220px;" title="' + (solicitud.motivo || "").replace(/"/g, "&quot;") + '">' + solicitud.motivo + "</td>" +
        '<td><span class="badge badge-estado ' + infoEstado.clase + '">' + infoEstado.etiqueta + "</span></td>" +
        '<td class="acciones-turno"></td>';

      const celdaAcciones = fila.querySelector(".acciones-turno");

      if (solicitud.estado === "pendiente") {
        const botonAprobar = document.createElement("button");
        botonAprobar.type = "button";
        botonAprobar.className = "btn btn-sm btn-success me-2";
        botonAprobar.textContent = "Aprobar";
        botonAprobar.addEventListener("click", function () {
          responderSolicitud(solicitud, "aprobar");
        });

        const botonRechazar = document.createElement("button");
        botonRechazar.type = "button";
        botonRechazar.className = "btn btn-sm btn-outline-danger";
        botonRechazar.textContent = "Rechazar";
        botonRechazar.addEventListener("click", function () {
          responderSolicitud(solicitud, "rechazar");
        });

        celdaAcciones.appendChild(botonAprobar);
        celdaAcciones.appendChild(botonRechazar);
      } else {
        const textoResuelta = document.createElement("span");
        textoResuelta.className = "text-muted small";
        textoResuelta.textContent = solicitud.nombre_aprobador ? "Resuelta por " + solicitud.nombre_aprobador : "Resuelta";
        celdaAcciones.appendChild(textoResuelta);
      }

      cuerpoTabla.appendChild(fila);
    });
  }

  async function responderSolicitud(solicitud, accion) {
    const confirmar = window.confirm(
      (accion === "aprobar" ? "¿Aprobar" : "¿Rechazar") + " la solicitud de " + solicitud.nombre_usuario + "?"
    );
    if (!confirmar) return;

    try {
      if (accion === "aprobar") {
        await solicitudService.aprobar(solicitud.id_solicitud, sesion.id_usuario);
      } else {
        await solicitudService.rechazar(solicitud.id_solicitud, sesion.id_usuario);
      }
      await cargarSolicitudes();
      mostrarToast("toastSolicitud", "toastSolicitudTexto", "Solicitud " + (accion === "aprobar" ? "aprobada" : "rechazada") + " correctamente.");
    } catch (error) {
      window.alert(error.message || "No se pudo procesar la solicitud.");
    }
  }

  cargarTiposSolicitud().then(cargarSolicitudes);

  if (formNuevaSolicitud) {
    const campoFechaInicio = document.getElementById("solicitudFechaInicio");
    if (campoFechaInicio) {
      campoFechaInicio.setAttribute("min", new Date().toISOString().split("T")[0]);
    }

    if (elementoModal) {
      elementoModal.addEventListener("show.bs.modal", function () {
        formNuevaSolicitud.reset();
        const mensajeError = document.getElementById("mensajeModalSolicitud");
        if (mensajeError) mensajeError.classList.add("d-none");
      });
    }

    formNuevaSolicitud.addEventListener("submit", async function (evento) {
      evento.preventDefault();

      const idTipo = selectTipo ? selectTipo.value : "";
      const fechaInicio = document.getElementById("solicitudFechaInicio").value;
      const fechaFin = document.getElementById("solicitudFechaFin").value;
      const motivo = document.getElementById("solicitudMotivo").value.trim();
      const mensajeError = document.getElementById("mensajeModalSolicitud");
      const botonGuardar = document.getElementById("btnGuardarSolicitud");

      if (!idTipo || !fechaInicio || !fechaFin || !motivo) {
        mensajeError.textContent = "Complete todos los campos para crear la solicitud.";
        mensajeError.classList.remove("d-none");
        return;
      }

      if (fechaFin < fechaInicio) {
        mensajeError.textContent = "La fecha 'hasta' no puede ser anterior a la fecha 'desde'.";
        mensajeError.classList.remove("d-none");
        return;
      }

      mensajeError.classList.add("d-none");
      botonGuardar.disabled = true;

      try {
        await solicitudService.crear({
          id_usuario: sesion.id_usuario, id_tipo: idTipo, fecha_inicio: fechaInicio, fecha_fin: fechaFin, motivo: motivo,
        });

        formNuevaSolicitud.reset();
        const instanciaModal = bootstrap.Modal.getInstance(elementoModal) || new bootstrap.Modal(elementoModal);
        instanciaModal.hide();
        await cargarSolicitudes();
        setTimeout(function () {
          mostrarToast("toastSolicitud", "toastSolicitudTexto", "Solicitud enviada correctamente.");
        }, 250);
      } catch (error) {
        mensajeError.textContent = error.message || "No se pudo crear la solicitud.";
        mensajeError.classList.remove("d-none");
      } finally {
        botonGuardar.disabled = false;
      }
    });
  }
}

/* =========================================================
   8. Dashboard de estadísticas (index.html)
   ========================================================= */

async function inicializarDashboard() {
  const statConfirmados = document.getElementById("statConfirmados");
  const statPendientes = document.getElementById("statPendientes");
  const statCancelados = document.getElementById("statCancelados");
  const statSolicitudesPendientes = document.getElementById("statSolicitudesPendientes");
  const heroConfirmados = document.getElementById("heroConfirmados");
  const heroPendientes = document.getElementById("heroPendientes");
  const heroCancelados = document.getElementById("heroCancelados");
  const heroTotalTurnos = document.getElementById("heroTotalTurnos");
  const heroPieChart = document.getElementById("heroPieChart");
  if (!statConfirmados && !statPendientes && !statCancelados) return;

  // El dashboard solo muestra datos reales si hay sesión; si no, se queda en ceros.
  if (!obtenerSesion()) return;

  let turnos = [];
  let solicitudes = [];

  try {
    turnos = await turnoService.obtenerTodos();
  } catch (error) {
    console.error("No se pudieron cargar los turnos para el dashboard:", error);
  }

  try {
    solicitudes = await solicitudService.obtenerTodas();
  } catch (error) {
    console.error("No se pudieron cargar las solicitudes para el dashboard:", error);
  }

  const conteo = { completo: 0, pendiente: 0, tardanza: 0, salida_anticipada: 0, ausente: 0 };
  turnos.forEach(function (turno) {
    const estado = turno.estado_asistencia || "pendiente";
    if (conteo[estado] !== undefined) conteo[estado] += 1;
  });

  const completados = conteo.completo;
  const pendientes = conteo.pendiente;
  const tardanzas = conteo.tardanza + conteo.salida_anticipada;
  const solicitudesPendientes = solicitudes.filter(function (s) { return s.estado === "pendiente"; }).length;

  if (statConfirmados) statConfirmados.textContent = completados;
  if (statPendientes) statPendientes.textContent = pendientes;
  if (statCancelados) statCancelados.textContent = tardanzas;
  if (statSolicitudesPendientes) statSolicitudesPendientes.textContent = solicitudesPendientes;

  if (heroConfirmados) heroConfirmados.textContent = completados;
  if (heroPendientes) heroPendientes.textContent = pendientes;
  if (heroCancelados) heroCancelados.textContent = tardanzas;
  if (heroTotalTurnos) heroTotalTurnos.textContent = turnos.length;

  const totalTurnos = turnos.length || 1;
  if (heroPieChart) {
    const completadosPct = (completados / totalTurnos) * 100;
    const pendientesPct = (pendientes / totalTurnos) * 100;

    const startCompletados = 0;
    const endCompletados = (completadosPct / 100) * 360;
    const startPendientes = endCompletados;
    const endPendientes = startPendientes + (pendientesPct / 100) * 360;
    const startTardanzas = endPendientes;
    const endTardanzas = 360;

    heroPieChart.style.background = "conic-gradient(" +
      "var(--pm-success) " + startCompletados + "deg " + endCompletados + "deg, " +
      "var(--pm-warning) " + startPendientes + "deg " + endPendientes + "deg, " +
      "var(--pm-danger) " + startTardanzas + "deg " + endTardanzas + "deg" +
      ")";
  }
}
