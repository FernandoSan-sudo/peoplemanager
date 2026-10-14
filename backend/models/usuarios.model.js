/**
 * models/usuarios.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.usuarios. Los SELECT que exponen la
 * lista o el detalle de un usuario nunca incluyen la contraseña
 * (ni el hash), salvo obtenerPorCorreo y obtenerHash, de uso
 * interno exclusivo del login y del cambio de contraseña.
 *
 * Los SELECT hacen JOIN con roles/areas/cargos para devolver el
 * nombre legible (nombre_rol, nombre_area, nombre_cargo) y no
 * solo el id.
 */

const pool = require("../config/database");

const MAX_INTENTOS_FALLIDOS = 5;

const CAMPOS_PUBLICOS = `
  u.id_usuario, u.numero_documento, u.nombre_completo, u.correo,
  u.id_rol, r.nombre_rol,
  u.id_area, a.nombre_area,
  u.id_cargo, c.nombre_cargo,
  u.estado, u.bloqueado, u.intentos_fallidos, u.fecha_creacion, u.fecha_modificacion
`;

const JOINS = `
  FROM usuarios u
  LEFT JOIN roles r ON r.id_rol = u.id_rol
  LEFT JOIN areas a ON a.id_area = u.id_area
  LEFT JOIN cargos c ON c.id_cargo = u.id_cargo
`;

const obtenerTodos = async ({ estado } = {}) => {
  const valores = [];
  let filtro = "";
  if (estado) {
    valores.push(estado);
    filtro = "WHERE u.estado = $1";
  }
  const { rows } = await pool.query(`SELECT ${CAMPOS_PUBLICOS} ${JOINS} ${filtro} ORDER BY u.nombre_completo`, valores);
  return rows;
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(`SELECT ${CAMPOS_PUBLICOS} ${JOINS} WHERE u.id_usuario = $1`, [id]);
  return rows[0] || null;
};

/** Datos mínimos que el middleware de autenticación revisa en cada petición. */
const obtenerDatosSesion = async (id) => {
  const sql = `
    SELECT u.id_usuario, u.nombre_completo, u.correo, u.estado, u.bloqueado, u.id_area, u.id_rol, r.nombre_rol
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
};

/** Uso interno exclusivo del login: incluye contrasena_hash, intentos_fallidos y bloqueado. El correo no distingue mayúsculas. */
const obtenerPorCorreo = async (correo) => {
  const sql = `
    SELECT u.id_usuario, u.nombre_completo, u.correo, u.contrasena_hash, u.estado,
           u.intentos_fallidos, u.bloqueado, u.id_rol, r.nombre_rol, u.id_area
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE LOWER(u.correo) = LOWER($1)
  `;
  const { rows } = await pool.query(sql, [correo]);
  return rows[0] || null;
};

const obtenerHash = async (id) => {
  const { rows } = await pool.query("SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1", [id]);
  return rows[0] ? rows[0].contrasena_hash : null;
};

/** ¿Existe otro usuario con ese correo (sin importar mayúsculas)? Sirve para dar un 409 claro antes del INSERT/UPDATE. */
const existeCorreo = async (correo, excluirId = null) => {
  const { rows } = await pool.query(
    "SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER($1) AND ($2::int IS NULL OR id_usuario <> $2)",
    [correo, excluirId]
  );
  return rows.length > 0;
};

const crear = async (usuario) => {
  const sql = `
    INSERT INTO usuarios (numero_documento, nombre_completo, correo, contrasena_hash, id_rol, id_area, id_cargo)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id_usuario
  `;
  const { rows } = await pool.query(sql, [
    usuario.numero_documento,
    usuario.nombre_completo,
    usuario.correo,
    usuario.contrasena_hash,
    usuario.id_rol,
    usuario.id_area || null,
    usuario.id_cargo || null,
  ]);
  return rows[0].id_usuario;
};

/** Devuelve la cantidad de filas actualizadas (0 = el usuario no existe). */
const actualizar = async (id, usuario) => {
  const sql = `
    UPDATE usuarios
    SET nombre_completo = $1, correo = $2, id_rol = $3, id_area = $4, id_cargo = $5,
        estado = $6, fecha_modificacion = CURRENT_TIMESTAMP
    WHERE id_usuario = $7
  `;
  const { rowCount } = await pool.query(sql, [
    usuario.nombre_completo,
    usuario.correo,
    usuario.id_rol,
    usuario.id_area || null,
    usuario.id_cargo || null,
    usuario.estado,
    id,
  ]);
  return rowCount;
};

/** Eliminación lógica (RF-03): marca el usuario como inactivo, no borra la fila ni su historial relacionado. */
const eliminarLogico = async (id) => {
  const { rowCount } = await pool.query(
    "UPDATE usuarios SET estado = 'inactivo', fecha_modificacion = CURRENT_TIMESTAMP WHERE id_usuario = $1",
    [id]
  );
  return rowCount;
};

/**
 * Suma un intento fallido y bloquea al llegar al máximo. Se hace en una
 * sola sentencia (intentos_fallidos + 1) para que dos intentos simultáneos
 * no se "pisen" y cuenten como uno solo.
 */
const registrarIntentoFallido = async (idUsuario) => {
  const sql = `
    UPDATE usuarios
    SET intentos_fallidos = COALESCE(intentos_fallidos, 0) + 1,
        bloqueado = (COALESCE(intentos_fallidos, 0) + 1) >= $2
    WHERE id_usuario = $1
    RETURNING intentos_fallidos, bloqueado
  `;
  const { rows } = await pool.query(sql, [idUsuario, MAX_INTENTOS_FALLIDOS]);
  return rows[0];
};

const reiniciarIntentosFallidos = async (idUsuario) => {
  await pool.query("UPDATE usuarios SET intentos_fallidos = 0 WHERE id_usuario = $1", [idUsuario]);
};

/** Desbloqueo manual por un administrador: reinicia el contador y quita el bloqueo. */
const desbloquear = async (id) => {
  const { rowCount } = await pool.query(
    "UPDATE usuarios SET bloqueado = FALSE, intentos_fallidos = 0, fecha_modificacion = CURRENT_TIMESTAMP WHERE id_usuario = $1",
    [id]
  );
  return rowCount;
};

const actualizarPassword = async (id, contrasenaHash) => {
  const { rowCount } = await pool.query(
    "UPDATE usuarios SET contrasena_hash = $1, fecha_modificacion = CURRENT_TIMESTAMP WHERE id_usuario = $2",
    [contrasenaHash, id]
  );
  return rowCount;
};

module.exports = {
  MAX_INTENTOS_FALLIDOS,
  obtenerTodos,
  obtenerPorId,
  obtenerDatosSesion,
  obtenerPorCorreo,
  obtenerHash,
  existeCorreo,
  crear,
  actualizar,
  eliminarLogico,
  registrarIntentoFallido,
  reiniciarIntentosFallidos,
  desbloquear,
  actualizarPassword,
};
