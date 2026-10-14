/**
 * models/catalogos.model.js
 * -----------------------------------------------------------
 * Tablas de catálogo (solo lectura desde la API): roles, areas,
 * cargos y tipos_solicitud. El front-end las usa para llenar los
 * <select> de los formularios (crear usuario, crear solicitud, etc.).
 */

const pool = require("../config/database");

const consultar = async (sql, valores = []) => (await pool.query(sql, valores)).rows;

const obtenerRoles = () => consultar("SELECT id_rol, nombre_rol, descripcion FROM roles ORDER BY nombre_rol");

const obtenerAreas = () => consultar("SELECT id_area, nombre_area, descripcion FROM areas ORDER BY nombre_area");

const obtenerCargos = () => consultar("SELECT id_cargo, nombre_cargo, nivel FROM cargos ORDER BY nombre_cargo");

const obtenerTiposSolicitud = () => consultar("SELECT id_tipo, nombre_tipo FROM tipos_solicitud ORDER BY nombre_tipo");

const obtenerTipoSolicitudPorId = async (id) => {
  const filas = await consultar("SELECT id_tipo, nombre_tipo FROM tipos_solicitud WHERE id_tipo = $1", [id]);
  return filas[0] || null;
};

module.exports = {
  obtenerRoles,
  obtenerAreas,
  obtenerCargos,
  obtenerTiposSolicitud,
  obtenerTipoSolicitudPorId,
};
