/**
 * models/solicitudes.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.solicitudes (permisos, vacaciones,
 * incapacidades). Los SELECT incluyen JOIN con usuarios (dos
 * veces: solicitante y aprobador) y tipos_solicitud, para que
 * el front-end reciba nombres legibles y no solo ids. "dias" se
 * calcula en la consulta (fecha_fin - fecha_inicio + 1).
 */

const pool = require("../config/database");

const CAMPOS = `
  s.id_solicitud, s.id_usuario, u.nombre_completo AS nombre_usuario, u.id_area, ar.nombre_area,
  s.id_tipo, ts.nombre_tipo,
  s.fecha_inicio, s.fecha_fin, (s.fecha_fin - s.fecha_inicio + 1) AS dias,
  s.motivo, s.estado,
  s.id_aprobador, ap.nombre_completo AS nombre_aprobador,
  s.observacion_resp, s.fecha_creacion, s.fecha_respuesta
`;

const JOINS = `
  FROM solicitudes s
  JOIN usuarios u ON u.id_usuario = s.id_usuario
  LEFT JOIN areas ar ON ar.id_area = u.id_area
  JOIN tipos_solicitud ts ON ts.id_tipo = s.id_tipo
  LEFT JOIN usuarios ap ON ap.id_usuario = s.id_aprobador
`;

/** @param {{ idUsuario?, estado? }} filtros */
const listar = async (filtros = {}) => {
  const valores = [];
  const condiciones = [];
  if (filtros.idUsuario) {
    valores.push(filtros.idUsuario);
    condiciones.push(`s.id_usuario = $${valores.length}`);
  }
  if (filtros.estado) {
    valores.push(filtros.estado);
    condiciones.push(`s.estado = $${valores.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  // Las pendientes primero: son las que requieren acción.
  const sql = `SELECT ${CAMPOS} ${JOINS} ${where} ORDER BY (s.estado = 'pendiente') DESC, s.fecha_creacion DESC`;
  const { rows } = await pool.query(sql, valores);
  return rows;
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(`SELECT ${CAMPOS} ${JOINS} WHERE s.id_solicitud = $1`, [id]);
  return rows[0] || null;
};

/** Busca una solicitud pendiente o aprobada del mismo empleado que se cruce con el rango de fechas. */
const buscarCruce = async (idUsuario, fechaInicio, fechaFin) => {
  const sql = `
    SELECT s.id_solicitud, ts.nombre_tipo, s.fecha_inicio, s.fecha_fin, s.estado
    FROM solicitudes s
    JOIN tipos_solicitud ts ON ts.id_tipo = s.id_tipo
    WHERE s.id_usuario = $1 AND s.estado IN ('pendiente', 'aprobada')
      AND s.fecha_inicio <= $3::date AND s.fecha_fin >= $2::date
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idUsuario, fechaInicio, fechaFin]);
  return rows[0] || null;
};

/** Solicitud APROBADA que cubre una fecha concreta (para no asignar turnos a alguien en vacaciones). */
const buscarAprobadaEnFecha = async (idUsuario, fecha) => {
  const sql = `
    SELECT s.id_solicitud, ts.nombre_tipo, s.fecha_inicio, s.fecha_fin
    FROM solicitudes s
    JOIN tipos_solicitud ts ON ts.id_tipo = s.id_tipo
    WHERE s.id_usuario = $1 AND s.estado = 'aprobada' AND $2::date BETWEEN s.fecha_inicio AND s.fecha_fin
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idUsuario, fecha]);
  return rows[0] || null;
};

const crear = async (solicitud) => {
  const sql = `
    INSERT INTO solicitudes (id_usuario, id_tipo, fecha_inicio, fecha_fin, motivo)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_solicitud
  `;
  const { rows } = await pool.query(sql, [
    solicitud.id_usuario,
    solicitud.id_tipo,
    solicitud.fecha_inicio,
    solicitud.fecha_fin,
    solicitud.motivo,
  ]);
  return rows[0].id_solicitud;
};

/** Cambia el estado a 'aprobada' o 'rechazada', solo si sigue 'pendiente' (evita reprocesar una ya resuelta). */
const responder = async (id, { estado, id_aprobador, observacion_resp }) => {
  const sql = `
    UPDATE solicitudes
    SET estado = $1, id_aprobador = $2, observacion_resp = $3, fecha_respuesta = CURRENT_TIMESTAMP
    WHERE id_solicitud = $4 AND estado = 'pendiente'
  `;
  const { rowCount } = await pool.query(sql, [estado, id_aprobador, observacion_resp || null, id]);
  return rowCount;
};

module.exports = {
  listar,
  obtenerPorId,
  buscarCruce,
  buscarAprobadaEnFecha,
  crear,
  responder,
};
