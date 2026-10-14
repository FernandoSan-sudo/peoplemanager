/**
 * controllers/activos.controller.js
 * -----------------------------------------------------------
 * Gestión de productos (activos de la empresa). Reglas:
 *   - El serial es único (sin importar mayúsculas) y se guarda en mayúsculas.
 *   - Un activo solo puede estar asignado a un empleado a la vez, y solo
 *     a empleados activos. Para entregarlo a otra persona, primero se devuelve.
 *   - El área de un activo cambia únicamente con un traslado, que queda en
 *     pm.asset_transfer_logs.
 *   - No se elimina un activo asignado ni uno con historial de traslados.
 *   - Cada movimiento queda en pm.auditoria con id_registro = id del activo,
 *     para reconstruir su historial.
 * Gestionan: Administrador y RRHH. Supervisor consulta. Cada empleado ve
 * los equipos que tiene asignados.
 */

const activosModel = require("../models/activos.model");
const usuariosModel = require("../models/usuarios.model");
const catalogosModel = require("../models/catalogos.model");
const auditoria = require("../models/auditoria.model");
const { esGestor } = require("../config/roles");
const { esIdValido } = require("../utils/validaciones");
const { fechaLocalISO, formatoCorto } = require("../utils/fechas");

const REGEX_SERIAL = /^[A-Z0-9][A-Z0-9\-_./]{1,99}$/;

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

/** Valida y normaliza nombre, serial y área. Devuelve { datos } o { error }. */
const validarActivo = (cuerpo) => {
  const datos = {
    nombre_activo: texto(cuerpo.nombre_activo),
    serial: texto(cuerpo.serial).toUpperCase(),
    id_area: cuerpo.id_area || null,
  };
  if (datos.nombre_activo.length < 2 || datos.nombre_activo.length > 100) {
    return { error: "El nombre del activo debe tener entre 2 y 100 caracteres" };
  }
  if (!REGEX_SERIAL.test(datos.serial)) {
    return { error: "El serial debe tener entre 2 y 100 caracteres: letras, números, guion, punto, barra o guion bajo" };
  }
  if (datos.id_area && !esIdValido(datos.id_area)) return { error: "El área indicada no es válida" };
  return { datos };
};

const registrar = (req, accion, idActivo, detalle) =>
  auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion,
    tabla: ["ASIGNAR_ACTIVO", "DEVOLVER_ACTIVO"].includes(accion) ? "pm.activos_asignados" : "pm.activos",
    id_registro: idActivo,
    detalle,
  });

const listar = async (req, res) => {
  const { id_area, estado, id_usuario } = req.query;
  if (estado && !["asignado", "disponible"].includes(estado)) {
    return res.status(400).json({ mensaje: "El estado debe ser 'asignado' o 'disponible'" });
  }
  if ((id_area && !esIdValido(id_area)) || (id_usuario && !esIdValido(id_usuario))) {
    return res.status(400).json({ mensaje: "Los filtros id_area e id_usuario deben ser números válidos" });
  }
  res.status(200).json(await activosModel.listar({ idArea: id_area, estado, idUsuario: id_usuario }));
};

const listarMios = async (req, res) => {
  res.status(200).json(await activosModel.listar({ idUsuario: req.usuario.id_usuario }));
};

const obtenerPorId = async (req, res) => {
  const activo = await activosModel.obtenerPorId(req.params.id);
  if (!activo || (!esGestor(req.usuario) && activo.id_usuario !== req.usuario.id_usuario)) {
    return res.status(404).json({ mensaje: "Activo no encontrado" });
  }
  res.status(200).json(activo);
};

const historial = async (req, res) => {
  const activo = await activosModel.obtenerPorId(req.params.id);
  if (!activo) return res.status(404).json({ mensaje: "Activo no encontrado" });
  res.status(200).json({ activo, movimientos: await activosModel.historial(activo.id_activo) });
};

const crear = async (req, res) => {
  const { datos, error } = validarActivo(req.body);
  if (error) return res.status(400).json({ mensaje: error });

  if (await activosModel.existeSerial(datos.serial)) {
    return res.status(409).json({ mensaje: `Ya existe un activo con el serial ${datos.serial}` });
  }

  let id;
  try {
    id = await activosModel.crear(datos);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ mensaje: `Ya existe un activo con el serial ${datos.serial}` });
    throw err;
  }

  await registrar(req, "CREAR_ACTIVO", id, `Registro de ${datos.nombre_activo} (serial ${datos.serial})`);
  res.status(201).json({ mensaje: "Activo creado correctamente", id });
};

const actualizar = async (req, res) => {
  const id = Number(req.params.id);
  const { datos, error } = validarActivo(req.body);
  if (error) return res.status(400).json({ mensaje: error });

  const actual = await activosModel.obtenerPorId(id);
  if (!actual) return res.status(404).json({ mensaje: "Activo no encontrado" });

  if (await activosModel.existeSerial(datos.serial, id)) {
    return res.status(409).json({ mensaje: `Ya existe otro activo con el serial ${datos.serial}` });
  }

  try {
    await activosModel.actualizar(id, datos);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ mensaje: `Ya existe otro activo con el serial ${datos.serial}` });
    throw err;
  }

  await registrar(req, "ACTUALIZAR_ACTIVO", id, `${actual.nombre_activo} (${actual.serial}) → ${datos.nombre_activo} (${datos.serial})`);
  res.status(200).json({ mensaje: "Activo actualizado correctamente" });
};

