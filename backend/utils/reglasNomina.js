/**
 * utils/reglasNomina.js
 * -----------------------------------------------------------
 * Reglas para convertir la asistencia de un mes en las horas que
 * pide pm.nomina. Son funciones "puras" (no tocan la base de
 * datos), probadas en tests/reglasNomina.test.js.
 *
 * El VALOR en pesos lo calcula la propia base de datos: la columna
 * pm.nomina.total_pagar es GENERATED con tarifas fijas por hora.
 * Las mismas tarifas se replican aquí solo para la vista previa y
 * para valorar el recargo dominical/festivo (que se guarda en pesos).
 *
 * Normas usadas (Código Sustantivo del Trabajo con la reforma de
 * la Ley 2466 de 2025) — verificar si cambian:
 *   - Trabajo nocturno: de 7:00 p. m. a 6:00 a. m. desde el
 *     25-dic-2025 (antes, desde las 9:00 p. m.).
 *   - Recargo dominical y festivo: 80 % desde jul-2025, 90 % desde
 *     jul-2026 y 100 % desde jul-2027 (antes, 75 %).
 *   - Incapacidad por enfermedad general: 66,67 % hasta el día 90
 *     y 50 % del día 91 al 180.
 *   - Festivos: Ley 51 de 1983 ("Ley Emiliani") + fechas que
 *     dependen de la Pascua.
 */

const { minutosDelDia, sumarDias, diaDeLaSemana, fechaLocalISO, formatoCorto } = require("./fechas");
const { TOLERANCIA_MINUTOS } = require("./reglasAsistencia");

/** Tarifas por hora fijadas en la columna generada pm.nomina.total_pagar. */
const TARIFAS_BD = { ordinaria: 10000, extraDiurna: 12500, extraNocturna: 15000 };

/** Tipos de solicitud aprobada cuyos turnos se pagan completos. La incapacidad se paga parcial (ver porcentajeIncapacidad). */
const TIPOS_REMUNERADOS = ["vacaciones"];

const MINUTOS_DIA = 24 * 60;
const FIN_NOCTURNO = 6 * 60; // 6:00 a. m.

/** Hora (en minutos) en que empieza el trabajo nocturno para una fecha. */
const inicioNocturno = (fechaISO) => (fechaISO >= "2025-12-25" ? 19 * 60 : 21 * 60);

/** Porcentaje de recargo por trabajar en domingo o festivo para una fecha. */
const porcentajeRecargoDominical = (fechaISO) => {
  if (fechaISO >= "2027-07-01") return 100;
  if (fechaISO >= "2026-07-01") return 90;
  if (fechaISO >= "2025-07-01") return 80;
  return 75;
};

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher para el calendario gregoriano). */
const domingoDePascua = (anio) => {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaLocalISO(new Date(anio, mes - 1, dia));
};

/** Traslada una fecha al lunes siguiente (si ya es lunes, se queda). */
const alLunesSiguiente = (fechaISO) => {
  const dia = diaDeLaSemana(fechaISO); // 0 = domingo ... 6 = sábado
  return dia === 1 ? fechaISO : sumarDias(fechaISO, (8 - dia) % 7);
};

const cacheFestivos = new Map();

