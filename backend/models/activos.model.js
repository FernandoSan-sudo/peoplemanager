/**
 * models/activos.model.js
 * -----------------------------------------------------------
 * Módulo de PRODUCTOS de la empresa: los activos (equipos) que se
 * entregan al personal. Usa tres tablas que ya existían en el
 * esquema pm (no se agregó ninguna columna):
 *   - pm.activos            -> el producto (nombre, serial único, área)
 *   - pm.activos_asignados  -> a qué empleado está asignado hoy
 *   - pm.asset_transfer_logs -> historial de traslados entre áreas
 *
 * pm.activos_asignados no tiene columna de "fecha de devolución":
 * la fila representa la asignación VIGENTE. Al devolver un equipo
 * la fila se elimina y la devolución queda registrada en
 * pm.auditoria, que conserva el historial completo.
 */

const pool = require("../config/database");

const CAMPOS = `
  a.id_activo, a.nombre_activo, a.serial, a.id_area, ar.nombre_area,
  asg.id_asignacion, asg.id_usuario, u.nombre_completo AS nombre_usuario, asg.fecha_asignacion,
  (SELECT COUNT(*) FROM asset_transfer_logs t WHERE t.id_activo = a.id_activo)::int AS traslados
`;

const JOINS = `
  FROM activos a
  LEFT JOIN areas ar ON ar.id_area = a.id_area
  LEFT JOIN LATERAL (
    SELECT * FROM activos_asignados x WHERE x.id_activo = a.id_activo ORDER BY x.id_asignacion DESC LIMIT 1
  ) asg ON TRUE
  LEFT JOIN usuarios u ON u.id_usuario = asg.id_usuario
`;

/** @param {{ idArea?, idUsuario?, estado?: 'asignado'|'disponible' }} filtros */
const listar = async (filtros = {}) => {
  const valores = [];
  const condiciones = [];
  if (filtros.idArea) {
    valores.push(filtros.idArea);
    condiciones.push(`a.id_area = $${valores.length}`);
  }
  if (filtros.idUsuario) {
    valores.push(filtros.idUsuario);
    condiciones.push(`asg.id_usuario = $${valores.length}`);
  }
  if (filtros.estado === "asignado") condiciones.push("asg.id_asignacion IS NOT NULL");
  if (filtros.estado === "disponible") condiciones.push("asg.id_asignacion IS NULL");

  const sql = `SELECT ${CAMPOS} ${JOINS} ${condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""} ORDER BY a.nombre_activo, a.serial`;
  const { rows } = await pool.query(sql, valores);
  return rows;
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(`SELECT ${CAMPOS} ${JOINS} WHERE a.id_activo = $1`, [id]);
  return rows[0] || null;
};

/** ¿Hay otro activo con ese serial (sin importar mayúsculas)? */
const existeSerial = async (serial, excluirId = null) => {
  const { rows } = await pool.query(
    "SELECT 1 FROM activos WHERE UPPER(serial) = UPPER($1) AND ($2::int IS NULL OR id_activo <> $2)",
    [serial, excluirId]
  );
  return rows.length > 0;
};

const crear = async ({ nombre_activo, serial, id_area }) => {
  const { rows } = await pool.query(
    "INSERT INTO activos (nombre_activo, serial, id_area) VALUES ($1, $2, $3) RETURNING id_activo",
    [nombre_activo, serial, id_area || null]
  );
  return rows[0].id_activo;
};

/** Actualiza nombre y serial. El área cambia solo con trasladar() para dejar historial. */
const actualizar = async (id, { nombre_activo, serial }) => {
  const { rowCount } = await pool.query("UPDATE activos SET nombre_activo = $1, serial = $2 WHERE id_activo = $3", [
    nombre_activo,
    serial,
    id,
  ]);
  return rowCount;
};

const eliminar = async (id) => {
  const { rowCount } = await pool.query("DELETE FROM activos WHERE id_activo = $1", [id]);
  return rowCount;
};

/** Asigna el activo a un empleado solo si no tiene una asignación vigente (evita doble entrega). */
const asignar = async (idActivo, idUsuario, fecha) => {
  const { rows } = await pool.query(
    `INSERT INTO activos_asignados (id_activo, id_usuario, fecha_asignacion)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (SELECT 1 FROM activos_asignados WHERE id_activo = $1)
     RETURNING id_asignacion`,
    [idActivo, idUsuario, fecha]
  );
  return rows[0] ? rows[0].id_asignacion : null;
};

/** Cierra la asignación vigente (devolución). Devuelve la fila eliminada o null. */
const devolver = async (idActivo) => {
  const { rows } = await pool.query("DELETE FROM activos_asignados WHERE id_activo = $1 RETURNING *", [idActivo]);
  return rows[0] || null;
};

/** Traslado de área: actualiza el activo y registra el movimiento en una sola transacción. */
const trasladar = async (idActivo, idAreaOrigen, idAreaDestino) => {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("UPDATE activos SET id_area = $1 WHERE id_activo = $2", [idAreaDestino, idActivo]);
    const { rows } = await cliente.query(
      `INSERT INTO asset_transfer_logs (id_activo, id_area_origen, id_area_destino)
       VALUES ($1, $2, $3) RETURNING id_transferencia, fecha_transferencia`,
      [idActivo, idAreaOrigen, idAreaDestino]
    );
    await cliente.query("COMMIT");
    return rows[0];
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
};

/** Historial del activo: traslados (pm.asset_transfer_logs) + movimientos registrados en auditoría. */
const historial = async (idActivo) => {
  const traslados = await pool.query(
    `SELECT t.id_transferencia, t.fecha_transferencia AS fecha, o.nombre_area AS origen, d.nombre_area AS destino
     FROM asset_transfer_logs t
     LEFT JOIN areas o ON o.id_area = t.id_area_origen
     LEFT JOIN areas d ON d.id_area = t.id_area_destino
     WHERE t.id_activo = $1`,
    [idActivo]
  );
  const movimientos = await pool.query(
    `SELECT a.fecha_accion AS fecha, a.accion, a.detalle, u.nombre_completo AS realizado_por
     FROM auditoria a
     LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
     WHERE a.tabla_afectada IN ('pm.activos', 'pm.activos_asignados') AND a.id_registro = $1`,
    [idActivo]
  );
  return [
    ...traslados.rows.map((t) => ({ fecha: t.fecha, tipo: "TRASLADO", detalle: `Traslado de ${t.origen || "sin área"} a ${t.destino || "sin área"}` })),
    ...movimientos.rows.map((m) => ({ fecha: m.fecha, tipo: m.accion, detalle: m.detalle, realizado_por: m.realizado_por })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
};

module.exports = {
  listar,
  obtenerPorId,
  existeSerial,
  crear,
  actualizar,
  eliminar,
  asignar,
  devolver,
  trasladar,
  historial,
};
