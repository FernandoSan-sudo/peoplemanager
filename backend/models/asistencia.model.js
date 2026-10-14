/**
 * models/asistencia.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.asistencia. No se piden ni se guardan
 * coordenadas GPS (latitud_entrada/longitud_entrada/etc. quedan
 * NULL): esas columnas existen en la tabla real, pero el
 * front-end de esta evidencia no captura ubicación, así que
 * simplemente no se envían en el INSERT.
 *
 * La hora de entrada/salida se envía desde Node.js (no se usa
 * CURRENT_TIMESTAMP) para que sea exactamente la misma hora con la
 * que el controlador calculó la tardanza.
 */

const pool = require("../config/database");

const obtenerPorTurno = async (idTurno) => {
  const { rows } = await pool.query(
    "SELECT * FROM asistencia WHERE id_turno = $1 ORDER BY id_asistencia DESC LIMIT 1",
    [idTurno]
  );
  return rows[0] || null;
};

/**
 * Historial de asistencia con datos del turno y horas trabajadas.
 * @param {{ idUsuario?, desde?, hasta? }} filtros
 */
const listar = async (filtros = {}) => {
  const valores = [];
  const condiciones = [];
  const agregar = (condicion, valor) => {
    valores.push(valor);
    condiciones.push(condicion.replace("?", `$${valores.length}`));
  };

  if (filtros.idUsuario) agregar("ast.id_usuario = ?", filtros.idUsuario);
  if (filtros.desde) agregar("t.fecha_turno >= ?::date", filtros.desde);
  if (filtros.hasta) agregar("t.fecha_turno <= ?::date", filtros.hasta);

  const sql = `
    SELECT ast.id_asistencia, ast.id_turno, ast.id_usuario, u.nombre_completo AS nombre_usuario,
           t.fecha_turno, t.hora_inicio, t.hora_fin, ar.nombre_area,
           ast.hora_entrada, ast.hora_salida, ast.minutos_tardanza, ast.estado_registro, ast.observaciones,
           ROUND(EXTRACT(EPOCH FROM (ast.hora_salida - ast.hora_entrada)) / 3600.0, 2) AS horas_trabajadas
    FROM asistencia ast
    JOIN turnos t ON t.id_turno = ast.id_turno
    JOIN usuarios u ON u.id_usuario = ast.id_usuario
    LEFT JOIN areas ar ON ar.id_area = t.id_area
    ${condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""}
    ORDER BY t.fecha_turno DESC, ast.hora_entrada DESC
  `;
  const { rows } = await pool.query(sql, valores);
  return rows;
};

/**
 * Registra la entrada solo si el turno todavía no tiene registro (el
 * NOT EXISTS evita que un doble clic cree dos entradas para el mismo turno).
 * Devuelve null si ya existía un registro.
 */
const registrarEntrada = async ({ id_turno, id_usuario, hora, minutos_tardanza, estado_registro }) => {
  const sql = `
    INSERT INTO asistencia (id_turno, id_usuario, hora_entrada, minutos_tardanza, estado_registro)
    SELECT $1, $2, $3, $4, $5
    WHERE NOT EXISTS (SELECT 1 FROM asistencia WHERE id_turno = $1)
    RETURNING id_asistencia, hora_entrada, minutos_tardanza, estado_registro
  `;
  const { rows } = await pool.query(sql, [id_turno, id_usuario, hora, minutos_tardanza, estado_registro]);
  return rows[0] || null;
};

/** Cierra el registro abierto (hora_salida IS NULL). Devuelve null si no había entrada abierta. */
const registrarSalida = async (idAsistencia, { hora, estado_registro, observaciones }) => {
  const sql = `
    UPDATE asistencia
    SET hora_salida = $1, estado_registro = $2, observaciones = $3
    WHERE id_asistencia = $4 AND hora_salida IS NULL
    RETURNING id_asistencia, hora_entrada, hora_salida, minutos_tardanza, estado_registro, observaciones
  `;
  const { rows } = await pool.query(sql, [hora, estado_registro, observaciones, idAsistencia]);
  return rows[0] || null;
};

module.exports = {
  obtenerPorTurno,
  listar,
  registrarEntrada,
  registrarSalida,
};
