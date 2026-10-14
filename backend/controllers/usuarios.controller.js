/**
 * controllers/usuarios.controller.js
 * -----------------------------------------------------------
 * CRUD de usuarios + login, con bloqueo tras 5 intentos fallidos
 * (RF-10 del SRS de PeopleManager) y eliminación lógica (RF-03).
 *
 * Reglas de permisos (además de las rutas):
 *   - Solo un Administrador puede crear, editar o desactivar a otro
 *     Administrador, o dar ese rol (RRHH no puede "ascenderse").
 *   - Nadie puede desactivarse ni quitarse el acceso a sí mismo.
 */

const bcrypt = require("bcryptjs");
const usuariosModel = require("../models/usuarios.model");
const catalogosModel = require("../models/catalogos.model");
const auditoria = require("../models/auditoria.model");
const { crearToken, DURACION_HORAS } = require("../utils/token");
const { ROLES, ADMINISTRAN_USUARIOS, esGestor } = require("../config/roles");
const { esCorreoValido, esDocumentoValido, esIdValido, validarPassword } = require("../utils/validaciones");

const RONDAS_SAL = 10;
const TABLA = "pm.usuarios";

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

/** Valida los campos comunes de crear/actualizar. Devuelve un mensaje de error o null. */
const validarDatosUsuario = ({ nombre_completo, correo, id_rol, id_area, id_cargo }) => {
  if (nombre_completo.length < 3 || nombre_completo.length > 150) {
    return "El nombre completo debe tener entre 3 y 150 caracteres";
  }
  if (!esCorreoValido(correo)) return "El correo electrónico no tiene un formato válido";
  if (!esIdValido(id_rol)) return "Debe seleccionar un rol válido";
  if (id_area && !esIdValido(id_area)) return "El área seleccionada no es válida";
  if (id_cargo && !esIdValido(id_cargo)) return "El cargo seleccionado no es válido";
  return null;
};

const nombreDelRol = async (idRol) => {
  const roles = await catalogosModel.obtenerRoles();
  const rol = roles.find((r) => String(r.id_rol) === String(idRol));
  return rol ? rol.nombre_rol : null;
};

const obtenerTodos = async (req, res) => {
  const { estado } = req.query;
  if (estado && !["activo", "inactivo"].includes(estado)) {
    return res.status(400).json({ mensaje: "El estado debe ser 'activo' o 'inactivo'" });
  }
  res.status(200).json(await usuariosModel.obtenerTodos({ estado }));
};

const obtenerPorId = async (req, res) => {
  const { id } = req.params;

  // Un empleado solo puede consultar su propio perfil.
  if (!esGestor(req.usuario) && Number(id) !== req.usuario.id_usuario) {
    return res.status(403).json({ mensaje: "Solo puede consultar su propio perfil" });
  }

  const usuario = await usuariosModel.obtenerPorId(id);
  if (!usuario) return res.status(404).json({ mensaje: "Usuario no encontrado" });
  res.status(200).json(usuario);
};

const crear = async (req, res) => {
  const datos = {
    numero_documento: texto(String(req.body.numero_documento || "")),
    nombre_completo: texto(req.body.nombre_completo),
    correo: texto(req.body.correo).toLowerCase(),
    id_rol: req.body.id_rol,
    id_area: req.body.id_area || null,
    id_cargo: req.body.id_cargo || null,
  };
  const { password } = req.body;

  if (!datos.numero_documento || !datos.nombre_completo || !datos.correo || !password || !datos.id_rol) {
    return res.status(400).json({
      mensaje: "Número de documento, nombre completo, correo, contraseña y rol son obligatorios",
    });
  }
  if (!esDocumentoValido(datos.numero_documento)) {
    return res.status(400).json({ mensaje: "El número de documento debe contener solo números (entre 5 y 20 dígitos)" });
  }
  const errorDatos = validarDatosUsuario(datos);
  if (errorDatos) return res.status(400).json({ mensaje: errorDatos });

  const errorPassword = validarPassword(password);
  if (errorPassword) return res.status(400).json({ mensaje: errorPassword });

  const rolNuevo = await nombreDelRol(datos.id_rol);
  if (!rolNuevo) return res.status(400).json({ mensaje: "El rol seleccionado no existe" });
  if (rolNuevo === ROLES.ADMIN && req.usuario.nombre_rol !== ROLES.ADMIN) {
    return res.status(403).json({ mensaje: "Solo un Administrador puede crear otro Administrador" });
  }

  if (await usuariosModel.existeCorreo(datos.correo)) {
    return res.status(409).json({ mensaje: "El correo ya está registrado" });
  }

  const contrasenaHash = await bcrypt.hash(password, RONDAS_SAL);

  let idNuevo;
  try {
    idNuevo = await usuariosModel.crear({ ...datos, contrasena_hash: contrasenaHash });
  } catch (error) {
    // "23505" es el código estándar de PostgreSQL para una violación de
    // restricción UNIQUE (correo o número de documento repetidos).
    if (error.code === "23505") {
      return res.status(409).json({ mensaje: "El correo o el número de documento ya están registrados" });
    }
    throw error;
  }

  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "CREAR_USUARIO",
    tabla: TABLA,
    id_registro: idNuevo,
    detalle: `Registro de ${datos.nombre_completo} (${rolNuevo})`,
  });

  res.status(201).json({ mensaje: "Usuario creado correctamente", id: idNuevo });
};

