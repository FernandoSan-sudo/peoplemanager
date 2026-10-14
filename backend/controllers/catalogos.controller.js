const catalogosModel = require("../models/catalogos.model");

const responderCon = (funcionModelo) => async (req, res) => {
  res.status(200).json(await funcionModelo());
};

module.exports = {
  obtenerRoles: responderCon(catalogosModel.obtenerRoles),
  obtenerAreas: responderCon(catalogosModel.obtenerAreas),
  obtenerCargos: responderCon(catalogosModel.obtenerCargos),
  obtenerTiposSolicitud: responderCon(catalogosModel.obtenerTiposSolicitud),
};
