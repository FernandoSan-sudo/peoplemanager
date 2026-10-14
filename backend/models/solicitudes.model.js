/**
 * models/solicitudes.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.solicitudes (permisos, vacaciones,
 * incapacidades). Los SELECT incluyen JOIN con usuarios (dos
 * veces: solicitante y aprobador) y tipos_solicitud, para que
 * el front-end reciba nombres legibles y no solo ids.
 */

const pool = require("../config/database");

const CAMPOS = `
  s.id_solicitud, s.id_usuario, u.nombre_completo AS nombre_usuario,
  s.id_tipo, ts.nombre_tipo,
  s.fecha_inicio, s.fecha_fin, s.motivo, s.estado,
  s.id_aprobador, ap.nombre_completo AS nombre_aprobador,
  s.observacion_resp, s.fecha_creacion, s.fecha_respuesta
`;

const JOINS = `
  FROM solicitudes s
  JOIN usuarios u ON u.id_usuario = s.id_usuario
  JOIN tipos_solicitud ts ON ts.id_tipo = s.id_tipo
  LEFT JOIN usuarios ap ON ap.id_usuario = s.id_aprobador
`;

const obtenerTodas = (callback) => {
  const sql = `SELECT ${CAMPOS} ${JOINS} ORDER BY s.fecha_creacion DESC`;
  pool.query(sql, (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerPorUsuario = (idUsuario, callback) => {
  const sql = `SELECT ${CAMPOS} ${JOINS} WHERE s.id_usuario = $1 ORDER BY s.fecha_creacion DESC`;
  pool.query(sql, [idUsuario], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerPorId = (id, callback) => {
  const sql = `SELECT ${CAMPOS} ${JOINS} WHERE s.id_solicitud = $1`;
  pool.query(sql, [id], (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const crear = (solicitud, callback) => {
  const sql = `
    INSERT INTO solicitudes (id_usuario, id_tipo, fecha_inicio, fecha_fin, motivo)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_solicitud
  `;
  const valores = [solicitud.id_usuario, solicitud.id_tipo, solicitud.fecha_inicio, solicitud.fecha_fin, solicitud.motivo];
  pool.query(sql, valores, (error, resultado) => {
    if (error) return callback(error);
    callback(null, { insertId: resultado.rows[0].id_solicitud });
  });
};

/** Cambia el estado a 'aprobada' o 'rechazada', solo si sigue 'pendiente' (evita reprocesar una ya resuelta). */
const responder = (id, { estado, id_aprobador, observacion_resp }, callback) => {
  const sql = `
    UPDATE solicitudes
    SET estado = $1, id_aprobador = $2, observacion_resp = $3, fecha_respuesta = CURRENT_TIMESTAMP
    WHERE id_solicitud = $4 AND estado = 'pendiente'
  `;
  pool.query(sql, [estado, id_aprobador, observacion_resp || null, id], (error, resultado) => {
    if (error) return callback(error);
    callback(null, { affectedRows: resultado.rowCount });
  });
};

module.exports = {
  obtenerTodas,
  obtenerPorUsuario,
  obtenerPorId,
  crear,
  responder,
};
