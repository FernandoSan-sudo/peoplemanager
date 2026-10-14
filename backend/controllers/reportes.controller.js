/**
 * controllers/reportes.controller.js
 * -----------------------------------------------------------
 * Dashboard y reportes de talento humano (solo lectura).
 *   - GET /api/reportes/resumen: turnos de HOY por estado y totales
 *     del mes. Un Empleado ve solo sus propios números.
 *   - GET /api/reportes/asistencia?desde=&hasta=&id_area=: consolidado
 *     por empleado (solo gestores).
 */

const reportesModel = require("../models/reportes.model");
const turnosModel = require("../models/turnos.model");
const { esGestor } = require("../config/roles");
const { esFechaValida, esIdValido } = require("../utils/validaciones");
const { fechaLocalISO, sumarDias } = require("../utils/fechas");

const MAXIMO_DIAS_REPORTE = 366;

const primerDiaDelMes = (fechaISO) => `${fechaISO.slice(0, 8)}01`;

const resumen = async (req, res) => {
  const hoy = fechaLocalISO();
  const idUsuario = esGestor(req.usuario) ? null : req.usuario.id_usuario;

  const [turnosHoy, totales] = await Promise.all([
    turnosModel.listar({ fecha: hoy, idUsuario }),
    reportesModel.totalesGenerales({ idUsuario, desdeMes: primerDiaDelMes(hoy), hastaMes: hoy }),
  ]);

  const hoyPorEstado = { pendiente: 0, completo: 0, tardanza: 0, salida_anticipada: 0, ausente: 0, justificado: 0 };
  turnosHoy.forEach((turno) => {
    hoyPorEstado[turno.estado_asistencia] = (hoyPorEstado[turno.estado_asistencia] || 0) + 1;
  });

  res.status(200).json({
    fecha: hoy,
    alcance: idUsuario ? "personal" : "general",
    turnos_hoy: {
      total: turnosHoy.length,
      por_estado: hoyPorEstado,
      en_turno: turnosHoy.filter((t) => t.hora_entrada && !t.hora_salida).length,
    },
    ...totales,
  });
};

const asistencia = async (req, res) => {
  const hoy = fechaLocalISO();
  const desde = req.query.desde || primerDiaDelMes(hoy);
  const hasta = req.query.hasta || hoy;
  const { id_area } = req.query;

  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    return res.status(400).json({ mensaje: "Las fechas deben tener el formato AAAA-MM-DD" });
  }
  if (hasta < desde) return res.status(400).json({ mensaje: "La fecha final no puede ser anterior a la inicial" });
  if (sumarDias(desde, MAXIMO_DIAS_REPORTE) < hasta) {
    return res.status(400).json({ mensaje: `El rango del reporte no puede superar ${MAXIMO_DIAS_REPORTE} días` });
  }
  if (id_area && !esIdValido(id_area)) return res.status(400).json({ mensaje: "El área indicada no es válida" });

  const filas = await reportesModel.asistenciaPorEmpleado({ desde, hasta, idArea: id_area });

  const totales = filas.reduce(
    (acum, fila) => {
      ["turnos", "asistidos", "tardanzas", "ausencias", "justificados", "pendientes", "minutos_tardanza"].forEach((campo) => {
        acum[campo] += fila[campo];
      });
      acum.horas_programadas += fila.horas_programadas;
      acum.horas_trabajadas += fila.horas_trabajadas;
      return acum;
    },
    { turnos: 0, asistidos: 0, tardanzas: 0, ausencias: 0, justificados: 0, pendientes: 0, minutos_tardanza: 0, horas_programadas: 0, horas_trabajadas: 0 }
  );
  const exigibles = totales.turnos - totales.pendientes - totales.justificados;
  totales.porcentaje_asistencia = exigibles > 0 ? Math.round((totales.asistidos / exigibles) * 100) : null;
  totales.horas_programadas = Math.round(totales.horas_programadas * 100) / 100;
  totales.horas_trabajadas = Math.round(totales.horas_trabajadas * 100) / 100;

  res.status(200).json({ desde, hasta, totales, empleados: filas });
};

module.exports = {
  resumen,
  asistencia,
};
