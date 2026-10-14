/* =========================================================
   PeopleManager - script.js
   -----------------------------------------------------------
   Código COMPARTIDO por todas las páginas. La lógica propia de
   cada pantalla vive en js/paginas/<pagina>.js.
     1. Tema claro/oscuro
     2. Sesión de usuario (token + datos básicos) y roles
     3. Barra de navegación según el rol
     4. Utilidades: escapar HTML, fechas, badges, CSV
     5. Notificaciones y diálogo de confirmación (Bootstrap)
     6. Cambio de contraseña propia
   ========================================================= */

/* =========================================================
   1. Tema claro/oscuro
   ========================================================= */

function leerPreferencia(clave, porDefecto) {
  try {
    return localStorage.getItem(clave) || porDefecto;
  } catch (error) {
    return porDefecto; // navegador con almacenamiento bloqueado
  }
}

function guardarPreferencia(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch (error) {
    // Sin almacenamiento solo se pierde la preferencia; la página sigue funcionando.
  }
}

function inicializarTema() {
  const botonTema = document.getElementById("themeToggle");
  aplicarTema(leerPreferencia("pm-theme", "light"));

  if (botonTema) {
    botonTema.addEventListener("click", function () {
      aplicarTema(document.body.dataset.theme === "dark" ? "light" : "dark");
    });
  }
}

function aplicarTema(tema) {
  const temaFinal = tema === "dark" ? "dark" : "light";
  document.body.dataset.theme = temaFinal;
  document.documentElement.dataset.theme = temaFinal;
  document.documentElement.dataset.bsTheme = temaFinal;
  guardarPreferencia("pm-theme", temaFinal);

  const botonTema = document.getElementById("themeToggle");
  if (botonTema) {
    // En escritorio solo se ve el ícono (el texto se oculta por CSS para que el menú quepa).
    botonTema.innerHTML = temaFinal === "dark"
      ? '<i class="bi bi-sun-fill" aria-hidden="true"></i><span class="texto-tema"> Claro</span>'
      : '<i class="bi bi-moon-fill" aria-hidden="true"></i><span class="texto-tema"> Oscuro</span>';
    botonTema.setAttribute("aria-pressed", String(temaFinal === "dark"));
    botonTema.setAttribute("aria-label", temaFinal === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    botonTema.setAttribute("title", temaFinal === "dark" ? "Modo claro" : "Modo oscuro");
  }
}

/* =========================================================
   2. Sesión de usuario y roles
   -----------------------------------------------------------
   Se guarda el token que entrega la API y lo mínimo para
   mostrar la interfaz (id, nombre, correo, rol, área). La
   contraseña nunca se guarda en el navegador. El token vence a
   las 8 horas; además la API revisa en cada petición que el
   usuario siga activo.
   ========================================================= */

const ROLES = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  RRHH: "RRHH",
  EMPLEADO: "Empleado",
};
const ROLES_GESTORES = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.RRHH];
const ROLES_ADMINISTRAN_USUARIOS = [ROLES.ADMIN, ROLES.RRHH];
const ROLES_PLANIFICAN_TURNOS = [ROLES.ADMIN, ROLES.SUPERVISOR];

function obtenerSesion() {
  try {
    const crudo = sessionStorage.getItem(CLAVE_SESION) || localStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;
    const sesion = JSON.parse(crudo);
    if (!sesion.token || (sesion.expira && sesion.expira < Date.now())) {
      cerrarSesion();
      return null;
    }
    return sesion;
  } catch (error) {
    return null;
  }
}

/** @param {object} respuestaLogin - respuesta de POST /api/usuarios/login */
function guardarSesion(respuestaLogin, recordar) {
  const sesion = {
    token: respuestaLogin.token,
    expira: Date.now() + (respuestaLogin.expira_en_horas || 8) * 60 * 60 * 1000,
    id_usuario: respuestaLogin.usuario.id_usuario,
    nombre_completo: respuestaLogin.usuario.nombre_completo,
    correo: respuestaLogin.usuario.correo,
    id_rol: respuestaLogin.usuario.id_rol,
    nombre_rol: respuestaLogin.usuario.nombre_rol,
    id_area: respuestaLogin.usuario.id_area,
  };
  cerrarSesion();
  // "Recordarme": la sesión sobrevive a cerrar el navegador (hasta que venza el token).
  const almacen = recordar ? localStorage : sessionStorage;
  almacen.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

function cerrarSesion() {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem(CLAVE_SESION);
  } catch (error) {
    // Nada que limpiar si el almacenamiento está bloqueado.
  }
}

