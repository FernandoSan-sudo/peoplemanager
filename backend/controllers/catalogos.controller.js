const catalogosModel = require("../models/catalogos.model");

const manejarConsulta = (nombreRecurso, funcionModelo) => (req, res) => {
  funcionModelo((error, resultados) => {
    if (error) {
      console.error(`Error al consultar ${nombreRecurso}:`, error.message);
      return res.status(500).json({ mensaje: `Error al consultar ${nombreRecurso}` });
    }
    res.status(200).json(resultados);
  });
};

module.exports = {
  obtenerRoles: manejarConsulta("roles", catalogosModel.obtenerRoles),
  obtenerAreas: manejarConsulta("áreas", catalogosModel.obtenerAreas),
  obtenerCargos: manejarConsulta("cargos", catalogosModel.obtenerCargos),
  obtenerTiposSolicitud: manejarConsulta("tipos de solicitud", catalogosModel.obtenerTiposSolicitud),
};