/** Conjunto de festivos de Colombia ("AAAA-MM-DD") para un año. */
const festivosColombia = (anio) => {
  if (cacheFestivos.has(anio)) return cacheFestivos.get(anio);
  const f = (mes, dia) => `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const pascua = domingoDePascua(anio);

  const festivos = new Set([
    // Fijos
    f(1, 1), f(5, 1), f(7, 20), f(8, 7), f(12, 8), f(12, 25),
    // Se trasladan al lunes (Ley Emiliani)
    ...[f(1, 6), f(3, 19), f(6, 29), f(8, 15), f(10, 12), f(11, 1), f(11, 11)].map(alLunesSiguiente),
    // Dependen de la Pascua
    sumarDias(pascua, -3), // Jueves Santo
    sumarDias(pascua, -2), // Viernes Santo
    sumarDias(pascua, 43), // Ascensión (lunes)
    sumarDias(pascua, 64), // Corpus Christi (lunes)
    sumarDias(pascua, 71), // Sagrado Corazón (lunes)
  ]);
  cacheFestivos.set(anio, festivos);
  return festivos;
};

const esFestivo = (fechaISO) => festivosColombia(Number(fechaISO.slice(0, 4))).has(fechaISO);
const esDominicalOFestivo = (fechaISO) => diaDeLaSemana(fechaISO) === 0 || esFestivo(fechaISO);

/** Minutos de un tramo [inicio, fin) del mismo día que caen en horario nocturno. */
const minutosNocturnos = (inicio, fin, fechaISO) => {
  const solape = (a, b) => Math.max(0, Math.min(fin, b) - Math.max(inicio, a));
  return solape(0, FIN_NOCTURNO) + solape(inicioNocturno(fechaISO), MINUTOS_DIA);
};

/** Minutos del día de un timestamp; si cae en un día posterior al turno, se toma como fin del día. */
const minutoDeTimestamp = (valor, fechaTurno) => {
  const fecha = new Date(valor);
  if (fechaLocalISO(fecha) > fechaTurno) return MINUTOS_DIA;
  return fecha.getHours() * 60 + fecha.getMinutes();
};

const aHoras = (minutos) => Math.round((minutos / 60) * 100) / 100;

/**
 * Incapacidad por enfermedad general (art. 227 del CST y Decreto 2943 de 2013):
 *   días 1 a 90  -> 66,67 % (dos terceras partes del salario)
 *   días 91 a 180 -> 50 %
 * Los dos primeros días los paga el empleador y desde el tercero la EPS;
 * en la práctica la empresa liquida todo en nómina y luego recobra a la EPS.
 * Limitaciones: pm.tipos_solicitud no distingue el origen, así que no
 * contempla la incapacidad de origen laboral (ARL, 100 %). Tampoco aplica
 * el piso del salario mínimo, porque la BD usa una tarifa fija por hora.
 */
const porcentajeIncapacidad = (dia) => {
  if (dia <= 90) return 66.67;
  if (dia <= 180) return 50;
  return 0;
};

/** Número de día de la incapacidad (1 = día de inicio), contando días calendario. */
const diaDeIncapacidad = (desdeISO, fechaISO) => {
  if (!desdeISO) return 1;
  const [a1, m1, d1] = String(desdeISO).slice(0, 10).split("-").map(Number);
  const [a2, m2, d2] = fechaISO.split("-").map(Number);
  return Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86400000) + 1;
};

/** Minutos a pagar y nota de un turno cubierto por una solicitud aprobada. */
const liquidarJustificado = (turno, minutosProgramados) => {
  const tipo = String(turno.justificacion || "").toLowerCase();

  if (tipo === "incapacidad") {
    const dia = diaDeIncapacidad(turno.justificacion_desde, turno.fecha_turno);
    const porcentaje = porcentajeIncapacidad(dia);
    const nota = porcentaje
      ? `Incapacidad (día ${dia}): se paga el ${String(porcentaje).replace(".", ",")} % del horario`
      : `Incapacidad (día ${dia}): supera 180 días, no la paga el empleador`;
    return { min_ordinarios: Math.round(minutosProgramados * (porcentaje / 100)), nota };
  }
  if (TIPOS_REMUNERADOS.includes(tipo)) {
    return { min_ordinarios: minutosProgramados, nota: `${turno.justificacion}: se paga el horario programado` };
  }
  return { min_ordinarios: 0, nota: `${turno.justificacion || "Permiso"}: no remunerado` };
};

/** Resumen legible de las novedades de un turno trabajado. */
const notaTurnoTrabajado = (turno, resultado) => {
  const partes = [];
  if (turno.minutos_tardanza > 0) partes.push(`${turno.minutos_tardanza} min de tardanza`);
  if (turno.estado_asistencia === "salida_anticipada") partes.push("salida anticipada");
  if (resultado.min_extra_diurnos + resultado.min_extra_nocturnos > 0) partes.push("con horas extra");
  if (resultado.festivo) partes.push("domingo/festivo");
  return partes.length ? partes.join(", ") : "Turno completo";
};

/**
 * Convierte un turno (con su estado calculado y su asistencia) en minutos
 * a pagar. Devuelve también una "nota" que se muestra en el desprendible.
 */
const liquidarTurno = (turno, hoy = fechaLocalISO()) => {
  const inicio = minutosDelDia(turno.hora_inicio);
  const fin = minutosDelDia(turno.hora_fin);
  const resultado = {
    id_turno: turno.id_turno,
    fecha: turno.fecha_turno,
    horario: `${String(turno.hora_inicio).slice(0, 5)}-${String(turno.hora_fin).slice(0, 5)}`,
    estado: turno.estado_asistencia,
    festivo: esDominicalOFestivo(turno.fecha_turno),
    min_ordinarios: 0,
    min_extra_diurnos: 0,
    min_extra_nocturnos: 0,
    min_en_festivo: 0,
    nota: "",
    alerta: null,
  };

  // 1. Turno cubierto por una solicitud aprobada, sin asistencia.
  if (turno.estado_asistencia === "justificado") {
    return { ...resultado, ...liquidarJustificado(turno, fin - inicio) };
  }

  // 2. Sin entrada: ausente (no se paga) o todavía pendiente.
  if (!turno.hora_entrada) {
    resultado.nota = turno.estado_asistencia === "ausente" ? "Ausencia: no se paga" : "Turno aún no trabajado";
    return resultado;
  }

  const entrada = minutoDeTimestamp(turno.hora_entrada, turno.fecha_turno);
  let salida;

  if (turno.hora_salida) {
    salida = minutoDeTimestamp(turno.hora_salida, turno.fecha_turno);
  } else if (turno.fecha_turno < hoy) {
    // Marcó entrada pero nunca la salida: se paga hasta el fin programado, sin extras.
    salida = fin;
    resultado.alerta = "Sin salida registrada: se pagó hasta el fin del turno";
  } else {
    resultado.nota = "Turno en curso: se liquidará cuando registre la salida";
    return resultado;
  }

  // Horas ordinarias: lo trabajado DENTRO del horario del turno (llegar antes
  // no suma; una tardanza o una salida anticipada descuentan).
  resultado.min_ordinarios = Math.max(0, Math.min(salida, fin) - Math.max(entrada, inicio));

  // Horas extra: lo trabajado DESPUÉS del fin del turno, si supera la tolerancia.
  if (salida - fin > TOLERANCIA_MINUTOS) {
    const nocturnos = minutosNocturnos(fin, salida, turno.fecha_turno);
    resultado.min_extra_nocturnos = nocturnos;
    resultado.min_extra_diurnos = salida - fin - nocturnos;
  }

  if (resultado.festivo) {
    resultado.min_en_festivo = resultado.min_ordinarios + resultado.min_extra_diurnos + resultado.min_extra_nocturnos;
  }

  resultado.nota = notaTurnoTrabajado(turno, resultado);
  return resultado;
};

/**
 * Consolida los turnos de un empleado en un mes con los campos de pm.nomina.
 * bonificaciones y descuentos son valores manuales que ingresa RRHH.
 */
const consolidarMes = (turnos, { bonificaciones = 0, descuentos = 0 } = {}, hoy = fechaLocalISO()) => {
  const detalle = turnos
    .slice()
    .sort((a, b) => (a.fecha_turno + a.hora_inicio).localeCompare(b.fecha_turno + b.hora_inicio))
    .map((turno) => liquidarTurno(turno, hoy));

  const suma = (campo) => detalle.reduce((total, d) => total + d[campo], 0);

  // El recargo se valora por turno, porque el porcentaje depende de la fecha.
  const recargoFestivo = Math.round(
    detalle.reduce((total, d) => total + (d.min_en_festivo / 60) * TARIFAS_BD.ordinaria * (porcentajeRecargoDominical(d.fecha) / 100), 0)
  );

  const horas = {
    horas_ordinarias: aHoras(suma("min_ordinarios")),
    horas_extra_diurna: aHoras(suma("min_extra_diurnos")),
    horas_extra_noct: aHoras(suma("min_extra_nocturnos")),
    horas_en_festivo: aHoras(suma("min_en_festivo")),
    recargo_festivo: recargoFestivo,
    bonificaciones: Number(bonificaciones) || 0,
    descuentos: Number(descuentos) || 0,
  };

  return {
    ...horas,
    total_estimado: calcularTotal(horas),
    turnos: detalle.length,
    ausencias: detalle.filter((d) => d.estado === "ausente").length,
    pendientes: detalle.filter((d) => d.estado === "pendiente" || d.nota.startsWith("Turno en curso")).length,
    alertas: detalle.filter((d) => d.alerta).map((d) => `${formatoCorto(d.fecha)}: ${d.alerta}`),
    detalle,
  };
};

/** Misma fórmula de la columna generada pm.nomina.total_pagar. */
const calcularTotal = ({ horas_ordinarias, horas_extra_diurna, horas_extra_noct, recargo_festivo, bonificaciones, descuentos }) =>
  Math.round(
    horas_ordinarias * TARIFAS_BD.ordinaria +
      horas_extra_diurna * TARIFAS_BD.extraDiurna +
      horas_extra_noct * TARIFAS_BD.extraNocturna +
      Number(recargo_festivo) +
      Number(bonificaciones) -
      Number(descuentos)
  );

module.exports = {
  TARIFAS_BD,
  TIPOS_REMUNERADOS,
  inicioNocturno,
  porcentajeRecargoDominical,
  porcentajeIncapacidad,
  diaDeIncapacidad,
  domingoDePascua,
  festivosColombia,
  esFestivo,
  esDominicalOFestivo,
  minutosNocturnos,
  liquidarTurno,
  consolidarMes,
  calcularTotal,
};
