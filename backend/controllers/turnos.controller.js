/**
 * controllers/turnos.controller.js
 * -----------------------------------------------------------
 * Planificación de turnos. Reglas de negocio:
 *   - Solo se asignan turnos a empleados ACTIVOS y en fechas de hoy
 *     en adelante.
 *   - Un empleado no puede tener dos turnos que se crucen el mismo día.
 *   - No se asignan turnos en días cubiertos por una solicitud
 *     aprobada (vacaciones, permiso, incapacidad).
 *   - Un turno con asistencia registrada, o de una fecha pasada, ya es
 *     historial: no se edita ni se elimina.
 *   - Un Empleado solo ve sus propios turnos.
 */

const turnosModel = require("../models/turnos.model");
const usuariosModel = require("../models/usuarios.model");
const solicitudesModel = require("../models/solicitudes.model");
const auditoria = require("../models/auditoria.model");
const { esGestor } = require("../config/roles");
const { esFechaValida, esHoraValida, esIdValido } = require("../utils/validaciones");
const { fechaLocalISO, minutosDelDia, sumarDias, diaDeLaSemana, formatoCorto } = require("../utils/fechas");

const TABLA = "pm.turnos";
const JORNADA_MAXIMA_HORAS = 12;
const MAXIMO_DIAS_POR_LOTE = 62;

const hhmm = (hora) => String(hora).slice(0, 5);

/** Valida fecha y horario. Devuelve un mensaje de error o null. */
const validarHorario = ({ fecha_turno, hora_inicio, hora_fin }) => {
  if (!esFechaValida(fecha_turno)) return "La fecha del turno no es válida (formato AAAA-MM-DD)";
  if (!esHoraValida(hora_inicio) || !esHoraValida(hora_fin)) return "Las horas deben tener el formato HH:MM";
  if (minutosDelDia(hora_fin) <= minutosDelDia(hora_inicio)) return "La hora de fin debe ser posterior a la hora de inicio";
  if (minutosDelDia(hora_fin) - minutosDelDia(hora_inicio) > JORNADA_MAXIMA_HORAS * 60) {
    return `Un turno no puede superar ${JORNADA_MAXIMA_HORAS} horas`;
  }
  return null;
};

/**
 * Revisa que el empleado esté libre en esa fecha y horario.
 * Devuelve un mensaje de conflicto o null si está disponible.
 */
const verificarDisponibilidad = async ({ idUsuario, fecha, horaInicio, horaFin, excluirId = null }) => {
  const cruce = await turnosModel.buscarCruce({ idUsuario, fecha, horaInicio, horaFin, excluirId });
  if (cruce) {
    return `El empleado ya tiene un turno de ${hhmm(cruce.hora_inicio)} a ${hhmm(cruce.hora_fin)} el ${formatoCorto(fecha)} que se cruza con este horario`;
  }
  const solicitud = await solicitudesModel.buscarAprobadaEnFecha(idUsuario, fecha);
  if (solicitud) {
    return `El empleado tiene ${solicitud.nombre_tipo.toLowerCase()} aprobada del ${formatoCorto(solicitud.fecha_inicio)} al ${formatoCorto(solicitud.fecha_fin)}`;
  }
  return null;
};

const obtenerTodos = async (req, res) => {
  const { id_usuario, id_area, fecha, desde, hasta } = req.query;

  for (const [nombre, valor] of Object.entries({ fecha, desde, hasta })) {
    if (valor && !esFechaValida(valor)) {
      return res.status(400).json({ mensaje: `El filtro "${nombre}" debe tener el formato AAAA-MM-DD` });
    }
  }
  if ((id_usuario && !esIdValido(id_usuario)) || (id_area && !esIdValido(id_area))) {
    return res.status(400).json({ mensaje: "Los filtros id_usuario e id_area deben ser números válidos" });
  }

  // Un empleado solo puede ver sus propios turnos, sin importar lo que pida en la URL.
  const idUsuario = esGestor(req.usuario) ? id_usuario : req.usuario.id_usuario;

  res.status(200).json(await turnosModel.listar({ idUsuario, idArea: id_area, fecha, desde, hasta }));
};

const obtenerPorId = async (req, res) => {
  const turno = await turnosModel.obtenerPorId(req.params.id);
  if (!turno || (!esGestor(req.usuario) && turno.id_usuario !== req.usuario.id_usuario)) {
    return res.status(404).json({ mensaje: "Turno no encontrado" });
  }
  res.status(200).json(turno);
};

