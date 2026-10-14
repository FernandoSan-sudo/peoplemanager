/**
 * models/turnos.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.turnos.
 *
 * IMPORTANTE: pm.turnos NO tiene una columna de "estado" (el
 * semáforo que muestra el front-end). Ese estado se CALCULA en la
 * consulta, sin guardarse, a partir de lo que ya existe:
 *
 *   1. Si el turno tiene registro en pm.asistencia -> su estado_registro
 *      (completo, tardanza o salida_anticipada).
 *   2. Si no, pero el empleado tiene una solicitud APROBADA (permiso,
 *      vacaciones, incapacidad) que cubre esa fecha -> 'justificado'.
 *   3. Si no, y el turno ya terminó -> 'ausente'.
 *   4. Si no -> 'pendiente' (todavía está a tiempo de marcar).
 *
 * La fecha y hora "actuales" se envían como parámetros ($1 y $2)
 * desde Node.js, para que coincidan exactamente con la hora que usa
 * el controlador de asistencia.
 */

const pool = require("../config/database");
const { fechaLocalISO, horaLocalHHMM } = require("../utils/fechas");

/**
 * SELECT base reutilizado por los listados de turnos y por los reportes.
 * Usa LEFT JOIN LATERAL ... LIMIT 1 para tomar como máximo un registro de
 * asistencia y una solicitud por turno, y así no duplicar filas.
 */
const CONSULTA_BASE = `
  SELECT
    t.id_turno, t.id_usuario, u.nombre_completo AS nombre_usuario, u.numero_documento,
    t.fecha_turno, t.hora_inicio, t.hora_fin,
    t.id_area, ar.nombre_area,
    t.creado_por, cr.nombre_completo AS nombre_creador, t.fecha_asignacion,
    ast.id_asistencia, ast.hora_entrada, ast.hora_salida, ast.minutos_tardanza, ast.observaciones,
    sol.id_solicitud AS id_solicitud_justifica, sol.nombre_tipo AS justificacion, sol.fecha_inicio AS justificacion_desde,
    CASE
      WHEN ast.id_asistencia IS NOT NULL THEN ast.estado_registro
      WHEN sol.id_solicitud IS NOT NULL THEN 'justificado'
      WHEN t.fecha_turno < $1::date OR (t.fecha_turno = $1::date AND t.hora_fin <= $2::time) THEN 'ausente'
      ELSE 'pendiente'
    END AS estado_asistencia
  FROM turnos t
  JOIN usuarios u ON u.id_usuario = t.id_usuario
  LEFT JOIN usuarios cr ON cr.id_usuario = t.creado_por
  LEFT JOIN areas ar ON ar.id_area = t.id_area
  LEFT JOIN LATERAL (
    SELECT a.* FROM asistencia a WHERE a.id_turno = t.id_turno ORDER BY a.id_asistencia DESC LIMIT 1
  ) ast ON TRUE
  LEFT JOIN LATERAL (
    SELECT s.id_solicitud, ts.nombre_tipo, s.fecha_inicio
    FROM solicitudes s
    JOIN tipos_solicitud ts ON ts.id_tipo = s.id_tipo
    WHERE s.id_usuario = t.id_usuario AND s.estado = 'aprobada'
      AND t.fecha_turno BETWEEN s.fecha_inicio AND s.fecha_fin
    LIMIT 1
  ) sol ON TRUE
`;

/** Parámetros $1 (fecha de hoy) y $2 (hora actual) que necesita CONSULTA_BASE. */
const parametrosDeTiempo = (ahora = new Date()) => [fechaLocalISO(ahora), horaLocalHHMM(ahora)];

/**
 * Lista turnos con filtros opcionales.
 * @param {{ idUsuario?, idArea?, fecha?, desde?, hasta? }} filtros
 */
const listar = async (filtros = {}) => {
  const valores = parametrosDeTiempo();
  const condiciones = [];

  const agregar = (condicion, valor) => {
    valores.push(valor);
    condiciones.push(condicion.replace("?", `$${valores.length}`));
  };

  if (filtros.idUsuario) agregar("t.id_usuario = ?", filtros.idUsuario);
  if (filtros.idArea) agregar("t.id_area = ?", filtros.idArea);
  if (filtros.fecha) agregar("t.fecha_turno = ?::date", filtros.fecha);
  if (filtros.desde) agregar("t.fecha_turno >= ?::date", filtros.desde);
  if (filtros.hasta) agregar("t.fecha_turno <= ?::date", filtros.hasta);

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const sql = `${CONSULTA_BASE} ${where} ORDER BY t.fecha_turno DESC, t.hora_inicio, u.nombre_completo`;
  const { rows } = await pool.query(sql, valores);
  return rows;
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(`${CONSULTA_BASE} WHERE t.id_turno = $3`, [...parametrosDeTiempo(), id]);
  return rows[0] || null;
};

/**
 * Busca un turno del mismo empleado, el mismo día, cuyo horario se cruce
 * con el indicado (dos rangos se cruzan si uno empieza antes de que el
 * otro termine). excluirId permite ignorar el propio turno al editar.
 */
const buscarCruce = async ({ idUsuario, fecha, horaInicio, horaFin, excluirId = null }) => {
  const sql = `
    SELECT id_turno, hora_inicio, hora_fin
    FROM turnos
    WHERE id_usuario = $1 AND fecha_turno = $2::date
      AND hora_inicio < $4::time AND hora_fin > $3::time
      AND ($5::int IS NULL OR id_turno <> $5)
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idUsuario, fecha, horaInicio, horaFin, excluirId]);
  return rows[0] || null;
};

const crear = async (turno) => {
  const sql = `
    INSERT INTO turnos (id_usuario, fecha_turno, hora_inicio, hora_fin, id_area, creado_por)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id_turno
  `;
  const { rows } = await pool.query(sql, [
    turno.id_usuario,
    turno.fecha_turno,
    turno.hora_inicio,
    turno.hora_fin,
    turno.id_area || null,
    turno.creado_por,
  ]);
  return rows[0].id_turno;
};

const actualizar = async (id, turno) => {
  const sql = `
    UPDATE turnos
    SET fecha_turno = $1, hora_inicio = $2, hora_fin = $3, id_area = $4
    WHERE id_turno = $5
  `;
  const { rowCount } = await pool.query(sql, [turno.fecha_turno, turno.hora_inicio, turno.hora_fin, turno.id_area || null, id]);
  return rowCount;
};

const eliminar = async (id) => {
  const { rowCount } = await pool.query("DELETE FROM turnos WHERE id_turno = $1", [id]);
  return rowCount;
};

module.exports = {
  CONSULTA_BASE,
  parametrosDeTiempo,
  listar,
  obtenerPorId,
  buscarCruce,
  crear,
  actualizar,
  eliminar,
};
