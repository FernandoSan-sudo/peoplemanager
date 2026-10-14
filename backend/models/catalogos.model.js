/**
 * models/catalogos.model.js
 * -----------------------------------------------------------
 * Tablas de catálogo (solo lectura desde la API): roles, areas,
 * cargos y tipos_solicitud. El front-end las usa para llenar los
 * <select> de los formularios (crear usuario, crear solicitud, etc.).
 */

const pool = require("../config/database");

const obtenerRoles = (callback) => {
  pool.query("SELECT id_rol, nombre_rol, descripcion FROM roles ORDER BY nombre_rol", (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerAreas = (callback) => {
  pool.query("SELECT id_area, nombre_area, descripcion FROM areas ORDER BY nombre_area", (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerCargos = (callback) => {
  pool.query("SELECT id_cargo, nombre_cargo FROM cargos ORDER BY nombre_cargo", (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

const obtenerTiposSolicitud = (callback) => {
  pool.query("SELECT id_tipo, nombre_tipo FROM tipos_solicitud ORDER BY nombre_tipo", (error, resultado) => {
    if (error) return callback(error);
    callback(null, resultado.rows);
  });
};

module.exports = {
  obtenerRoles,
  obtenerAreas,
  obtenerCargos,
  obtenerTiposSolicitud,
};
