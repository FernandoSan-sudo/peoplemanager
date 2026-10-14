/**
 * controllers/nomina.controller.js
 * -----------------------------------------------------------
 * Liquidación mensual a partir de la asistencia real.
 *   1. Vista previa: calcula las horas de cada empleado del mes
 *      (sin guardar) y las compara con lo que ya haya en pm.nomina.
 *   2. Calcular: guarda en pm.nomina (estado "calculada"). Se puede
 *      repetir mientras no esté aprobada.
 *   3. Ajustes: bonificaciones y descuentos manuales, con motivo.
 *   4. Aprobar -> Pagar. Nadie aprueba ni paga su propia nómina.
 * Un Empleado solo ve sus nóminas aprobadas o pagadas (desprendible).
 */

const nominaModel = require("../models/nomina.model");
const turnosModel = require("../models/turnos.model");
const auditoria = require("../models/auditoria.model");
const { ADMINISTRAN_USUARIOS } = require("../config/roles");
const { consolidarMes, calcularTotal, TARIFAS_BD, porcentajeRecargoDominical, inicioNocturno } = require("../utils/reglasNomina");
const { fechaLocalISO, sumarDias } = require("../utils/fechas");

const TABLA = "pm.nomina";
const MAXIMO_AJUSTE = 50000000;
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const dosDigitos = (n) => String(n).padStart(2, "0");

/** Valida año/mes y devuelve el rango de fechas del periodo, o un mensaje de error. */
const periodoDesde = (anio, mes) => {
  const a = Number(anio);
  const m = Number(mes);
  if (!Number.isInteger(a) || a < 2000 || a > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
    return { error: "Indique un año y un mes válidos" };
  }
  const desde = `${a}-${dosDigitos(m)}-01`;
  const hasta = sumarDias(m === 12 ? `${a + 1}-01-01` : `${a}-${dosDigitos(m + 1)}-01`, -1);
  const hoy = fechaLocalISO();
  if (desde > hoy) return { error: "No se puede liquidar un mes que todavía no ha empezado" };
  return { anio: a, mes: m, desde, hasta, cerrado: hasta < hoy, nombre: `${NOMBRES_MES[m - 1]} de ${a}` };
};

/** Calcula la liquidación de todos los empleados con turnos (o nómina guardada) en el periodo. */
const liquidarPeriodo = async (periodo) => {
  const [turnos, guardadas] = await Promise.all([
    turnosModel.listar({ desde: periodo.desde, hasta: periodo.hasta }),
    nominaModel.listar({ anio: periodo.anio, mes: periodo.mes }),
  ]);

  const empleados = new Map();
  const obtener = (id, nombre, area) => {
    if (!empleados.has(id)) empleados.set(id, { id_usuario: id, nombre_usuario: nombre, nombre_area: area, turnos: [] });
    return empleados.get(id);
  };
  turnos.forEach((t) => obtener(t.id_usuario, t.nombre_usuario, t.nombre_area).turnos.push(t));
  guardadas.forEach((n) => obtener(n.id_usuario, n.nombre_usuario, n.nombre_area));

  return [...empleados.values()]
    .map((e) => {
      const guardada = guardadas.find((n) => n.id_usuario === e.id_usuario) || null;
      // Al recalcular se conservan las bonificaciones y descuentos que RRHH ya ingresó.
      const calculo = consolidarMes(e.turnos, {
        bonificaciones: guardada ? guardada.bonificaciones : 0,
        descuentos: guardada ? guardada.descuentos : 0,
      });
      return {
        id_usuario: e.id_usuario,
        nombre_usuario: e.nombre_usuario,
        nombre_area: e.nombre_area,
        calculo,
        guardada,
        diferente: Boolean(guardada) && calcularTotal(guardada) !== calculo.total_estimado,
      };
    })
    .sort((a, b) => a.nombre_usuario.localeCompare(b.nombre_usuario));
};

const sinDetalle = ({ detalle, ...resto }) => resto;

