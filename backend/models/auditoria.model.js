/**
 * models/auditoria.model.js
 * -----------------------------------------------------------
 * pm.auditoria ya existía en la base de datos (evidencia de Bases
 * de Datos) pero la API no la usaba. Ahora cada acción importante
 * (crear/editar/desactivar usuarios, turnos, asistencia, aprobar o
 * rechazar solicitudes, bloqueos de cuenta) deja un registro, con
 * el mismo formato de los datos que ya había:
 *   accion = 'APROBAR_SOLICITUD', tabla_afectada = 'pm.solicitudes'
 */

const pool = require("../config/database");

/**
 * Registra una acción. Si la auditoría falla, solo se informa en consola:
 * la operación principal del usuario ya se completó y no debe fallar por esto.
 */
const registrar = async ({ id_usuario, accion, tabla, id_registro = null, detalle = null }) => {
  try {
    await pool.query(
      "INSERT INTO auditoria (id_usuario, accion, tabla_afectada, id_registro, detalle) VALUES ($1, $2, $3, $4, $5)",
      [id_usuario || null, accion, tabla, id_registro, detalle]
    );
  } catch (error) {
    console.error("No se pudo registrar la auditoría:", error.message);
  }
};

/** @param {{ limite?, accion?, idUsuario? }} filtros */
const listar = async ({ limite = 100, accion, idUsuario } = {}) => {
  const valores = [];
  const condiciones = [];
  if (accion) {
    valores.push(accion);
    condiciones.push(`a.accion = $${valores.length}`);
  }
  if (idUsuario) {
    valores.push(idUsuario);
    condiciones.push(`a.id_usuario = $${valores.length}`);
  }
  valores.push(Math.min(Math.max(Number(limite) || 100, 1), 500));

  const sql = `
    SELECT a.id_auditoria, a.id_usuario, u.nombre_completo AS nombre_usuario,
           a.accion, a.tabla_afectada, a.id_registro, a.detalle, a.fecha_accion
    FROM auditoria a
    LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
    ${condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""}
    ORDER BY a.fecha_accion DESC, a.id_auditoria DESC
    LIMIT $${valores.length}
  `;
  const { rows } = await pool.query(sql, valores);
  return rows;
};

const listarAcciones = async () => {
  const { rows } = await pool.query("SELECT DISTINCT accion FROM auditoria ORDER BY accion");
  return rows.map((fila) => fila.accion);
};

module.exports = {
  registrar,
  listar,
  listarAcciones,
};
