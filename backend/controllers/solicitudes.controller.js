/**
 * controllers/solicitudes.controller.js
 * -----------------------------------------------------------
 * Permisos, vacaciones e incapacidades. Reglas de negocio:
 *   - El solicitante es quien tiene la sesión abierta. Un gestor
 *     puede registrar una solicitud a nombre de otro empleado (por
 *     ejemplo, RRHH radicando una incapacidad).
 *   - No se aceptan solicitudes en fechas pasadas, salvo
 *     incapacidades (se reportan después de ocurrir, hasta 30 días).
 *   - Un empleado no puede tener dos solicitudes pendientes/aprobadas
 *     que se crucen en fechas.
 *   - Nadie aprueba ni rechaza sus propias solicitudes; un Supervisor
 *     solo responde las de empleados de su misma área.
 *   - Al rechazar es obligatorio indicar el motivo.
 */

const solicitudesModel = require("../models/solicitudes.model");
const catalogosModel = require("../models/catalogos.model");
const usuariosModel = require("../models/usuarios.model");
const auditoria = require("../models/auditoria.model");
const { ROLES, esGestor } = require("../config/roles");
const { esFechaValida, esIdValido } = require("../utils/validaciones");
const { fechaLocalISO, sumarDias, formatoCorto } = require("../utils/fechas");

const TABLA = "pm.solicitudes";
const ESTADOS = ["pendiente", "aprobada", "rechazada"];
const MAXIMO_DIAS = 180;
const DIAS_RETROACTIVOS_INCAPACIDAD = 30;
const LONGITUD_MOTIVO = { min: 10, max: 500 };

const obtenerTodas = async (req, res) => {
  const { id_usuario, estado } = req.query;

  if (estado && !ESTADOS.includes(estado)) {
    return res.status(400).json({ mensaje: "El estado debe ser pendiente, aprobada o rechazada" });
  }
  if (id_usuario && !esIdValido(id_usuario)) {
    return res.status(400).json({ mensaje: "El filtro id_usuario no es válido" });
  }

  const idUsuario = esGestor(req.usuario) ? id_usuario : req.usuario.id_usuario;
  res.status(200).json(await solicitudesModel.listar({ idUsuario, estado }));
};

const obtenerPorId = async (req, res) => {
  const solicitud = await solicitudesModel.obtenerPorId(req.params.id);
  if (!solicitud || (!esGestor(req.usuario) && solicitud.id_usuario !== req.usuario.id_usuario)) {
    return res.status(404).json({ mensaje: "Solicitud no encontrada" });
  }
  res.status(200).json(solicitud);
};

/** Valida fechas según el tipo de solicitud. Devuelve un mensaje de error o null. */
const validarFechas = (tipo, fechaInicio, fechaFin) => {
  if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) return "Las fechas deben tener el formato AAAA-MM-DD";
  if (fechaFin < fechaInicio) return "La fecha de fin no puede ser anterior a la fecha de inicio";
  if (sumarDias(fechaInicio, MAXIMO_DIAS - 1) < fechaFin) return `Una solicitud no puede superar ${MAXIMO_DIAS} días`;

  const hoy = fechaLocalISO();
  const esIncapacidad = tipo.nombre_tipo.toLowerCase() === "incapacidad";

  if (esIncapacidad) {
    if (fechaInicio < sumarDias(hoy, -DIAS_RETROACTIVOS_INCAPACIDAD)) {
      return `Una incapacidad se debe reportar máximo ${DIAS_RETROACTIVOS_INCAPACIDAD} días después de su inicio`;
    }
  } else if (fechaInicio < hoy) {
    return `Una solicitud de ${tipo.nombre_tipo.toLowerCase()} no puede iniciar en una fecha pasada`;
  }
  return null;
};