const crear = async (req, res) => {
  const { id_usuario, fecha_turno, hora_inicio, hora_fin } = req.body;
  let { id_area } = req.body;

  if (!id_usuario || !fecha_turno || !hora_inicio || !hora_fin) {
    return res.status(400).json({ mensaje: "Usuario, fecha, hora de inicio y hora de fin son obligatorios" });
  }
  if (!esIdValido(id_usuario) || (id_area && !esIdValido(id_area))) {
    return res.status(400).json({ mensaje: "El empleado o el área indicados no son válidos" });
  }
  const errorHorario = validarHorario({ fecha_turno, hora_inicio, hora_fin });
  if (errorHorario) return res.status(400).json({ mensaje: errorHorario });

  if (fecha_turno < fechaLocalISO()) {
    return res.status(400).json({ mensaje: "No se pueden asignar turnos en fechas anteriores a hoy" });
  }

  const empleado = await usuariosModel.obtenerPorId(id_usuario);
  if (!empleado) return res.status(404).json({ mensaje: "El empleado indicado no existe" });
  if (empleado.estado !== "activo") {
    return res.status(409).json({ mensaje: "No se pueden asignar turnos a un empleado inactivo" });
  }

  const conflicto = await verificarDisponibilidad({ idUsuario: id_usuario, fecha: fecha_turno, horaInicio: hora_inicio, horaFin: hora_fin });
  if (conflicto) return res.status(409).json({ mensaje: conflicto });

  // Si no se indica área, el turno queda en el área del empleado.
  id_area = id_area || empleado.id_area;

  const idNuevo = await turnosModel.crear({
    id_usuario,
    fecha_turno,
    hora_inicio,
    hora_fin,
    id_area,
    creado_por: req.usuario.id_usuario,
  });

  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "CREAR_TURNO",
    tabla: TABLA,
    id_registro: idNuevo,
    detalle: `Turno ${formatoCorto(fecha_turno)} ${hhmm(hora_inicio)}-${hhmm(hora_fin)} para ${empleado.nombre_completo}`,
  });

  res.status(201).json({ mensaje: "Turno creado correctamente", id: idNuevo });
};

/**
 * Asignación masiva: el mismo horario para un empleado en un rango de
 * fechas, solo en los días de la semana elegidos (por ejemplo, lunes a
 * viernes de todo el mes). Los días con conflicto se omiten y se informan.
 */
/** Valida los datos de una asignación masiva. Devuelve un mensaje de error o null. */
const validarLote = ({ id_usuario, id_area, fecha_inicio, fecha_fin, hora_inicio, hora_fin }, dias) => {
  if (!id_usuario || !fecha_inicio || !fecha_fin || !hora_inicio || !hora_fin) {
    return "Usuario, rango de fechas, hora de inicio y hora de fin son obligatorios";
  }
  if (!esIdValido(id_usuario) || (id_area && !esIdValido(id_area))) return "El empleado o el área indicados no son válidos";
  if (!esFechaValida(fecha_fin)) return "La fecha final no es válida";

  const errorHorario = validarHorario({ fecha_turno: fecha_inicio, hora_inicio, hora_fin });
  if (errorHorario) return errorHorario;

  if (fecha_fin < fecha_inicio) return "La fecha final no puede ser anterior a la fecha inicial";
  if (fecha_inicio < fechaLocalISO()) return "No se pueden asignar turnos en fechas anteriores a hoy";
  if (sumarDias(fecha_inicio, MAXIMO_DIAS_POR_LOTE - 1) < fecha_fin) return `El rango no puede superar ${MAXIMO_DIAS_POR_LOTE} días`;
  if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return "dias_semana debe contener números del 0 (domingo) al 6 (sábado)";
  }
  return null;
};

const mensajeDeLote = (creados, omitidos) => {
  if (!creados.length) {
    return "No se creó ningún turno: todos los días elegidos tienen conflictos o no coinciden con los días de la semana";
  }
  const detalleOmitidos = omitidos.length ? ` y se omitieron ${omitidos.length} por conflictos` : "";
  return `Se crearon ${creados.length} turnos${detalleOmitidos}`;
};

