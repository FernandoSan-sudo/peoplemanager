/**
 * models/usuarios.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.usuarios. Los SELECT que exponen la
 * lista o el detalle de un usuario nunca incluyen la contraseña
 * (ni el hash), salvo obtenerPorCorreo, de uso interno exclusivo
 * del proceso de login.
 *
 * Los SELECT hacen JOIN con roles/areas/cargos para devolver el
 * nombre legible (nombre_rol, nombre_area, nombre_cargo) y no
 * solo el id, que es lo que necesita el front-end para mostrar
 * información sin tener que hacer una consulta aparte por cada
 * usuario.
 */

const pool = require("../config/database");

const CAMPOS_PUBLICOS = `
  u.id_usuario, u.numero_documento, u.nombre_completo, u.correo,
  u.id_rol, r.nombre_rol,
  u.id_area, a.nombre_area,
  u.id_cargo, c.nombre_cargo,
  u.estado, u.bloqueado, u.fecha_creacion, u.fecha_modificacion
`;

const JOINS = `
  FROM usuarios u
  LEFT JOIN roles r ON r.id_rol = u.id_rol
  LEFT JOIN areas a ON a.id_area = u.id_area
  LEFT JOIN cargos c ON c.id_cargo = u.id_cargo
`;

const obtenerTodos = (callback) => {
  const sql = `SELECT ${CAMPOS_PUBLICOS} ${JOINS} ORDER BY u.id_usuario`;
  pool.query(sql, (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerPorId = (id, callback) => {
  const sql = `SELECT ${CAMPOS_PUBLICOS} ${JOINS} WHERE u.id_usuario = $1`;
  pool.query(sql, [id], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

/** Uso interno exclusivo del login: incluye contrasena_hash, intentos_fallidos y bloqueado. */
const obtenerPorCorreo = (correo, callback) => {
  const sql = `
    SELECT id_usuario, nombre_completo, correo, contrasena_hash, estado, intentos_fallidos, bloqueado
    FROM usuarios
    WHERE correo = $1
  `;
  pool.query(sql, [correo], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const crear = (usuario, callback) => {
  const sql = `
    INSERT INTO usuarios (numero_documento, nombre_completo, correo, contrasena_hash, id_rol, id_area, id_cargo)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id_usuario
  `;
  const valores = [
    usuario.numero_documento,
    usuario.nombre_completo,
    usuario.correo,
    usuario.contrasena_hash,
    usuario.id_rol,
    usuario.id_area || null,
    usuario.id_cargo || null,
  ];
  pool.query(sql, valores, (error, resultado) => {
    if (error) return callback(error);
    callback(null, { insertId: resultado.rows[0].id_usuario });
  });
};

const actualizar = (id, usuario, callback) => {
  const sql = `
    UPDATE usuarios
    SET nombre_completo = $1, correo = $2, id_rol = $3, id_area = $4, id_cargo = $5,
        estado = $6, fecha_modificacion = CURRENT_TIMESTAMP
    WHERE id_usuario = $7
  `;
  const valores = [
    usuario.nombre_completo,
    usuario.correo,
    usuario.id_rol,
    usuario.id_area || null,
    usuario.id_cargo || null,
    usuario.estado,
    id,
  ];
  pool.query(sql, valores, (error, resultado) => {
    if (error) return callback(error);
    callback(null, { affectedRows: resultado.rowCount });
  });
};

/** Eliminación lógica (RF-03): marca el usuario como inactivo, no borra la fila ni su historial relacionado. */
const eliminarLogico = (id, callback) => {
  const sql = `
    UPDATE usuarios
    SET estado = 'inactivo', fecha_modificacion = CURRENT_TIMESTAMP
    WHERE id_usuario = $1
  `;
  pool.query(sql, [id], (error, resultado) => {
    if (error) return callback(error);
    callback(null, { affectedRows: resultado.rowCount });
  });
};

const registrarIntentoFallido = (idUsuario, intentosActuales, callback) => {
  const nuevosIntentos = intentosActuales + 1;
  const bloquear = nuevosIntentos >= 5;
  const sql = `
    UPDATE usuarios
    SET intentos_fallidos = $1, bloqueado = $2
    WHERE id_usuario = $3
  `;
  pool.query(sql, [nuevosIntentos, bloquear, idUsuario], (error) => {
    if (error) return callback(error);
    callback(null, { bloqueado: bloquear });
  });
};

const reiniciarIntentosFallidos = (idUsuario, callback) => {
  const sql = `UPDATE usuarios SET intentos_fallidos = 0 WHERE id_usuario = $1`;
  pool.query(sql, [idUsuario], callback);
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  obtenerPorCorreo,
  crear,
  actualizar,
  eliminarLogico,
  registrarIntentoFallido,
  reiniciarIntentosFallidos,
};