const crear = async (req, res) => {
  const { id_tipo, fecha_inicio, fecha_fin } = req.body;
  const motivo = typeof req.body.motivo === "string" ? req.body.motivo.trim() : "";

  if (!id_tipo || !fecha_inicio || !fecha_fin || !motivo) {
    return res.status(400).json({ mensaje: "Tipo, fecha de inicio, fecha de fin y motivo son obligatorios" });
  }
  if (motivo.length < LONGITUD_MOTIVO.min || motivo.length > LONGITUD_MOTIVO.max) {
    return res.status(400).json({ mensaje: `El motivo debe tener entre ${LONGITUD_MOTIVO.min} y ${LONGITUD_MOTIVO.max} caracteres` });
  }
  if (!esIdValido(id_tipo)) return res.status(400).json({ mensaje: "El tipo de solicitud no es válido" });

  // Un empleado siempre solicita para sí mismo; un gestor puede indicar a otro empleado.
  let idUsuario = req.usuario.id_usuario;
  if (req.body.id_usuario && esGestor(req.usuario)) {
    if (!esIdValido(req.body.id_usuario)) return res.status(400).json({ mensaje: "El empleado indicado no es válido" });
    idUsuario = Number(req.body.id_usuario);
  }

  const tipo = await catalogosModel.obtenerTipoSolicitudPorId(id_tipo);
  if (!tipo) return res.status(400).json({ mensaje: "El tipo de solicitud indicado no existe" });

  const errorFechas = validarFechas(tipo, fecha_inicio, fecha_fin);
  if (errorFechas) return res.status(400).json({ mensaje: errorFechas });

  const empleado = await usuariosModel.obtenerPorId(idUsuario);
  if (empleado?.estado !== "activo") {
    return res.status(400).json({ mensaje: "El empleado indicado no existe o está inactivo" });
  }

  const cruce = await solicitudesModel.buscarCruce(idUsuario, fecha_inicio, fecha_fin);
  if (cruce) {
    return res.status(409).json({
      mensaje: `Ya existe una solicitud ${cruce.estado} de ${cruce.nombre_tipo.toLowerCase()} del ${formatoCorto(cruce.fecha_inicio)} al ${formatoCorto(cruce.fecha_fin)} que se cruza con estas fechas`,
    });
  }

  const idNueva = await solicitudesModel.crear({ id_usuario: idUsuario, id_tipo, fecha_inicio, fecha_fin, motivo });

  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "CREAR_SOLICITUD",
    tabla: TABLA,
    id_registro: idNueva,
    detalle: `${tipo.nombre_tipo} de ${empleado.nombre_completo} del ${formatoCorto(fecha_inicio)} al ${formatoCorto(fecha_fin)}`,
  });

  res.status(201).json({ mensaje: "Solicitud creada correctamente", id: idNueva });
};

const responder = (estadoDestino) => async (req, res) => {
  const id = Number(req.params.id);
  const observacion = typeof req.body.observacion_resp === "string" ? req.body.observacion_resp.trim() : "";
  const verbo = estadoDestino === "aprobada" ? "aprobar" : "rechazar";

  if (estadoDestino === "rechazada" && observacion.length < 5) {
    return res.status(400).json({ mensaje: "Para rechazar una solicitud debe indicar el motivo (mínimo 5 caracteres)" });
  }
  if (observacion.length > 500) {
    return res.status(400).json({ mensaje: "La observación no puede superar 500 caracteres" });
  }

  const solicitud = await solicitudesModel.obtenerPorId(id);
  if (!solicitud) return res.status(404).json({ mensaje: "Solicitud no encontrada" });

  if (solicitud.id_usuario === req.usuario.id_usuario) {
    return res.status(403).json({ mensaje: `No puede ${verbo} sus propias solicitudes` });
  }
  if (req.usuario.nombre_rol === ROLES.SUPERVISOR && solicitud.id_area !== req.usuario.id_area) {
    return res.status(403).json({ mensaje: "Un supervisor solo puede responder solicitudes de empleados de su área" });
  }
  if (solicitud.estado !== "pendiente") {
    return res.status(409).json({ mensaje: `La solicitud ya fue ${solicitud.estado} anteriormente` });
  }

  const actualizadas = await solicitudesModel.responder(id, {
    estado: estadoDestino,
    id_aprobador: req.usuario.id_usuario,
    observacion_resp: observacion,
  });
  if (actualizadas === 0) {
    return res.status(409).json({ mensaje: "La solicitud ya fue procesada anteriormente" });
  }

  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: estadoDestino === "aprobada" ? "APROBAR_SOLICITUD" : "RECHAZAR_SOLICITUD",
    tabla: TABLA,
    id_registro: id,
    detalle: `${solicitud.nombre_tipo} de ${solicitud.nombre_usuario} ${estadoDestino}`,
  });

  res.status(200).json({ mensaje: `Solicitud ${estadoDestino} correctamente` });
};

module.exports = {
  obtenerTodas,
  obtenerPorId,
  crear,
  aprobar: responder("aprobada"),
  rechazar: responder("rechazada"),
};