const previsualizar = async (req, res) => {
  const periodo = periodoDesde(req.query.anio, req.query.mes);
  if (periodo.error) return res.status(400).json({ mensaje: periodo.error });

  const empleados = await liquidarPeriodo(periodo);
  const totales = empleados.reduce(
    (acum, e) => {
      acum.calculado += e.calculo.total_estimado;
      acum.guardado += e.guardada ? e.guardada.total_pagar : 0;
      acum.horas += e.calculo.horas_ordinarias + e.calculo.horas_extra_diurna + e.calculo.horas_extra_noct;
      return acum;
    },
    { calculado: 0, guardado: 0, horas: 0 }
  );
  totales.horas = Math.round(totales.horas * 100) / 100;

  res.status(200).json({
    periodo: { anio: periodo.anio, mes: periodo.mes, nombre: periodo.nombre, desde: periodo.desde, hasta: periodo.hasta, cerrado: periodo.cerrado },
    parametros: {
      tarifas: TARIFAS_BD,
      recargo_dominical_porcentaje: porcentajeRecargoDominical(periodo.hasta),
      inicio_nocturno: `${dosDigitos(Math.floor(inicioNocturno(periodo.hasta) / 60))}:00`,
    },
    totales,
    empleados: empleados.map((e) => ({ ...e, calculo: sinDetalle(e.calculo) })),
  });
};

const calcular = async (req, res) => {
  const periodo = periodoDesde(req.body.anio, req.body.mes);
  if (periodo.error) return res.status(400).json({ mensaje: periodo.error });

  const soloIds = Array.isArray(req.body.ids_usuario) ? req.body.ids_usuario.map(Number) : null;
  const empleados = (await liquidarPeriodo(periodo)).filter((e) => !soloIds || soloIds.includes(e.id_usuario));

  const guardadas = [];
  const omitidas = [];

  for (const e of empleados) {
    if (e.guardada && e.guardada.estado !== "calculada") {
      omitidas.push({ id_usuario: e.id_usuario, nombre_usuario: e.nombre_usuario, motivo: `La nómina ya está ${e.guardada.estado}` });
      continue;
    }
    if (!e.calculo.turnos) {
      omitidas.push({ id_usuario: e.id_usuario, nombre_usuario: e.nombre_usuario, motivo: "No tiene turnos en el periodo" });
      continue;
    }
    const resultado = await nominaModel.guardar({ id_usuario: e.id_usuario, anio: periodo.anio, mes: periodo.mes, horas: e.calculo });
    if (!resultado) {
      omitidas.push({ id_usuario: e.id_usuario, nombre_usuario: e.nombre_usuario, motivo: "La nómina cambió de estado mientras se calculaba" });
      continue;
    }
    guardadas.push({ id_nomina: resultado.id_nomina, id_usuario: e.id_usuario, nombre_usuario: e.nombre_usuario, total_pagar: resultado.total_pagar });
    await auditoria.registrar({
      id_usuario: req.usuario.id_usuario,
      accion: "CALCULAR_NOMINA",
      tabla: TABLA,
      id_registro: resultado.id_nomina,
      detalle: `Nómina ${periodo.nombre} calculada para ${e.nombre_usuario}: $${resultado.total_pagar.toLocaleString("es-CO")}`,
    });
  }

  const mensaje = guardadas.length
    ? `Se guardaron ${guardadas.length} nóminas de ${periodo.nombre}` + (omitidas.length ? ` (${omitidas.length} omitidas)` : "")
    : "No se guardó ninguna nómina";
  res.status(guardadas.length ? 200 : 409).json({ mensaje, guardadas, omitidas, mes_cerrado: periodo.cerrado });
};

const listarMias = async (req, res) => {
  res.status(200).json(await nominaModel.listar({ idUsuario: req.usuario.id_usuario, estados: ["aprobada", "pagada"] }));
};

/** Desprendible: la nómina guardada + el detalle por turno recalculado desde la asistencia. */
const detalle = async (req, res) => {
  const nomina = await nominaModel.obtenerPorId(req.params.id);
  const esGestionNomina = ADMINISTRAN_USUARIOS.includes(req.usuario.nombre_rol);
  const esPropiaVisible = nomina && nomina.id_usuario === req.usuario.id_usuario && nomina.estado !== "calculada";
  if (!nomina || (!esGestionNomina && !esPropiaVisible)) {
    return res.status(404).json({ mensaje: "Nómina no encontrada" });
  }

  const periodo = periodoDesde(nomina.periodo_anio, nomina.periodo_mes);
  const turnos = await turnosModel.listar({ idUsuario: nomina.id_usuario, desde: periodo.desde, hasta: periodo.hasta });
  const calculo = consolidarMes(turnos, nomina);

  res.status(200).json({
    nomina,
    periodo: { nombre: periodo.nombre, desde: periodo.desde, hasta: periodo.hasta },
    calculo,
    coincide_con_asistencia:
      calculo.horas_ordinarias === nomina.horas_ordinarias &&
      calculo.horas_extra_diurna === nomina.horas_extra_diurna &&
      calculo.horas_extra_noct === nomina.horas_extra_noct &&
      calculo.recargo_festivo === nomina.recargo_festivo,
    tarifas: TARIFAS_BD,
  });
};

