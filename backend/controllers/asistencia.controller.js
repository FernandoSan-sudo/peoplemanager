/**
 * controllers/asistencia.controller.js
 * -----------------------------------------------------------
 * Registra entrada y salida de un turno. El "estado" (a tiempo,
 * tardanza, salida anticipada) se calcula aquí comparando la
 * hora actual del servidor contra hora_inicio/hora_fin del
 * turno correspondiente (pm.turnos), sin depender de que el
 * front-end envíe esa información.
 */

const asistenciaModel = require("../models/asistencia.model");
const turnosModel = require("../models/turnos.model");

const TOLERANCIA_MINUTOS = 10; // minutos de gracia antes de marcar tardanza

const minutosEntre = (horaA, horaB) => {
  // horaA, horaB en formato "HH:MM:SS" o "HH:MM"
  const [hA, mA] = horaA.split(":").map(Number);
  const [hB, mB] = horaB.split(":").map(Number);
  return (hA * 60 + mA) - (hB * 60 + mB);
};

const horaActualHHMM = () => {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
};

const registrarEntrada = (req, res) => {
  const { id_turno, id_usuario } = req.body;

  if (!id_turno || !id_usuario) {
    return res.status(400).json({ mensaje: "El id del turno y del usuario son obligatorios" });
  }

  turnosModel.obtenerPorId(id_turno, (error, resultados) => {
    if (error) {
      console.error("Error al consultar turno:", error.message);
      return res.status(500).json({ mensaje: "Error al registrar la entrada" });
    }
    if (resultados.length === 0) {
      return res.status(404).json({ mensaje: "Turno no encontrado" });
    }

    const turno = resultados[0];
    const horaActual = horaActualHHMM();
    const diferencia = minutosEntre(horaActual, turno.hora_inicio.slice(0, 5));
    const minutosTardanza = diferencia > TOLERANCIA_MINUTOS ? diferencia : 0;
    const estadoRegistro = minutosTardanza > 0 ? "tardanza" : "completo";

    asistenciaModel.registrarEntrada(
      { id_turno, id_usuario, minutos_tardanza: minutosTardanza, estado_registro: estadoRegistro },
      (errorRegistro, resultado) => {
        if (errorRegistro) {
          console.error("Error al registrar entrada:", errorRegistro.message);
          return res.status(500).json({ mensaje: "Error al registrar la entrada" });
        }
        res.status(201).json({
          mensaje: minutosTardanza > 0 ? `Entrada registrada con ${minutosTardanza} minutos de tardanza` : "Entrada registrada a tiempo",
          asistencia: resultado,
        });
      }
    );
  });
};

const registrarSalida = (req, res) => {
  const { id_turno } = req.body;

  if (!id_turno) {
    return res.status(400).json({ mensaje: "El id del turno es obligatorio" });
  }

  turnosModel.obtenerPorId(id_turno, (error, resultados) => {
    if (error) {
      console.error("Error al consultar turno:", error.message);
      return res.status(500).json({ mensaje: "Error al registrar la salida" });
    }
    if (resultados.length === 0) {
      return res.status(404).json({ mensaje: "Turno no encontrado" });
    }

    const turno = resultados[0];
    const horaActual = horaActualHHMM();
    const esAnticipada = minutosEntre(turno.hora_fin.slice(0, 5), horaActual) > TOLERANCIA_MINUTOS;
    const estadoRegistro = esAnticipada ? "salida_anticipada" : "completo";

    asistenciaModel.registrarSalida(id_turno, estadoRegistro, (errorRegistro, resultados2) => {
      if (errorRegistro) {
        console.error("Error al registrar salida:", errorRegistro.message);
        return res.status(500).json({ mensaje: "Error al registrar la salida" });
      }
      if (resultados2.length === 0) {
        return res.status(404).json({ mensaje: "No hay una entrada abierta para este turno" });
      }
      res.status(200).json({
        mensaje: esAnticipada ? "Salida registrada de forma anticipada" : "Salida registrada correctamente",
        asistencia: resultados2[0],
      });
    });
  });
};

const obtenerPorUsuario = (req, res) => {
  const { idUsuario } = req.params;
  asistenciaModel.obtenerPorUsuario(idUsuario, (error, resultados) => {
    if (error) {
      console.error("Error al consultar asistencia:", error.message);
      return res.status(500).json({ mensaje: "Error al consultar la asistencia" });
    }
    res.status(200).json(resultados);
  });
};

module.exports = {
  registrarEntrada,
  registrarSalida,
  obtenerPorUsuario,
};