const crearLote = async (req, res) => {
  const { id_usuario, fecha_inicio, fecha_fin, hora_inicio, hora_fin, dias_semana } = req.body;
  let { id_area } = req.body;

  // Por defecto, de lunes (1) a viernes (5).
  const dias = Array.isArray(dias_semana) && dias_semana.length ? dias_semana.map(Number) : [1, 2, 3, 4, 5];
  const errorLote = validarLote(req.body, dias);
  if (errorLote) return res.status(400).json({ mensaje: errorLote });

  const empleado = await usuariosModel.obtenerPorId(id_usuario);
  if (!empleado) return res.status(404).json({ mensaje: "El empleado indicado no existe" });
  if (empleado.estado !== "activo") {
    return res.status(409).json({ mensaje: "No se pueden asignar turnos a un empleado inactivo" });
  }
  id_area = id_area || empleado.id_area;

  const creados = [];
  const omitidos = [];

  for (let fecha = fecha_inicio; fecha <= fecha_fin; fecha = sumarDias(fecha, 1)) {
    if (!dias.includes(diaDeLaSemana(fecha))) continue;

    const conflicto = await verificarDisponibilidad({ idUsuario: id_usuario, fecha, horaInicio: hora_inicio, horaFin: hora_fin });
    if (conflicto) {
      omitidos.push({ fecha, motivo: conflicto });
      continue;
    }

    const idNuevo = await turnosModel.crear({
      id_usuario,
      fecha_turno: fecha,
      hora_inicio,
      hora_fin,
      id_area,
      creado_por: req.usuario.id_usuario,
    });
    creados.push({ id_turno: idNuevo, fecha });
  }

  if (creados.length) {
    await auditoria.registrar({
      id_usuario: req.usuario.id_usuario,
      accion: "CREAR_TURNOS_LOTE",
      tabla: TABLA,
      id_registro: creados[0].id_turno,
      detalle: `${creados.length} turnos ${hhmm(hora_inicio)}-${hhmm(hora_fin)} del ${formatoCorto(fecha_inicio)} al ${formatoCorto(fecha_fin)} para ${empleado.nombre_completo}`,
    });
  }

  res.status(creados.length ? 201 : 409).json({ mensaje: mensajeDeLote(creados, omitidos), creados, omitidos });
};

const actualizar = async (req, res) => {
  const id = Number(req.params.id);
  const { fecha_turno, hora_inicio, hora_fin, id_area } = req.body;

  if (!fecha_turno || !hora_inicio || !hora_fin) {
    return res.status(400).json({ mensaje: "Fecha, hora de inicio y hora de fin son obligatorios" });
  }
  if (id_area && !esIdValido(id_area)) return res.status(400).json({ mensaje: "El área indicada no es válida" });

  const errorHorario = validarHorario({ fecha_turno, hora_inicio, hora_fin });
  if (errorHorario) return res.status(400).json({ mensaje: errorHorario });

  const turno = await turnosModel.obtenerPorId(id);
  if (!turno) return res.status(404).json({ mensaje: "Turno no encontrado" });

  if (turno.id_asistencia) {
    return res.status(409).json({ mensaje: "No se puede editar: el turno ya tiene asistencia registrada" });
  }
  const hoy = fechaLocalISO();
  if (turno.fecha_turno < hoy) {
    return res.status(409).json({ mensaje: "No se puede editar un turno de una fecha pasada: ya forma parte del historial" });
  }
  if (fecha_turno < hoy) {
    return res.status(400).json({ mensaje: "No se puede mover un turno a una fecha anterior a hoy" });
  }

  const conflicto = await verificarDisponibilidad({
    idUsuario: turno.id_usuario,
    fecha: fecha_turno,
    horaInicio: hora_inicio,
    horaFin: hora_fin,
    excluirId: id,
  });
  if (conflicto) return res.status(409).json({ mensaje: conflicto });

  await turnosModel.actualizar(id, { fecha_turno, hora_inicio, hora_fin, id_area: id_area || turno.id_area });

  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "ACTUALIZAR_TURNO",
    tabla: TABLA,
    id_registro: id,
    detalle: `Turno de ${turno.nombre_usuario}: ${formatoCorto(turno.fecha_turno)} ${hhmm(turno.hora_inicio)}-${hhmm(turno.hora_fin)} → ${formatoCorto(fecha_turno)} ${hhmm(hora_inicio)}-${hhmm(hora_fin)}`,
  });

  res.status(200).json({ mensaje: "Turno actualizado correctamente" });
};

const eliminar = async (req, res) => {
  const id = Number(req.params.id);
  const turno = await turnosModel.obtenerPorId(id);
  if (!turno) return res.status(404).json({ mensaje: "Turno no encontrado" });

  if (turno.id_asistencia) {
    return res.status(409).json({ mensaje: "No se puede eliminar: el turno ya tiene asistencia registrada" });
  }
  if (turno.fecha_turno < fechaLocalISO()) {
    return res.status(409).json({ mensaje: "No se puede eliminar un turno de una fecha pasada: ya forma parte del historial" });
  }

  try {
    await turnosModel.eliminar(id);
  } catch (error) {
    // "23503" = ya existe un registro de asistencia asociado a este turno (se registró justo ahora).
    if (error.code === "23503") {
      return res.status(409).json({ mensaje: "No se puede eliminar: el turno ya tiene asistencia registrada" });
    }
    throw error;
  }

  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "ELIMINAR_TURNO",
    tabla: TABLA,
    id_registro: id,
    detalle: `Turno ${formatoCorto(turno.fecha_turno)} ${hhmm(turno.hora_inicio)}-${hhmm(turno.hora_fin)} de ${turno.nombre_usuario}`,
  });

  res.status(200).json({ mensaje: "Turno eliminado correctamente" });
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  crearLote,
  actualizar,
  eliminar,
};
