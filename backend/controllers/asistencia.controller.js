/**
 * controllers/asistencia.controller.js
 * -----------------------------------------------------------
 * Registra entrada y salida de un turno. El "estado" (a tiempo,
 * tardanza, salida anticipada) se calcula aquí, con la hora del
 * servidor, usando las reglas de utils/reglasAsistencia.js; el
 * front-end nunca envía el estado ni la hora.
 *
 * Reglas:
 *   - Un Empleado solo marca sus propios turnos; un gestor
 *     (Administrador, Supervisor, RRHH) puede marcar los de cualquiera.
 *   - Solo una entrada por turno, y solo el día del turno.
 *   - No se marca asistencia en un turno cubierto por una solicitud
 *     aprobada (el empleado está de vacaciones, permiso o incapacidad).
 */

const asistenciaModel = require("../models/asistencia.model");
const turnosModel = require("../models/turnos.model");
const auditoria = require("../models/auditoria.model");
const { esGestor } = require("../config/roles");
const { evaluarEntrada, evaluarSalida } = require("../utils/reglasAsistencia");
const { esIdValido, esFechaValida } = require("../utils/validaciones");
const { formatoCorto } = require("../utils/fechas");

const TABLA = "pm.asistencia";

/** Busca el turno y verifica que quien hace la petición pueda marcarlo. Responde el error y devuelve null si no. */
const obtenerTurnoAutorizado = async (req, res) => {
  const { id_turno } = req.body;

  if (!id_turno || !esIdValido(id_turno)) {
    res.status(400).json({ mensaje: "El id del turno es obligatorio" });
    return null;
  }

  const turno = await turnosModel.obtenerPorId(id_turno);
  if (!turno) {
    res.status(404).json({ mensaje: "Turno no encontrado" });
    return null;
  }

  if (!esGestor(req.usuario) && turno.id_usuario !== req.usuario.id_usuario) {
    res.status(403).json({ mensaje: "Solo puede registrar la asistencia de sus propios turnos" });
    return null;
  }

  return turno;
};

const registrarEntrada = async (req, res) => {
  const turno = await obtenerTurnoAutorizado(req, res);
  if (!turno) return;

  if (turno.id_asistencia) {
    return res.status(409).json({ mensaje: "Este turno ya tiene la entrada registrada" });
  }
  if (turno.id_solicitud_justifica) {
    return res.status(409).json({
      mensaje: `El empleado tiene ${String(turno.justificacion).toLowerCase()} aprobada para esta fecha; no debe registrar asistencia`,
    });
  }

  const ahora = new Date();
  const decision = evaluarEntrada(turno, ahora);
  if (!decision.permitido) {
    return res.status(409).json({ mensaje: decision.mensaje });
  }

  // El id del empleado sale del turno (no del body): así no se puede
  // registrar la entrada de un turno a nombre de otra persona.
  const registro = await asistenciaModel.registrarEntrada({
    id_turno: turno.id_turno,
    id_usuario: turno.id_usuario,
    hora: ahora,
    minutos_tardanza: decision.minutosTardanza,
    estado_registro: decision.estado,
  });

  if (!registro) {
    return res.status(409).json({ mensaje: "Este turno ya tiene la entrada registrada" });
  }

  const detalleTardanza = decision.minutosTardanza ? ": " + decision.minutosTardanza + " min de tardanza" : "";
  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "REGISTRAR_ENTRADA",
    tabla: TABLA,
    id_registro: registro.id_asistencia,
    detalle: `Entrada de ${turno.nombre_usuario} (${formatoCorto(turno.fecha_turno)})${detalleTardanza}`,
  });

  res.status(201).json({ mensaje: decision.mensaje, asistencia: registro });
};

const registrarSalida = async (req, res) => {
  const turno = await obtenerTurnoAutorizado(req, res);
  if (!turno) return;

  const registro = await asistenciaModel.obtenerPorTurno(turno.id_turno);
  if (!registro?.hora_entrada) {
    return res.status(409).json({ mensaje: "No hay una entrada registrada para este turno" });
  }
  if (registro.hora_salida) {
    return res.status(409).json({ mensaje: "La salida de este turno ya fue registrada" });
  }

  const ahora = new Date();
  const decision = evaluarSalida(turno, registro, ahora);
  if (!decision.permitido) {
    return res.status(409).json({ mensaje: decision.mensaje });
  }

  const actualizado = await asistenciaModel.registrarSalida(registro.id_asistencia, {
    hora: ahora,
    estado_registro: decision.estado,
    observaciones: decision.observaciones,
  });

  if (!actualizado) {
    return res.status(409).json({ mensaje: "La salida de este turno ya fue registrada" });
  }

  const detalleAnticipacion = decision.minutosAnticipacion ? ": " + decision.minutosAnticipacion + " min antes" : "";
  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "REGISTRAR_SALIDA",
    tabla: TABLA,
    id_registro: registro.id_asistencia,
    detalle: `Salida de ${turno.nombre_usuario} (${formatoCorto(turno.fecha_turno)})${detalleAnticipacion}`,
  });

  res.status(200).json({ mensaje: decision.mensaje, asistencia: actualizado });
};

/** GET /api/asistencia?id_usuario=&desde=&hasta= — historial con horas trabajadas. */
const listar = async (req, res) => {
  const { id_usuario, desde, hasta } = req.query;

  if ((desde && !esFechaValida(desde)) || (hasta && !esFechaValida(hasta))) {
    return res.status(400).json({ mensaje: "Los filtros de fecha deben tener el formato AAAA-MM-DD" });
  }
  if (id_usuario && !esIdValido(id_usuario)) {
    return res.status(400).json({ mensaje: "El filtro id_usuario no es válido" });
  }

  const idUsuario = esGestor(req.usuario) ? id_usuario : req.usuario.id_usuario;
  res.status(200).json(await asistenciaModel.listar({ idUsuario, desde, hasta }));
};

const obtenerPorUsuario = async (req, res) => {
  const idUsuario = Number(req.params.idUsuario);
  if (!esGestor(req.usuario) && idUsuario !== req.usuario.id_usuario) {
    return res.status(403).json({ mensaje: "Solo puede consultar su propio historial de asistencia" });
  }
  res.status(200).json(await asistenciaModel.listar({ idUsuario }));
};

module.exports = {
  registrarEntrada,
  registrarSalida,
  listar,
  obtenerPorUsuario,
};
