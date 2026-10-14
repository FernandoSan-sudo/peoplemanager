const solicitudesModel = require("../models/solicitudes.model");

const obtenerTodas = (req, res) => {
  const { id_usuario } = req.query;

  const callback = (error, resultados) => {
    if (error) {
      console.error("Error al consultar solicitudes:", error.message);
      return res.status(500).json({ mensaje: "Error al consultar las solicitudes" });
    }
    res.status(200).json(resultados);
  };

  if (id_usuario) {
    solicitudesModel.obtenerPorUsuario(id_usuario, callback);
  } else {
    solicitudesModel.obtenerTodas(callback);
  }
};

const obtenerPorId = (req, res) => {
  const { id } = req.params;
  solicitudesModel.obtenerPorId(id, (error, resultados) => {
    if (error) {
      console.error("Error al consultar solicitud:", error.message);
      return res.status(500).json({ mensaje: "Error al consultar la solicitud" });
    }
    if (resultados.length === 0) {
      return res.status(404).json({ mensaje: "Solicitud no encontrada" });
    }
    res.status(200).json(resultados[0]);
  });
};

const crear = (req, res) => {
  const { id_usuario, id_tipo, fecha_inicio, fecha_fin, motivo } = req.body;

  if (!id_usuario || !id_tipo || !fecha_inicio || !fecha_fin || !motivo) {
    return res.status(400).json({
      mensaje: "Usuario, tipo, fecha de inicio, fecha de fin y motivo son obligatorios",
    });
  }

  if (fecha_fin < fecha_inicio) {
    return res.status(400).json({ mensaje: "La fecha de fin no puede ser anterior a la fecha de inicio" });
  }

  solicitudesModel.crear({ id_usuario, id_tipo, fecha_inicio, fecha_fin, motivo }, (error, resultado) => {
    if (error) {
      if (error.code === "23503") {
        return res.status(400).json({ mensaje: "El usuario o el tipo de solicitud indicado no existe" });
      }
      console.error("Error al crear solicitud:", error.message);
      return res.status(500).json({ mensaje: "Error al crear la solicitud" });
    }
    res.status(201).json({ mensaje: "Solicitud creada correctamente", id: resultado.insertId });
  });
};

const responder = (estadoDestino) => (req, res) => {
  const { id } = req.params;
  const { id_aprobador, observacion_resp } = req.body;

  if (!id_aprobador) {
    return res.status(400).json({ mensaje: "El id del aprobador es obligatorio" });
  }

  solicitudesModel.responder(id, { estado: estadoDestino, id_aprobador, observacion_resp }, (error, resultado) => {
    if (error) {
      if (error.code === "23503") {
        return res.status(400).json({ mensaje: "El aprobador indicado no existe" });
      }
      console.error(`Error al ${estadoDestino === "aprobada" ? "aprobar" : "rechazar"} solicitud:`, error.message);
      return res.status(500).json({ mensaje: "Error al procesar la solicitud" });
    }
    if (resultado.affectedRows === 0) {
      return res.status(409).json({ mensaje: "La solicitud no existe o ya fue procesada anteriormente" });
    }
    res.status(200).json({ mensaje: `Solicitud ${estadoDestino === "aprobada" ? "aprobada" : "rechazada"} correctamente` });
  });
};

module.exports = {
  obtenerTodas,
  obtenerPorId,
  crear,
  aprobar: responder("aprobada"),
  rechazar: responder("rechazada"),
};
