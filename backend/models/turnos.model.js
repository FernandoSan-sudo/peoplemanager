/**
 * models/turnos.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.turnos.
 *
 * IMPORTANTE: pm.turnos NO tiene una columna de "estado" (el
 * semáforo verde/amarillo/rojo que muestra el front-end). Ese
 * estado se calcula aquí mismo, en la consulta, haciendo un
 * LEFT JOIN con pm.asistencia y devolviendo su estado_registro
 * (o 'pendiente' si el turno todavía no tiene ningún registro
 * de asistencia). Esto evita duplicar información que ya vive
 * en pm.asistencia y que se podría desincronizar.
 */

const pool = require("../config/database");

const CAMPOS = `
  t.id_turno, t.id_usuario, u.nombre_completo AS nombre_usuario,
  t.fecha_turno, t.hora_inicio, t.hora_fin,
  t.id_area, ar.nombre_area,
  t.creado_por, t.fecha_asignacion,
  COALESCE(ast.estado_registro, 'pendiente') AS estado_asistencia,
  ast.id_asistencia, ast.hora_entrada, ast.hora_salida, ast.minutos_tardanza
`;

const JOINS = `
  FROM turnos t
  JOIN usuarios u ON u.id_usuario = t.id_usuario
  LEFT JOIN areas ar ON ar.id_area = t.id_area
  LEFT JOIN asistencia ast ON ast.id_turno = t.id_turno
`;

const obtenerTodos = (callback) => {
  const sql = `SELECT ${CAMPOS} ${JOINS} ORDER BY t.fecha_turno DESC, t.hora_inicio`;
  pool.query(sql, (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerPorId = (id, callback) => {
  const sql = `SELECT ${CAMPOS} ${JOINS} WHERE t.id_turno = $1`;
  pool.query(sql, [id], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerPorUsuario = (idUsuario, callback) => {
  const sql = `SELECT ${CAMPOS} ${JOINS} WHERE t.id_usuario = $1 ORDER BY t.fecha_turno DESC, t.hora_inicio`;
  pool.query(sql, [idUsuario], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const crear = (turno, callback) => {
  const sql = `
    INSERT INTO turnos (id_usuario, fecha_turno, hora_inicio, hora_fin, id_area, creado_por)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id_turno
  `;
  const valores = [turno.id_usuario, turno.fecha_turno, turno.hora_inicio, turno.hora_fin, turno.id_area || null, turno.creado_por];
  pool.query(sql, valores, (error, resultado) => {
    if (error) return callback(error);
    callback(null, { insertId: resultado.rows[0].id_turno });
  });
};

const actualizar = (id, turno, callback) => {
  const sql = `
    UPDATE turnos
    SET fecha_turno = $1, hora_inicio = $2, hora_fin = $3, id_area = $4
    WHERE id_turno = $5
  `;
  const valores = [turno.fecha_turno, turno.hora_inicio, turno.hora_fin, turno.id_area || null, id];
  pool.query(sql, valores, (error, resultado) => {
    if (error) return callback(error);
    callback(null, { affectedRows: resultado.rowCount });
  });
};

const eliminar = (id, callback) => {
  pool.query("DELETE FROM turnos WHERE id_turno = $1", [id], (error, resultado) => {
    if (error) return callback(error);
    callback(null, { affectedRows: resultado.rowCount });
  });
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  obtenerPorUsuario,
  crear,
  actualizar,
  eliminar,
};