const eliminar = async (req, res) => {
  const id = Number(req.params.id);
  const activo = await activosModel.obtenerPorId(id);
  if (!activo) return res.status(404).json({ mensaje: "Activo no encontrado" });

  if (activo.id_asignacion) {
    return res.status(409).json({ mensaje: `No se puede eliminar: está asignado a ${activo.nombre_usuario}. Primero registre la devolución.` });
  }
  if (activo.traslados > 0) {
    return res.status(409).json({ mensaje: "No se puede eliminar: el activo tiene historial de traslados" });
  }

  try {
    await activosModel.eliminar(id);
  } catch (err) {
    if (err.code === "23503") return res.status(409).json({ mensaje: "No se puede eliminar: el activo tiene movimientos registrados" });
    throw err;
  }

  await registrar(req, "ELIMINAR_ACTIVO", id, `Eliminación de ${activo.nombre_activo} (serial ${activo.serial})`);
  res.status(200).json({ mensaje: "Activo eliminado correctamente" });
};

const asignar = async (req, res) => {
  const id = Number(req.params.id);
  const { id_usuario } = req.body;
  if (!id_usuario || !esIdValido(id_usuario)) return res.status(400).json({ mensaje: "Debe indicar el empleado que recibe el activo" });

  const activo = await activosModel.obtenerPorId(id);
  if (!activo) return res.status(404).json({ mensaje: "Activo no encontrado" });
  if (activo.id_asignacion) {
    return res.status(409).json({ mensaje: `El activo ya está asignado a ${activo.nombre_usuario}. Registre la devolución antes de reasignarlo.` });
  }

  const empleado = await usuariosModel.obtenerPorId(id_usuario);
  if (!empleado) return res.status(404).json({ mensaje: "El empleado indicado no existe" });
  if (empleado.estado !== "activo") return res.status(409).json({ mensaje: "No se pueden asignar activos a un empleado inactivo" });

  const idAsignacion = await activosModel.asignar(id, empleado.id_usuario, fechaLocalISO());
  if (!idAsignacion) return res.status(409).json({ mensaje: "El activo acaba de ser asignado a otra persona" });

  await registrar(req, "ASIGNAR_ACTIVO", id, `${activo.nombre_activo} (${activo.serial}) entregado a ${empleado.nombre_completo}`);
  res.status(201).json({ mensaje: `Activo asignado a ${empleado.nombre_completo}`, id_asignacion: idAsignacion });
};

const devolver = async (req, res) => {
  const id = Number(req.params.id);
  const activo = await activosModel.obtenerPorId(id);
  if (!activo) return res.status(404).json({ mensaje: "Activo no encontrado" });
  if (!activo.id_asignacion) return res.status(409).json({ mensaje: "El activo no está asignado a nadie" });

  const observacion = texto(req.body.observacion).slice(0, 200);
  await activosModel.devolver(id);
  await registrar(
    req,
    "DEVOLVER_ACTIVO",
    id,
    `${activo.nombre_activo} (${activo.serial}) devuelto por ${activo.nombre_usuario}; lo tenía desde el ${formatoCorto(activo.fecha_asignacion)}` +
      (observacion ? `. Observación: ${observacion}` : "")
  );
  res.status(200).json({ mensaje: `Devolución registrada: ${activo.nombre_usuario} entregó el activo` });
};

const trasladar = async (req, res) => {
  const id = Number(req.params.id);
  const { id_area } = req.body;
  if (!id_area || !esIdValido(id_area)) return res.status(400).json({ mensaje: "Debe indicar el área de destino" });

  const activo = await activosModel.obtenerPorId(id);
  if (!activo) return res.status(404).json({ mensaje: "Activo no encontrado" });
  if (Number(id_area) === activo.id_area) return res.status(400).json({ mensaje: "El activo ya pertenece a esa área" });

  const areas = await catalogosModel.obtenerAreas();
  const destino = areas.find((a) => a.id_area === Number(id_area));
  if (!destino) return res.status(400).json({ mensaje: "El área de destino no existe" });

  const traslado = await activosModel.trasladar(id, activo.id_area, destino.id_area);
  await registrar(req, "TRASLADAR_ACTIVO", id, `${activo.nombre_activo} (${activo.serial}): ${activo.nombre_area || "sin área"} → ${destino.nombre_area}`);
  res.status(200).json({ mensaje: `Activo trasladado a ${destino.nombre_area}`, traslado });
};

module.exports = {
  listar,
  listarMios,
  obtenerPorId,
  historial,
  crear,
  actualizar,
  eliminar,
  asignar,
  devolver,
  trasladar,
};