function tieneRol(sesion, roles) {
  return Boolean(sesion) && roles.includes(sesion.nombre_rol);
}

function esGestor(sesion) {
  return tieneRol(sesion, ROLES_GESTORES);
}

/**
 * Protege una página completa: sin sesión redirige al login; con sesión
 * pero sin el rol necesario, lleva al inicio. Devuelve la sesión o null.
 */
function exigirSesion(rolesPermitidos) {
  const sesion = obtenerSesion();
  if (!sesion) {
    window.location.href = "login.html";
    return null;
  }
  if (rolesPermitidos && !tieneRol(sesion, rolesPermitidos)) {
    window.location.href = "index.html?acceso=denegado";
    return null;
  }
  return sesion;
}

/* =========================================================
   3. Barra de navegación según el rol
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

/**
 * - Elementos con data-requiere-sesion: visibles solo con sesión.
 * - Elementos con data-roles="Administrador,RRHH": visibles solo para esos roles.
 * - Botón de acción: "Iniciar sesión" / "Cerrar sesión".
 */
function inicializarNavegacion() {
  const sesion = obtenerSesion();

  document.querySelectorAll("[data-requiere-sesion]").forEach(function (elemento) {
    elemento.classList.toggle("d-none", !sesion);
  });

  document.querySelectorAll("[data-roles]").forEach(function (elemento) {
    const roles = elemento.dataset.roles.split(",").map(function (r) { return r.trim(); });
    elemento.classList.toggle("d-none", !tieneRol(sesion, roles));
  });

  document.querySelectorAll("[data-sin-sesion]").forEach(function (elemento) {
    elemento.classList.toggle("d-none", Boolean(sesion));
  });

  const botonAuth = document.getElementById("btnAuthAction");
  if (botonAuth) {
    if (sesion) {
      botonAuth.textContent = "Cerrar sesión";
      botonAuth.setAttribute("href", "#");
      botonAuth.onclick = function (evento) {
        evento.preventDefault();
        cerrarSesion();
        window.location.href = "login.html?sesion=cerrada";
      };
    } else {
      botonAuth.textContent = "Iniciar sesión";
      botonAuth.setAttribute("href", "login.html");
      botonAuth.onclick = null;
    }
  }

  const itemSaludo = document.getElementById("navSaludoItem");
  const botonSaludo = document.getElementById("saludoUsuario");
  if (itemSaludo && botonSaludo) {
    if (sesion) {
      const primerNombre = sesion.nombre_completo.split(" ")[0];
      botonSaludo.innerHTML =
        '<i class="bi bi-person-circle" aria-hidden="true"></i> ' + escaparHtml(primerNombre) +
        ' <span class="badge rounded-pill badge-rol">' + escaparHtml(sesion.nombre_rol || "") + "</span>";
      botonSaludo.setAttribute("title", "Cambiar mi contraseña");
      botonSaludo.onclick = abrirModalCambioPassword;
      itemSaludo.classList.remove("d-none");
    } else {
      itemSaludo.classList.add("d-none");
    }
  }

  // Enlaces a páginas privadas cuando no hay sesión: se envía al login.
  document.querySelectorAll("[data-protected-link]").forEach(function (enlace) {
    enlace.addEventListener("click", function (evento) {
      if (obtenerSesion()) return;
      evento.preventDefault();
      window.location.href = "login.html?destino=" + encodeURIComponent(enlace.getAttribute("href"));
    });
  });
}

/* =========================================================
   4. Utilidades
   ========================================================= */

