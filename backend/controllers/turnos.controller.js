const turnosModel = require("../models/turnos.model");

const obtenerTodos = (req, res) => {
  const { id_usuario } = req.query;

  const callback = (error, resultados) => {
    if (error) {
      console.error("Error al consultar turnos:", error.message);
      return res.status(500).json({ mensaje: "Error al consultar los turnos" });
    }
    res.status(200).json(resultados);
  };

  // ?id_usuario=3 permite al front-end pedir solo los turnos de un empleado
  // (por ejemplo, para que un empleado vea únicamente los suyos).
  if (id_usuario) {
    turnosModel.obtenerPorUsuario(id_usuario, callback);
  } else {
    turnosModel.obtenerTodos(callback);
  }
};

const obtenerPorId = (req, res) => {
  const { id } = req.params;
  turnosModel.obtenerPorId(id, (error, resultados) => {
    if (error) {
      console.error("Error al consultar turno:", error.message);
      return res.status(500).json({ mensaje: "Error al consultar el turno" });
    }
    if (resultados.length === 0) {
      return res.status(404).json({ mensaje: "Turno no encontrado" });
    }
    res.status(200).json(resultados[0]);
  });
};

const crear = (req, res) => {
  const { id_usuario, fecha_turno, hora_inicio, hora_fin, id_area, creado_por } = req.body;

  if (!id_usuario || !fecha_turno || !hora_inicio || !hora_fin || !creado_por) {
    return res.status(400).json({
      mensaje: "Usuario, fecha, hora de inicio, hora de fin y creador son obligatorios",
    });
  }

  if (hora_fin <= hora_inicio) {
    return res.status(400).json({ mensaje: "La hora de fin debe ser posterior a la hora de inicio" });
  }

  turnosModel.crear({ id_usuario, fecha_turno, hora_inicio, hora_fin, id_area, creado_por }, (error, resultado) => {
    if (error) {
      // "23503" = violación de llave foránea (id_usuario, id_area o creado_por no existen).
      if (error.code === "23503") {
        return res.status(400).json({ mensaje: "El usuario, área o creador indicado no existe" });
      }
      console.error("Error al crear turno:", error.message);
      return res.status(500).json({ mensaje: "Error al crear el turno" });
    }
    res.status(201).json({ mensaje: "Turno creado correctamente", id: resultado.insertId });
  });
};

const actualizar = (req, res) => {
  const { id } = req.params;
  const { fecha_turno, hora_inicio, hora_fin, id_area } = req.body;

  if (!fecha_turno || !hora_inicio || !hora_fin) {
    return res.status(400).json({ mensaje: "Fecha, hora de inicio y hora de fin son obligatorios" });
  }

  if (hora_fin <= hora_inicio) {
    return res.status(400).json({ mensaje: "La hora de fin debe ser posterior a la hora de inicio" });
  }

  turnosModel.actualizar(id, { fecha_turno, hora_inicio, hora_fin, id_area }, (error, resultado) => {
    if (error) {
      console.error("Error al actualizar turno:", error.message);
      return res.status(500).json({ mensaje: "Error al actualizar el turno" });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Turno no encontrado" });
    }
    res.status(200).json({ mensaje: "Turno actualizado correctamente" });
  });
};

const eliminar = (req, res) => {
  const { id } = req.params;

  turnosModel.eliminar(id, (error, resultado) => {
    if (error) {
      // "23503" = ya existe un registro de asistencia asociado a este turno.
      if (error.code === "23503") {
        return res.status(409).json({ mensaje: "No se puede eliminar: el turno ya tiene asistencia registrada" });
      }
      console.error("Error al eliminar turno:", error.message);
      return res.status(500).json({ mensaje: "Error al eliminar el turno" });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Turno no encontrado" });
    }
    res.status(200).json({ mensaje: "Turno eliminado correctamente" });
  });
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};
