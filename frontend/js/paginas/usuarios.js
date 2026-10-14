/* =========================================================
   paginas/usuarios.js — Gestión de usuarios (usuarios.html)
   -----------------------------------------------------------
   Solo Administrador y RRHH. Permite crear, editar, desactivar
   (eliminación lógica), reactivar, desbloquear cuentas y
   restablecer contraseñas. RRHH no puede tocar a un
   Administrador ni asignar ese rol (el backend lo valida).
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const cuerpoTabla = document.getElementById("cuerpoTablaUsuarios");
  if (!cuerpoTabla) return;

  const sesion = exigirSesion(ROLES_ADMINISTRAN_USUARIOS);
  if (!sesion) return;

  const esAdmin = sesion.nombre_rol === ROLES.ADMIN;
  const COLUMNAS = 6;
  const $ = function (id) { return document.getElementById(id); };

  const campoBusqueda = $("buscarUsuario");
  const selectRolFiltro = $("filtroRolUsuario");
  const selectEstadoFiltro = $("filtroEstadoUsuario");
  const formUsuario = $("formUsuario");
  const modalUsuario = $("modalUsuario");
  const mensajeError = $("mensajeModalUsuario");

  let usuarios = [];
  let roles = [];

  // ---------- Carga ----------
  async function cargarCatalogos() {
    try {
      const respuestas = await Promise.all([catalogoService.obtenerRoles(), catalogoService.obtenerAreas(), catalogoService.obtenerCargos()]);
      roles = respuestas[0];
      llenarSelect(selectRolFiltro, roles, function (r) { return r.nombre_rol; }, function (r) { return r.nombre_rol; });
      // RRHH no ve la opción "Administrador" al crear/editar.
      llenarSelect($("usuarioRol"), roles.filter(function (r) { return esAdmin || r.nombre_rol !== ROLES.ADMIN; }),
        function (r) { return r.id_rol; }, function (r) { return r.nombre_rol + (r.descripcion ? " — " + r.descripcion : ""); });
      llenarSelect($("usuarioArea"), respuestas[1], function (a) { return a.id_area; }, function (a) { return a.nombre_area; });
      llenarSelect($("usuarioCargo"), respuestas[2], function (c) { return c.id_cargo; }, function (c) { return c.nombre_cargo + " (" + c.nivel + ")"; });
    } catch (error) {
      mostrarNotificacion("No se pudieron cargar los catálogos: " + error.message, "danger");
    }
  }

  async function cargarUsuarios() {
    filaMensaje(cuerpoTabla, COLUMNAS, "Cargando usuarios...");
    try {
      usuarios = await usuarioService.obtenerTodos();
      aplicarFiltrosYRenderizar();
    } catch (error) {
      filaMensaje(cuerpoTabla, COLUMNAS, error.message || "No se pudieron cargar los usuarios.", "text-danger");
    }
  }

  // ---------- Tabla ----------
  function aplicarFiltrosYRenderizar() {
    const texto = campoBusqueda.value.trim().toLowerCase();
    const rol = selectRolFiltro.value;
    const estado = selectEstadoFiltro.value;

    $("totalActivos").textContent = usuarios.filter(function (u) { return u.estado === "activo"; }).length;
    $("totalInactivos").textContent = usuarios.filter(function (u) { return u.estado === "inactivo"; }).length;
    $("totalBloqueados").textContent = usuarios.filter(function (u) { return u.bloqueado; }).length;

    const filtrados = usuarios.filter(function (u) {
      const coincideTexto = [u.nombre_completo, u.correo, u.numero_documento].join(" ").toLowerCase().includes(texto);
      const coincideRol = rol === "todos" || u.nombre_rol === rol;
      let coincideEstado = true;
      if (estado === "bloqueado") coincideEstado = u.bloqueado;
      else if (estado !== "todos") coincideEstado = u.estado === estado;
      return coincideTexto && coincideRol && coincideEstado;
    });

    renderizar(filtrados);
    $("contadorUsuarios").textContent = filtrados.length + (filtrados.length === 1 ? " usuario" : " usuarios");
  }

  function puedeGestionar(usuario) {
    return esAdmin || usuario.nombre_rol !== ROLES.ADMIN;
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
    if (lista.length === 0) {
      filaMensaje(cuerpoTabla, COLUMNAS, "No hay usuarios que coincidan con los filtros.");
      return;
    }

    lista.forEach(function (u) {
      const fila = document.createElement("tr");
      if (u.estado === "inactivo") fila.classList.add("fila-inactiva");

      let estado = u.estado === "activo"
        ? '<span class="badge badge-estado badge-estado-confirmado">Activo</span>'
        : '<span class="badge badge-estado badge-asistencia-sinmarcar">Inactivo</span>';
      if (u.bloqueado) estado += ' <span class="badge badge-estado badge-estado-cancelado"><i class="bi bi-lock-fill" aria-hidden="true"></i> Bloqueado</span>';
      else if (u.intentos_fallidos > 0) estado += '<div class="small text-muted">' + u.intentos_fallidos + " intento(s) fallido(s)</div>";

      fila.innerHTML =
        '<td><span class="fw-semibold">' + escaparHtml(u.nombre_completo) + "</span>" +
        (u.id_usuario === sesion.id_usuario ? ' <span class="badge text-bg-secondary">Tú</span>' : "") +
        '<div class="small text-muted">' + escaparHtml(u.correo) + "</div></td>" +
        "<td>" + escaparHtml(u.numero_documento) + "</td>" +
        '<td><span class="badge rounded-pill badge-rol">' + escaparHtml(u.nombre_rol || "—") + "</span></td>" +
        "<td>" + escaparHtml(u.nombre_area || "—") + '<div class="small text-muted">' + escaparHtml(u.nombre_cargo || "") + "</div></td>" +
        "<td>" + estado + "</td>" +
        '<td class="acciones-turno"></td>';

      const celda = fila.querySelector(".acciones-turno");
      if (!puedeGestionar(u)) {
        celda.innerHTML = '<span class="small text-muted">Solo Administrador</span>';
      } else {
        const grupo = document.createElement("div");
        grupo.className = "d-flex flex-wrap gap-1";
        grupo.appendChild(crearBoton("Editar", "bi-pencil", "btn-outline-primary", "Editar a " + u.nombre_completo, function () { abrirEdicion(u); }));
        if (u.id_usuario !== sesion.id_usuario) {
          grupo.appendChild(crearBoton("Contraseña", "bi-key", "btn-outline-secondary", "Restablecer contraseña de " + u.nombre_completo, function () { abrirRestablecer(u); }));
        }
        if (u.bloqueado) {
          grupo.appendChild(crearBoton("Desbloquear", "bi-unlock", "btn-warning", "Desbloquear la cuenta de " + u.nombre_completo, function () { desbloquear(u); }));
        }
        if (u.id_usuario !== sesion.id_usuario) {
          if (u.estado === "activo") {
            grupo.appendChild(crearBoton("Desactivar", "bi-person-dash", "btn-outline-danger", "Desactivar a " + u.nombre_completo, function () { desactivar(u); }));
          } else {
            grupo.appendChild(crearBoton("Reactivar", "bi-person-check", "btn-outline-success", "Reactivar a " + u.nombre_completo, function () { reactivar(u); }));
          }
        }
        celda.appendChild(grupo);
      }

      cuerpoTabla.appendChild(fila);
    });
  }

  // ---------- Acciones ----------
  async function desbloquear(u) {
    const r = await confirmarAccion({
      titulo: "Desbloquear cuenta",
      mensaje: "La cuenta de " + u.nombre_completo + " se bloqueó por intentos fallidos. ¿Desbloquearla y reiniciar el contador?",
      textoBoton: "Desbloquear",
      claseBoton: "btn-warning",
    });
    if (!r.confirmado) return;
    try {
      await usuarioService.desbloquear(u.id_usuario);
      mostrarNotificacion("Cuenta desbloqueada correctamente.");
      await cargarUsuarios();
    } catch (error) {
      mostrarNotificacion(error.message, "danger");
    }
  }

  async function desactivar(u) {
    const r = await confirmarAccion({
      titulo: "Desactivar usuario",
      mensaje: u.nombre_completo + " no podrá iniciar sesión y se cerrará su sesión actual. Su historial de turnos, asistencia y solicitudes se conserva (eliminación lógica).",
      textoBoton: "Desactivar",
      claseBoton: "btn-danger",
    });
    if (!r.confirmado) return;
    try {
      await usuarioService.eliminar(u.id_usuario);
      mostrarNotificacion("Usuario desactivado correctamente.");
      await cargarUsuarios();
    } catch (error) {
      mostrarNotificacion(error.message, "danger");
    }
  }

  async function reactivar(u) {
    const r = await confirmarAccion({
      titulo: "Reactivar usuario",
      mensaje: "¿Reactivar a " + u.nombre_completo + "? Podrá volver a iniciar sesión con su contraseña actual.",
      textoBoton: "Reactivar",
      claseBoton: "btn-success",
    });
    if (!r.confirmado) return;
    try {
      await usuarioService.actualizar(u.id_usuario, {
        nombre_completo: u.nombre_completo, correo: u.correo, id_rol: u.id_rol, id_area: u.id_area, id_cargo: u.id_cargo, estado: "activo",
      });
      mostrarNotificacion("Usuario reactivado correctamente.");
      await cargarUsuarios();
    } catch (error) {
      mostrarNotificacion(error.message, "danger");
    }
  }

  // ---------- Modal crear / editar ----------
  function mostrarError(texto) {
    mensajeError.textContent = texto;
    mensajeError.classList.remove("d-none");
    mensajeError.focus();
  }

  function prepararModal(usuario) {
    formUsuario.reset();
    mensajeError.classList.add("d-none");
    const editando = Boolean(usuario);
    $("usuarioIdEditando").value = editando ? usuario.id_usuario : "";
    $("modalUsuarioLabel").textContent = editando ? "Editar usuario" : "Nuevo usuario";
    $("btnGuardarUsuario").textContent = editando ? "Guardar cambios" : "Crear usuario";
    $("usuarioDocumento").disabled = editando; // el documento de identidad no se cambia
    $("grupoPasswordUsuario").classList.toggle("d-none", editando);
    $("grupoEstadoUsuario").classList.toggle("d-none", !editando);

    if (editando) {
      $("usuarioDocumento").value = usuario.numero_documento;
      $("usuarioNombre").value = usuario.nombre_completo;
      $("usuarioCorreo").value = usuario.correo;
      $("usuarioRol").value = usuario.id_rol;
      $("usuarioArea").value = usuario.id_area || "";
      $("usuarioCargo").value = usuario.id_cargo || "";
      $("usuarioEstado").value = usuario.estado;
      // Nadie se cambia su propio rol ni se desactiva a sí mismo.
      const esPropio = usuario.id_usuario === sesion.id_usuario;
      $("usuarioRol").disabled = esPropio;
      $("usuarioEstado").disabled = esPropio;
    } else {
      $("usuarioRol").disabled = false;
      $("usuarioEstado").disabled = false;
    }
  }

  function abrirEdicion(usuario) {
    prepararModal(usuario);
    bootstrap.Modal.getOrCreateInstance(modalUsuario).show();
  }

  $("btnNuevoUsuario").addEventListener("click", function () {
    prepararModal(null);
    bootstrap.Modal.getOrCreateInstance(modalUsuario).show();
  });

  function passwordValida(password) {
    return password.length >= 8 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) && /\d/.test(password);
  }

  formUsuario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const idEditando = $("usuarioIdEditando").value;
    const datos = {
      numero_documento: $("usuarioDocumento").value.trim(),
      nombre_completo: $("usuarioNombre").value.trim(),
      correo: $("usuarioCorreo").value.trim(),
      id_rol: $("usuarioRol").value,
      id_area: $("usuarioArea").value || null,
      id_cargo: $("usuarioCargo").value || null,
    };

    if (!datos.nombre_completo || !datos.correo || !datos.id_rol) return mostrarError("Nombre, correo y rol son obligatorios.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) return mostrarError("El correo no tiene un formato válido.");

    if (!idEditando) {
      const password = $("usuarioPassword").value;
      if (!/^\d{5,20}$/.test(datos.numero_documento)) return mostrarError("El documento debe tener solo números (entre 5 y 20 dígitos).");
      if (!passwordValida(password)) return mostrarError("La contraseña debe tener mínimo 8 caracteres, con letras y números.");
      if (password !== $("usuarioPasswordConfirma").value) return mostrarError("La confirmación de la contraseña no coincide.");
      datos.password = password;
    } else {
      datos.estado = $("usuarioEstado").value;
    }

    const boton = $("btnGuardarUsuario");
    boton.disabled = true;
    try {
      if (idEditando) await usuarioService.actualizar(idEditando, datos);
      else await usuarioService.crear(datos);
      bootstrap.Modal.getOrCreateInstance(modalUsuario).hide();
      mostrarNotificacion(idEditando ? "Usuario actualizado correctamente." : "Usuario creado correctamente. Ya puede iniciar sesión.");
      await cargarUsuarios();
    } catch (error) {
      mostrarError(error.message || "No se pudo guardar el usuario.");
    } finally {
      boton.disabled = false;
    }
  });

  // ---------- Modal restablecer contraseña ----------
  const modalRestablecer = $("modalRestablecer");
  const formRestablecer = $("formRestablecer");
  const errorRestablecer = $("mensajeRestablecer");

  function abrirRestablecer(usuario) {
    formRestablecer.reset();
    errorRestablecer.classList.add("d-none");
    $("restablecerId").value = usuario.id_usuario;
    $("restablecerNombre").textContent = usuario.nombre_completo;
    bootstrap.Modal.getOrCreateInstance(modalRestablecer).show();
  }

  $("btnGenerarPassword").addEventListener("click", function () {
    // Contraseña temporal aleatoria que cumple la política (letras + números).
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const numeros = "23456789";
    const aleatorio = new Uint32Array(10);
    crypto.getRandomValues(aleatorio);
    let password = "";
    aleatorio.forEach(function (n, i) { password += i < 7 ? letras[n % letras.length] : numeros[n % numeros.length]; });
    $("restablecerPassword").value = password;
    $("restablecerPassword").type = "text";
  });

  formRestablecer.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const password = $("restablecerPassword").value;
    if (!passwordValida(password)) {
      errorRestablecer.textContent = "La contraseña debe tener mínimo 8 caracteres, con letras y números.";
      errorRestablecer.classList.remove("d-none");
      return;
    }
    const boton = formRestablecer.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      await usuarioService.cambiarPassword($("restablecerId").value, password);
      bootstrap.Modal.getOrCreateInstance(modalRestablecer).hide();
      mostrarNotificacion("Contraseña restablecida. Compártala de forma segura con el usuario.");
    } catch (error) {
      errorRestablecer.textContent = error.message;
      errorRestablecer.classList.remove("d-none");
    } finally {
      boton.disabled = false;
    }
  });

  modalRestablecer.addEventListener("hidden.bs.modal", function () {
    $("restablecerPassword").type = "password";
  });

  // ---------- Filtros ----------
  campoBusqueda.addEventListener("input", aplicarFiltrosYRenderizar);
  selectRolFiltro.addEventListener("change", aplicarFiltrosYRenderizar);
  selectEstadoFiltro.addEventListener("change", aplicarFiltrosYRenderizar);

  cargarCatalogos().then(cargarUsuarios);
});