/** Busca la nómina y valida que no sea la propia (nadie ajusta, aprueba ni paga su propio pago). */
const obtenerParaGestionar = async (req, res) => {
  const nomina = await nominaModel.obtenerPorId(req.params.id);
  if (!nomina) {
    res.status(404).json({ mensaje: "Nómina no encontrada" });
    return null;
  }
  if (nomina.id_usuario === req.usuario.id_usuario) {
    res.status(403).json({ mensaje: "No puede gestionar su propia nómina; debe hacerlo otra persona" });
    return null;
  }
  return nomina;
};

const ajustar = async (req, res) => {
  const bonificaciones = Number(req.body.bonificaciones ?? 0);
  const descuentos = Number(req.body.descuentos ?? 0);
  const motivo = typeof req.body.motivo === "string" ? req.body.motivo.trim() : "";

  for (const [nombre, valor] of Object.entries({ bonificaciones, descuentos })) {
    if (!Number.isFinite(valor) || valor < 0 || valor > MAXIMO_AJUSTE) {
      return res.status(400).json({ mensaje: `Las ${nombre} deben ser un valor entre 0 y ${MAXIMO_AJUSTE.toLocaleString("es-CO")}` });
    }
  }
  if (motivo.length < 5) return res.status(400).json({ mensaje: "Indique el motivo del ajuste (mínimo 5 caracteres)" });

  const nomina = await obtenerParaGestionar(req, res);
  if (!nomina) return;
  if (nomina.estado !== "calculada") {
    return res.status(409).json({ mensaje: `No se puede ajustar una nómina ${nomina.estado}` });
  }

  await nominaModel.actualizarAjustes(nomina.id_nomina, { bonificaciones, descuentos });
  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion: "AJUSTAR_NOMINA",
    tabla: TABLA,
    id_registro: nomina.id_nomina,
    detalle: `${nomina.nombre_usuario}: bonificaciones $${bonificaciones.toLocaleString("es-CO")}, descuentos $${descuentos.toLocaleString("es-CO")}. Motivo: ${motivo}`,
  });

  const actualizada = await nominaModel.obtenerPorId(nomina.id_nomina);
  res.status(200).json({ mensaje: "Ajustes guardados", nomina: actualizada });
};

const avanzarEstado = (estadoActual, estadoNuevo, accion) => async (req, res) => {
  const nomina = await obtenerParaGestionar(req, res);
  if (!nomina) return;

  if (nomina.estado !== estadoActual) {
    return res.status(409).json({ mensaje: `La nómina está ${nomina.estado}; solo se puede marcar como ${estadoNuevo} desde "${estadoActual}"` });
  }
  if (estadoNuevo === "aprobada" && nomina.total_pagar < 0) {
    return res.status(409).json({ mensaje: "El total a pagar es negativo: revise los descuentos antes de aprobar" });
  }

  const actualizadas = await nominaModel.cambiarEstado(nomina.id_nomina, estadoActual, estadoNuevo);
  if (!actualizadas) return res.status(409).json({ mensaje: "La nómina cambió de estado; recargue la página" });

  await auditoria.registrar({
    id_usuario: req.usuario.id_usuario,
    accion,
    tabla: TABLA,
    id_registro: nomina.id_nomina,
    detalle: `Nómina de ${nomina.nombre_usuario} (${NOMBRES_MES[nomina.periodo_mes - 1]} ${nomina.periodo_anio}) ${estadoNuevo}: $${nomina.total_pagar.toLocaleString("es-CO")}`,
  });

  res.status(200).json({ mensaje: `Nómina ${estadoNuevo} correctamente` });
};

module.exports = {
  previsualizar,
  calcular,
  listarMias,
  detalle,
  ajustar,
  aprobar: avanzarEstado("calculada", "aprobada", "APROBAR_NOMINA"),
  pagar: avanzarEstado("aprobada", "pagada", "PAGAR_NOMINA"),
};