/** Evita inyección de HTML/JS (XSS) al pintar datos que escribió un usuario (nombres, motivos...). */
function escaparHtml(valor) {
  return String(valor === null || valor === undefined ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const dosDigitos = function (n) { return String(n).padStart(2, "0"); };

/** "AAAA-MM-DD" en hora LOCAL (toISOString usa UTC y después de las 7 p. m. ya da el día siguiente). */
function fechaLocalISO(fecha) {
  const f = fecha || new Date();
  return f.getFullYear() + "-" + dosDigitos(f.getMonth() + 1) + "-" + dosDigitos(f.getDate());
}

function sumarDiasISO(fechaISO, dias) {
  const partes = fechaISO.split("-").map(Number);
  return fechaLocalISO(new Date(partes[0], partes[1] - 1, partes[2] + dias));
}

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "2026-06-03" -> "mié 03/06/2026" */
function formatearFecha(fechaISO, conDia) {
  if (!fechaISO) return "—";
  const partes = String(fechaISO).slice(0, 10).split("-");
  const texto = partes[2] + "/" + partes[1] + "/" + partes[0];
  if (conDia === false) return texto;
  const dia = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2])).getDay();
  return DIAS_CORTOS[dia] + " " + texto;
}

/** "08:00:00" -> "08:00" */
function formatearHora(hora) {
  return hora ? String(hora).slice(0, 5) : "";
}

/** Timestamp de la API -> "08:05" en hora local. */
function formatearHoraDeTimestamp(valor) {
  if (!valor) return "—";
  const fecha = new Date(valor);
  return dosDigitos(fecha.getHours()) + ":" + dosDigitos(fecha.getMinutes());
}

/** Timestamp -> "03/06/2026 08:05" */
function formatearFechaHora(valor) {
  if (!valor) return "—";
  const fecha = new Date(valor);
  return formatearFecha(fechaLocalISO(fecha), false) + " " + formatearHoraDeTimestamp(valor);
}

const FORMATO_PESOS = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** 1519500 -> "$ 1.519.500" */
function formatearMoneda(valor) {
  return FORMATO_PESOS.format(Number(valor) || 0);
}

