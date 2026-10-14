/**
 * models/nomina.model.js
 * -----------------------------------------------------------
 * Acceso a datos para pm.nomina. La columna total_pagar es
 * GENERATED en la base de datos (horas × tarifas fijas + recargo
 * + bonificaciones − descuentos): nunca se escribe desde aquí, solo
 * se lee. Una nómina por empleado y mes (UNIQUE en la tabla).
 *
 * Flujo de estados: calculada -> aprobada -> pagada. Solo una
 * nómina "calculada" se puede recalcular o ajustar.
 */

const pool = require("../config/database");

const CAMPOS = `
  n.id_nomina, n.id_usuario, u.nombre_completo AS nombre_usuario, u.numero_documento,
  u.id_area, a.nombre_area, c.nombre_cargo,
  n.periodo_mes, n.periodo_anio,
  n.horas_ordinarias, n.horas_extra_diurna, n.horas_extra_noct,
  n.recargo_festivo, n.bonificaciones, n.descuentos, n.total_pagar,
  n.estado, n.fecha_calculo
`;

const JOINS = `
  FROM nomina n
  JOIN usuarios u ON u.id_usuario = n.id_usuario
  LEFT JOIN areas a ON a.id_area = u.id_area
  LEFT JOIN cargos c ON c.id_cargo = u.id_cargo
`;

/** Los NUMERIC de PostgreSQL llegan como texto: se convierten a número para el front-end. */
const aNumeros = (fila) =>
  fila && {
    ...fila,
    horas_ordinarias: Number(fila.horas_ordinarias),
    horas_extra_diurna: Number(fila.horas_extra_diurna),
    horas_extra_noct: Number(fila.horas_extra_noct),
    recargo_festivo: Number(fila.recargo_festivo),
    bonificaciones: Number(fila.bonificaciones),
    descuentos: Number(fila.descuentos),
    total_pagar: Number(fila.total_pagar),
  };

/** @param {{ anio?, mes?, idUsuario?, estados? }} filtros */
const listar = async (filtros = {}) => {
  const valores = [];
  const condiciones = [];
  const agregar = (condicion, valor) => {
    valores.push(valor);
    condiciones.push(condicion.replace("?", `$${valores.length}`));
  };
  if (filtros.anio) agregar("n.periodo_anio = ?", filtros.anio);
  if (filtros.mes) agregar("n.periodo_mes = ?", filtros.mes);
  if (filtros.idUsuario) agregar("n.id_usuario = ?", filtros.idUsuario);
  if (filtros.estados) agregar("n.estado = ANY(?)", filtros.estados);

  const sql = `
    SELECT ${CAMPOS} ${JOINS}
    ${condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : ""}
    ORDER BY n.periodo_anio DESC, n.periodo_mes DESC, u.nombre_completo
  `;
  const { rows } = await pool.query(sql, valores);
  return rows.map(aNumeros);
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(`SELECT ${CAMPOS} ${JOINS} WHERE n.id_nomina = $1`, [id]);
  return aNumeros(rows[0]) || null;
};

/**
 * Guarda (o recalcula) la nómina de un empleado para un periodo. Si ya
 * existe y NO está en estado "calculada", no se toca y devuelve null.
 */
const guardar = async ({ id_usuario, anio, mes, horas }) => {
  const sql = `
    INSERT INTO nomina (id_usuario, periodo_mes, periodo_anio, horas_ordinarias, horas_extra_diurna,
                        horas_extra_noct, recargo_festivo, bonificaciones, descuentos, estado, fecha_calculo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'calculada', CURRENT_TIMESTAMP)
    ON CONFLICT (id_usuario, periodo_mes, periodo_anio) DO UPDATE
      SET horas_ordinarias = EXCLUDED.horas_ordinarias,
          horas_extra_diurna = EXCLUDED.horas_extra_diurna,
          horas_extra_noct = EXCLUDED.horas_extra_noct,
          recargo_festivo = EXCLUDED.recargo_festivo,
          bonificaciones = EXCLUDED.bonificaciones,
          descuentos = EXCLUDED.descuentos,
          fecha_calculo = CURRENT_TIMESTAMP
      WHERE nomina.estado = 'calculada'
    RETURNING id_nomina, total_pagar
  `;
  const { rows } = await pool.query(sql, [
    id_usuario,
    mes,
    anio,
    horas.horas_ordinarias,
    horas.horas_extra_diurna,
    horas.horas_extra_noct,
    horas.recargo_festivo,
    horas.bonificaciones,
    horas.descuentos,
  ]);
  return rows[0] ? { id_nomina: rows[0].id_nomina, total_pagar: Number(rows[0].total_pagar) } : null;
};

/** Bonificaciones y descuentos manuales; solo en nóminas "calculada". Devuelve filas afectadas. */
const actualizarAjustes = async (id, { bonificaciones, descuentos }) => {
  const { rowCount } = await pool.query(
    "UPDATE nomina SET bonificaciones = $1, descuentos = $2 WHERE id_nomina = $3 AND estado = 'calculada'",
    [bonificaciones, descuentos, id]
  );
  return rowCount;
};

/** Avanza el estado solo si la nómina está en el estado esperado (evita saltos o dobles pagos). */
const cambiarEstado = async (id, estadoActual, estadoNuevo) => {
  const { rowCount } = await pool.query("UPDATE nomina SET estado = $1 WHERE id_nomina = $2 AND estado = $3", [
    estadoNuevo,
    id,
    estadoActual,
  ]);
  return rowCount;
};

module.exports = {
  listar,
  obtenerPorId,
  guardar,
  actualizarAjustes,
  cambiarEstado,
};
