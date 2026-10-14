/**
 * models/reportes.model.js
 * -----------------------------------------------------------
 * Consultas de solo lectura para el dashboard y los reportes de
 * talento humano. Reutilizan CONSULTA_BASE de turnos.model.js, así
 * el estado de cada turno (ausente, justificado, tardanza...) se
 * calcula exactamente igual que en el listado de turnos.
 */

const pool = require("../config/database");
const { CONSULTA_BASE, parametrosDeTiempo } = require("./turnos.model");

/** Totales generales para las tarjetas del dashboard. */
const totalesGenerales = async ({ idUsuario, desdeMes, hastaMes }) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM usuarios WHERE estado = 'activo')::int AS empleados_activos,
      (SELECT COUNT(*) FROM usuarios WHERE bloqueado = TRUE)::int AS cuentas_bloqueadas,
      (SELECT COUNT(*) FROM solicitudes WHERE estado = 'pendiente'
         AND ($1::int IS NULL OR id_usuario = $1))::int AS solicitudes_pendientes,
      (SELECT COUNT(*) FROM asistencia a JOIN turnos t ON t.id_turno = a.id_turno
         WHERE a.minutos_tardanza > 0 AND t.fecha_turno BETWEEN $2::date AND $3::date
           AND ($1::int IS NULL OR a.id_usuario = $1))::int AS tardanzas_mes,
      (SELECT COALESCE(SUM(a.minutos_tardanza), 0) FROM asistencia a JOIN turnos t ON t.id_turno = a.id_turno
         WHERE t.fecha_turno BETWEEN $2::date AND $3::date
           AND ($1::int IS NULL OR a.id_usuario = $1))::int AS minutos_tardanza_mes
  `;
  const { rows } = await pool.query(sql, [idUsuario || null, desdeMes, hastaMes]);
  return rows[0];
};

/**
 * Consolidado de asistencia por empleado en un rango de fechas: turnos
 * programados, asistidos, tardanzas, ausencias, justificados, minutos de
 * tardanza y horas programadas vs. trabajadas.
 * @param {{ desde, hasta, idArea?, idUsuario? }} filtros
 */
const asistenciaPorEmpleado = async ({ desde, hasta, idArea, idUsuario }) => {
  const valores = [...parametrosDeTiempo(), desde, hasta];
  const condiciones = ["t.fecha_turno BETWEEN $3::date AND $4::date"];
  if (idArea) {
    valores.push(idArea);
    condiciones.push(`t.id_area = $${valores.length}`);
  }
  if (idUsuario) {
    valores.push(idUsuario);
    condiciones.push(`t.id_usuario = $${valores.length}`);
  }

  const sql = `
    WITH base AS (${CONSULTA_BASE} WHERE ${condiciones.join(" AND ")})
    SELECT
      b.id_usuario,
      b.nombre_usuario,
      b.numero_documento,
      STRING_AGG(DISTINCT b.nombre_area, ', ') AS areas,
      COUNT(*)::int AS turnos,
      COUNT(*) FILTER (WHERE b.estado_asistencia IN ('completo', 'tardanza', 'salida_anticipada'))::int AS asistidos,
      COUNT(*) FILTER (WHERE b.minutos_tardanza > 0)::int AS tardanzas,
      COUNT(*) FILTER (WHERE b.estado_asistencia = 'salida_anticipada')::int AS salidas_anticipadas,
      COUNT(*) FILTER (WHERE b.estado_asistencia = 'ausente')::int AS ausencias,
      COUNT(*) FILTER (WHERE b.estado_asistencia = 'justificado')::int AS justificados,
      COUNT(*) FILTER (WHERE b.estado_asistencia = 'pendiente')::int AS pendientes,
      COALESCE(SUM(b.minutos_tardanza), 0)::int AS minutos_tardanza,
      ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (b.hora_fin - b.hora_inicio))), 0) / 3600.0, 2) AS horas_programadas,
      ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (b.hora_salida - b.hora_entrada))), 0) / 3600.0, 2) AS horas_trabajadas
    FROM base b
    GROUP BY b.id_usuario, b.nombre_usuario, b.numero_documento
    ORDER BY b.nombre_usuario
  `;
  const { rows } = await pool.query(sql, valores);

  // Porcentaje de cumplimiento: turnos asistidos sobre turnos que ya debían
  // cumplirse (no cuenta los pendientes ni los justificados por una solicitud).
  return rows.map((fila) => {
    const exigibles = fila.turnos - fila.pendientes - fila.justificados;
    return {
      ...fila,
      horas_programadas: Number(fila.horas_programadas),
      horas_trabajadas: Number(fila.horas_trabajadas),
      porcentaje_asistencia: exigibles > 0 ? Math.round((fila.asistidos / exigibles) * 100) : null,
    };
  });
};

module.exports = {
  totalesGenerales,
  asistenciaPorEmpleado,
};