/** 39.5 -> "39,5" */
function formatearNumero(valor) {
  return (Number(valor) || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

function obtenerFranjaHoraria(horaInicio) {
  const hora = Number(String(horaInicio || "00").slice(0, 2));
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
  justificado: { etiqueta: "Justificado", clase: "badge-asistencia-justificado" },
};

function badgeEstadoAsistencia(turno) {
  const info = ESTADOS_ASISTENCIA_INFO[turno.estado_asistencia] || ESTADOS_ASISTENCIA_INFO.pendiente;
  let etiqueta = info.etiqueta;
  if (turno.estado_asistencia === "justificado" && turno.justificacion) etiqueta = turno.justificacion;
  if (turno.hora_entrada && !turno.hora_salida) etiqueta += " · en turno";
  return '<span class="badge badge-estado ' + info.clase + '">' + escaparHtml(etiqueta) + "</span>";
}

function badgeHorario(turno) {
  return '<span class="badge ' + obtenerClaseBadgeTurno(turno.hora_inicio) + '">' +
    formatearHora(turno.hora_inicio) + " - " + formatearHora(turno.hora_fin) + "</span>";
}

/** Llena un <select> con opciones, conservando las opciones fijas que ya tenía (ej. "Todas"). */
function llenarSelect(select, elementos, obtenerValor, obtenerTexto) {
  if (!select) return;
  elementos.forEach(function (elemento) {
    const opcion = document.createElement("option");
    opcion.value = obtenerValor(elemento);
    opcion.textContent = obtenerTexto(elemento);
    select.appendChild(opcion);
  });
}

/** Fila única de "cargando / vacío / error" dentro de una tabla. */
function filaMensaje(cuerpoTabla, columnas, texto, clase) {
  cuerpoTabla.innerHTML =
    '<tr><td colspan="' + columnas + '" class="text-center py-4 ' + (clase || "text-muted") + '">' + escaparHtml(texto) + "</td></tr>";
}

/**
 * Descarga un CSV que abre bien en Excel (separador ";" y BOM UTF-8 para las tildes).
 * @param {string} nombreArchivo
 * @param {{titulo: string, valor: function}[]} columnas
 * @param {object[]} filas
 */
function exportarCSV(nombreArchivo, columnas, filas) {
  const celda = function (valor) {
    const texto = String(valor === null || valor === undefined ? "" : valor);
    return /[";\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  };
  const lineas = [columnas.map(function (c) { return celda(c.titulo); }).join(";")];
  filas.forEach(function (fila) {
    lineas.push(columnas.map(function (c) { return celda(c.valor(fila)); }).join(";"));
  });

  const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(function () { URL.revokeObjectURL(enlace.href); }, 1000);
}

/* =========================================================
   5. Notificaciones y diálogo de confirmación
   -----------------------------------------------------------
   Reemplazan a window.alert/confirm: se ven igual que el resto
   del sitio, respetan el tema oscuro y son accesibles.
   ========================================================= */

/** @param {"success"|"danger"|"warning"|"info"} tipo */
function mostrarNotificacion(mensaje, tipo) {
  let contenedor = document.getElementById("contenedorNotificaciones");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "contenedorNotificaciones";
    contenedor.className = "toast-container position-fixed top-0 end-0 p-3";
    contenedor.style.zIndex = "1090";
    document.body.appendChild(contenedor);
  }

  const claseTipo = { success: "text-bg-success", danger: "text-bg-danger", warning: "text-bg-warning", info: "text-bg-primary" }[tipo || "success"];
  const toast = document.createElement("div");
  toast.className = "toast align-items-center border-0 " + claseTipo;
  toast.setAttribute("role", tipo === "danger" ? "alert" : "status");
  toast.setAttribute("aria-live", tipo === "danger" ? "assertive" : "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.innerHTML =
    '<div class="d-flex"><div class="toast-body">' + escaparHtml(mensaje) + "</div>" +
    '<button type="button" class="btn-close ' + (tipo === "warning" ? "" : "btn-close-white") + ' me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button></div>';
  contenedor.appendChild(toast);

  const instancia = new bootstrap.Toast(toast, { delay: tipo === "danger" ? 7000 : 4500 });
  toast.addEventListener("hidden.bs.toast", function () { toast.remove(); });
  instancia.show();
}

/**
 * Diálogo de confirmación con Bootstrap. Devuelve una promesa:
 *   { confirmado: boolean, texto: string }
 * @param {{ titulo, mensaje, textoBoton?, claseBoton?, campoTexto?: { etiqueta, requerido?, minimo?, placeholder? } }} opciones
 */
function confirmarAccion(opciones) {
  return new Promise(function (resolver) {
    const idCampo = "campoConfirmacion" + Date.now();
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.tabIndex = -1;
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-labelledby", idCampo + "Titulo");

    const campo = opciones.campoTexto
      ? '<label for="' + idCampo + '" class="form-label mt-3">' + escaparHtml(opciones.campoTexto.etiqueta) + "</label>" +
        '<textarea class="form-control" id="' + idCampo + '" rows="3" maxlength="500" placeholder="' + escaparHtml(opciones.campoTexto.placeholder || "") + '"></textarea>' +
        '<div class="invalid-feedback">Este campo es obligatorio (mínimo ' + (opciones.campoTexto.minimo || 1) + " caracteres).</div>"
      : "";

    modal.innerHTML =
      '<div class="modal-dialog"><div class="modal-content">' +
      '<div class="modal-header"><h2 class="modal-title h5" id="' + idCampo + 'Titulo">' + escaparHtml(opciones.titulo) + "</h2>" +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>' +
      '<div class="modal-body"><p class="mb-0">' + escaparHtml(opciones.mensaje) + "</p>" + campo + "</div>" +
      '<div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>' +
      '<button type="button" class="btn ' + (opciones.claseBoton || "btn-primary") + '" data-confirmar>' + escaparHtml(opciones.textoBoton || "Confirmar") + "</button></div>" +
      "</div></div>";
    document.body.appendChild(modal);

    const instancia = new bootstrap.Modal(modal);
    let resultado = { confirmado: false, texto: "" };

    modal.querySelector("[data-confirmar]").addEventListener("click", function () {
      const areaTexto = modal.querySelector("textarea");
      const texto = areaTexto ? areaTexto.value.trim() : "";
      if (areaTexto && opciones.campoTexto.requerido && texto.length < (opciones.campoTexto.minimo || 1)) {
        areaTexto.classList.add("is-invalid");
        areaTexto.focus();
        return;
      }
      resultado = { confirmado: true, texto: texto };
      instancia.hide();
    });

    modal.addEventListener("shown.bs.modal", function () {
      const enfocable = modal.querySelector("textarea") || modal.querySelector("[data-confirmar]");
      enfocable.focus();
    });
    modal.addEventListener("hidden.bs.modal", function () {
      modal.remove();
      resolver(resultado);
    });
    instancia.show();
  });
}

/* =========================================================
   6. Cambio de contraseña propia (desde el saludo del menú)
   ========================================================= */

function abrirModalCambioPassword() {
  const sesion = obtenerSesion();
  if (!sesion) return;

  let modal = document.getElementById("modalCambioPassword");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "modalCambioPassword";
    modal.tabIndex = -1;
    modal.setAttribute("aria-labelledby", "modalCambioPasswordLabel");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="modal-dialog"><div class="modal-content"><form id="formCambioPassword" novalidate>' +
      '<div class="modal-header"><h2 class="modal-title h5" id="modalCambioPasswordLabel">Cambiar mi contraseña</h2>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>' +
      '<div class="modal-body">' +
      '<div class="alert alert-danger d-none" role="alert" id="errorCambioPassword"></div>' +
      '<div class="mb-3"><label class="form-label" for="passwordActualPropia">Contraseña actual</label>' +
      '<input type="password" class="form-control" id="passwordActualPropia" autocomplete="current-password" required></div>' +
      '<div class="mb-3"><label class="form-label" for="passwordNuevaPropia">Nueva contraseña</label>' +
      '<input type="password" class="form-control" id="passwordNuevaPropia" autocomplete="new-password" required aria-describedby="ayudaPasswordPropia">' +
      '<div class="form-text" id="ayudaPasswordPropia">Mínimo 8 caracteres, combinando letras y números.</div></div>' +
      '<div class="mb-1"><label class="form-label" for="passwordConfirmaPropia">Confirmar nueva contraseña</label>' +
      '<input type="password" class="form-control" id="passwordConfirmaPropia" autocomplete="new-password" required></div>' +
      "</div>" +
      '<div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Guardar</button></div>' +
      "</form></div></div>";
    document.body.appendChild(modal);

    modal.querySelector("form").addEventListener("submit", async function (evento) {
      evento.preventDefault();
      const alerta = document.getElementById("errorCambioPassword");
      const actual = document.getElementById("passwordActualPropia").value;
      const nueva = document.getElementById("passwordNuevaPropia").value;
      const confirma = document.getElementById("passwordConfirmaPropia").value;
      const boton = evento.target.querySelector('button[type="submit"]');

      const mostrarError = function (texto) {
        alerta.textContent = texto;
        alerta.classList.remove("d-none");
      };

      if (!actual || !nueva || !confirma) return mostrarError("Complete todos los campos.");
      if (nueva !== confirma) return mostrarError("La confirmación no coincide con la nueva contraseña.");
      if (nueva.length < 8 || !/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) {
        return mostrarError("La nueva contraseña debe tener mínimo 8 caracteres, con letras y números.");
      }

      boton.disabled = true;
      try {
        await usuarioService.cambiarPassword(obtenerSesion().id_usuario, nueva, actual);
        bootstrap.Modal.getInstance(modal).hide();
        mostrarNotificacion("Contraseña actualizada correctamente.");
      } catch (error) {
        mostrarError(error.message);
      } finally {
        boton.disabled = false;
      }
    });

    modal.addEventListener("hidden.bs.modal", function () {
      modal.querySelector("form").reset();
      document.getElementById("errorCambioPassword").classList.add("d-none");
    });
  }

  bootstrap.Modal.getOrCreateInstance(modal).show();
}

/* =========================================================
   Arranque común
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  inicializarTema();
  marcarEnlaceActivo();
  inicializarNavegacion();

  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get("acceso") === "denegado") {
    mostrarNotificacion("No tiene permisos para acceder a esa sección.", "warning");
  }
});
