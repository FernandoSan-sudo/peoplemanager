/**
 * models/asistencia.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.asistencia. No se piden ni se guardan
 * coordenadas GPS (latitud_entrada/longitud_entrada/etc. quedan
 * NULL): esas columnas existen en la tabla real, pero el
 * front-end de esta evidencia no captura ubicación, así que
 * simplemente no se envían en el INSERT.
 */

const pool = require("../config/database");

const obtenerPorTurno = (idTurno, callback) => {
  const sql = "SELECT * FROM asistencia WHERE id_turno = $1";
  pool.query(sql, [idTurno], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerPorUsuario = (idUsuario, callback) => {
  const sql = `
    SELECT ast.*, t.fecha_turno, t.hora_inicio, t.hora_fin
    FROM asistencia ast
    JOIN turnos t ON t.id_turno = ast.id_turno
    WHERE ast.id_usuario = $1
    ORDER BY ast.hora_entrada DESC
  `;
  pool.query(sql, [idUsuario], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

/** Registra la hora de entrada de un turno. estado_registro llega ya calculado por el controlador ('completo' o 'tardanza'). */
const registrarEntrada = (datos, callback) => {
  const sql = `
    INSERT INTO asistencia (id_turno, id_usuario, hora_entrada, minutos_tardanza, estado_registro)
    VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)
    RETURNING id_asistencia, hora_entrada
  `;
  const valores = [datos.id_turno, datos.id_usuario, datos.minutos_tardanza, datos.estado_registro];
  pool.query(sql, valores, (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows[0]);
  });
};

/** Registra la hora de salida sobre el registro de entrada abierto de ese turno (hora_salida IS NULL). */
const registrarSalida = (idTurno, estadoRegistro, callback) => {
  const sql = `
    UPDATE asistencia
    SET hora_salida = CURRENT_TIMESTAMP, estado_registro = $1
    WHERE id_turno = $2 AND hora_salida IS NULL
    RETURNING id_asistencia, hora_salida
  `;
  pool.query(sql, [estadoRegistro, idTurno], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

module.exports = {
  obtenerPorTurno,
  obtenerPorUsuario,
  registrarEntrada,
  registrarSalida,
};
