/**
 * controllers/auditoria.controller.js
 * -----------------------------------------------------------
 * Consulta de la bitácora pm.auditoria (solo Administrador).
 * GET /api/auditoria?limite=100&accion=APROBAR_SOLICITUD&id_usuario=2
 */

const auditoriaModel = require("../models/auditoria.model");
const { esIdValido } = require("../utils/validaciones");

const listar = async (req, res) => {
  const { limite, accion, id_usuario } = req.query;
  if (id_usuario && !esIdValido(id_usuario)) {
    return res.status(400).json({ mensaje: "El filtro id_usuario no es válido" });
  }
  res.status(200).json(await auditoriaModel.listar({ limite, accion, idUsuario: id_usuario }));
};

const listarAcciones = async (req, res) => {
  res.status(200).json(await auditoriaModel.listarAcciones());
};

module.exports = {
  listar,
  listarAcciones,
};