const actualizar = async (req, res) => {
  const id = Number(req.params.id);
  const datos = {
    nombre_completo: texto(req.body.nombre_completo),
    correo: texto(req.body.correo).toLowerCase(),
    id_rol: req.body.id_rol,
    id_area: req.body.id_area || null,
    id_cargo: req.body.id_cargo || null,
    estado: req.body.estado,
  };

  if (!datos.nombre_completo || !datos.correo || !datos.id_rol || !datos.estado) {
    return res.status(400).json({ mensaje: "Nombre, correo, rol y estado son obligatorios" });
  }
  if (!["activo", "inactivo"].includes(datos.estado)) {
    return res.status(400).json({ mensaje: "El estado debe ser 'activo' o 'inactivo'" });
  }
  const errorDatos = validarDatosUsuario(datos);
  if (errorDatos) return res.status(400).json({ mensaje: errorDatos });

  const actual = await usuariosModel.obtenerPorId(id);
  if (!actual) return res.status(404).json({ mensaje: "Usuario no encontrado" });

  const rolNuevo = await nombreDelRol(datos.id_rol);
  if (!rolNuevo) return res.status(400).json({ mensaje: "El rol seleccionado no existe" });

  const esAdmin = req.usuario.nombre_rol === ROLES.ADMIN;
  if (!esAdmin && (actual.nombre_rol === ROLES.ADMIN || rolNuevo === ROLES.ADMIN)) {
    return res.status(403).json({ mensaje: "Solo un Administrador puede modificar a un Administrador o asignar ese rol" });
  }

  if (id === req.usuario.id_usuario) {
    if (datos.estado !== "activo") {
      return res.status(400).json({ mensaje: "No puede desactivar su propio usuario" });
    }
    if (rolNuevo !== actual.nombre_rol) {
      return res.status(400).json({ mensaje: "No puede cambiar su propio rol; pídaselo a otro administrador" });
    }
  }

  if (await usuariosModel.existeCorreo(datos.correo, id)) {
    return res.status(409).json({ mensaje: "El correo ya está registrado" });
  }

  try {
    await usuariosModel.actualizar(id, datos);
  } catch (error) {
    // Código de PostgreSQL para UNIQUE (antes se validaba ER_DUP_ENTRY, que es de MySQL).
    if (error.code === "23505") {
      return res.status(409).json({ mensaje: "El correo ya está registrado" });
    }
    throw error;
  }

  const cambios = [];
  if (actual.nombre_rol !== rolNuevo) cambios.push(`rol ${actual.nombre_rol} → ${rolNuevo}`);
  if (actual.estado !== datos.estado) cambios.push(`estado ${actual.estado} → ${datos.estado}`);
  if (actual.correo !== datos.correo) cambios.push("correo actualizado");

  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "ACTUALIZAR_USUARIO",
    tabla: TABLA,
    id_registro: id,
    detalle: `Actualización de ${datos.nombre_completo}${cambios.length ? ": " + cambios.join(", ") : ""}`,
  });

  res.status(200).json({ mensaje: "Usuario actualizado correctamente" });
};

/** Eliminación lógica: el usuario queda "inactivo" y pierde acceso, pero su historial no se borra. */
const eliminar = async (req, res) => {
  const id = Number(req.params.id);

  if (id === req.usuario.id_usuario) {
    return res.status(400).json({ mensaje: "No puede desactivar su propio usuario" });
  }

  const actual = await usuariosModel.obtenerPorId(id);
  if (!actual) return res.status(404).json({ mensaje: "Usuario no encontrado" });
  if (actual.nombre_rol === ROLES.ADMIN && req.usuario.nombre_rol !== ROLES.ADMIN) {
    return res.status(403).json({ mensaje: "Solo un Administrador puede desactivar a otro Administrador" });
  }
  if (actual.estado === "inactivo") {
    return res.status(409).json({ mensaje: "El usuario ya se encuentra inactivo" });
  }

  await usuariosModel.eliminarLogico(id);
  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "DESACTIVAR_USUARIO",
    tabla: TABLA,
    id_registro: id,
    detalle: `Desactivación lógica de ${actual.nombre_completo}`,
  });

  res.status(200).json({ mensaje: "Usuario desactivado correctamente" });
};

const desbloquear = async (req, res) => {
  const id = Number(req.params.id);
  const actual = await usuariosModel.obtenerPorId(id);
  if (!actual) return res.status(404).json({ mensaje: "Usuario no encontrado" });
  if (!actual.bloqueado) return res.status(409).json({ mensaje: "La cuenta no está bloqueada" });

  await usuariosModel.desbloquear(id);
  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "DESBLOQUEAR_USUARIO",
    tabla: TABLA,
    id_registro: id,
    detalle: `Desbloqueo manual de la cuenta de ${actual.nombre_completo}`,
  });

  res.status(200).json({ mensaje: "Cuenta desbloqueada correctamente" });
};

/**
 * Cambio de contraseña.
 *   - El propio usuario: debe enviar password_actual.
 *   - Administrador / RRHH sobre otro usuario: restablecimiento sin la actual.
 */
const cambiarPassword = async (req, res) => {
  const id = Number(req.params.id);
  const { password_actual, password_nueva } = req.body;
  const esPropio = id === req.usuario.id_usuario;
  const puedeRestablecer = ADMINISTRAN_USUARIOS.includes(req.usuario.nombre_rol);

  if (!esPropio && !puedeRestablecer) {
    return res.status(403).json({ mensaje: "Solo puede cambiar su propia contraseña" });
  }

  const errorPassword = validarPassword(password_nueva);
  if (errorPassword) return res.status(400).json({ mensaje: errorPassword });

  const actual = await usuariosModel.obtenerPorId(id);
  if (!actual) return res.status(404).json({ mensaje: "Usuario no encontrado" });

  if (!esPropio && actual.nombre_rol === ROLES.ADMIN && req.usuario.nombre_rol !== ROLES.ADMIN) {
    return res.status(403).json({ mensaje: "Solo un Administrador puede restablecer la contraseña de otro Administrador" });
  }

  if (esPropio) {
    if (!password_actual) return res.status(400).json({ mensaje: "Debe ingresar su contraseña actual" });
    const hashActual = await usuariosModel.obtenerHash(id);
    if (!(await bcrypt.compare(password_actual, hashActual))) {
      return res.status(400).json({ mensaje: "La contraseña actual no es correcta" });
    }
    if (password_actual === password_nueva) {
      return res.status(400).json({ mensaje: "La nueva contraseña debe ser diferente de la actual" });
    }
  }

  await usuariosModel.actualizarPassword(id, await bcrypt.hash(password_nueva, RONDAS_SAL));
  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: esPropio ? "CAMBIAR_PASSWORD" : "RESTABLECER_PASSWORD",
    tabla: TABLA,
    id_registro: id,
    detalle: esPropio ? "Cambio de contraseña propia" : `Restablecimiento de contraseña de ${actual.nombre_completo}`,
  });

  res.status(200).json({ mensaje: "Contraseña actualizada correctamente" });
};

const login = async (req, res) => {
  const correo = texto(req.body.correo);
  const { password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ mensaje: "Correo y contraseña son obligatorios" });
  }

  const usuario = await usuariosModel.obtenerPorCorreo(correo);

  if (!usuario) {
    // Mismo mensaje que cuando la contraseña no coincide, para no
    // revelar si un correo existe o no en la base de datos.
    return res.status(401).json({ mensaje: "Credenciales incorrectas" });
  }

  if (usuario.estado !== "activo") {
    return res.status(403).json({ mensaje: "El usuario se encuentra inactivo. Contacte al administrador." });
  }

  if (usuario.bloqueado) {
    return res.status(403).json({ mensaje: "La cuenta está bloqueada por intentos fallidos. Contacte al administrador." });
  }

  const passwordValida = await bcrypt.compare(password, usuario.contrasena_hash);

  if (!passwordValida) {
    const resultado = await usuariosModel.registrarIntentoFallido(usuario.id_usuario);
    if (resultado && resultado.bloqueado) {
      await auditoria.registrar({
        id_usuario: usuario.id_usuario,
        accion: "BLOQUEO_CUENTA",
        tabla: TABLA,
        id_registro: usuario.id_usuario,
        detalle: `Cuenta bloqueada tras ${usuariosModel.MAX_INTENTOS_FALLIDOS} intentos fallidos de inicio de sesión`,
      });
      return res.status(403).json({
        mensaje: `La cuenta ha sido bloqueada tras ${usuariosModel.MAX_INTENTOS_FALLIDOS} intentos fallidos. Contacte al administrador.`,
      });
    }
    return res.status(401).json({ mensaje: "Credenciales incorrectas" });
  }

  await usuariosModel.reiniciarIntentosFallidos(usuario.id_usuario);

  const datosSesion = {
    id_usuario: usuario.id_usuario,
    nombre_completo: usuario.nombre_completo,
    correo: usuario.correo,
    id_rol: usuario.id_rol,
    nombre_rol: usuario.nombre_rol,
    id_area: usuario.id_area,
  };

  res.status(200).json({
    mensaje: "Autenticación exitosa",
    token: crearToken({ id_usuario: usuario.id_usuario }),
    expira_en_horas: DURACION_HORAS,
    usuario: datosSesion,
  });
};

/** Devuelve los datos de quien tiene la sesión abierta (útil para refrescar el rol en el front-end). */
const perfil = async (req, res) => {
  res.status(200).json(await usuariosModel.obtenerPorId(req.usuario.id_usuario));
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  desbloquear,
  cambiarPassword,
  login,
  perfil,
};
