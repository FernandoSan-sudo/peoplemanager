/**
 * utils/reglasAsistencia.js
 * -----------------------------------------------------------
 * Reglas de negocio del registro de asistencia, escritas como
 * funciones "puras" (no tocan la base de datos): reciben el turno
 * y la hora actual, y devuelven la decisión. Así se pueden probar
 * de forma aislada (ver tests/reglasAsistencia.test.js).
 */

const { fechaLocalISO, minutosDelDia, formatoCorto } = require("./fechas");

const TOLERANCIA_MINUTOS = 10; // minutos de gracia antes de marcar tardanza o salida anticipada
const ANTICIPACION_MAXIMA_ENTRADA = 60; // no se puede marcar entrada más de 1 hora antes del turno

const minutosAhora = (ahora) => ahora.getHours() * 60 + ahora.getMinutes();

/**
 * Decide si se puede registrar la entrada de un turno en este momento.
 * @returns {{ permitido: boolean, mensaje: string, minutosTardanza?: number, estado?: string }}
 */
const evaluarEntrada = (turno, ahora = new Date()) => {
  const hoy = fechaLocalISO(ahora);

  if (turno.fecha_turno > hoy) {
    return { permitido: false, mensaje: `Este turno es para el ${formatoCorto(turno.fecha_turno)}; la entrada solo se registra ese día` };
  }
  if (turno.fecha_turno < hoy) {
    return { permitido: false, mensaje: "Este turno ya pasó; no se puede registrar la entrada en una fecha posterior" };
  }

  const inicio = minutosDelDia(turno.hora_inicio);
  const fin = minutosDelDia(turno.hora_fin);
  const actual = minutosAhora(ahora);

  if (actual < inicio - ANTICIPACION_MAXIMA_ENTRADA) {
    return {
      permitido: false,
      mensaje: `Aún es muy temprano: la entrada se habilita ${ANTICIPACION_MAXIMA_ENTRADA} minutos antes del inicio del turno (${String(turno.hora_inicio).slice(0, 5)})`,
    };
  }
  if (actual >= fin) {
    return { permitido: false, mensaje: "El turno ya terminó; no se puede registrar la entrada" };
  }

  const diferencia = actual - inicio;
  const minutosTardanza = diferencia > TOLERANCIA_MINUTOS ? diferencia : 0;

  return {
    permitido: true,
    minutosTardanza,
    estado: minutosTardanza > 0 ? "tardanza" : "completo",
    mensaje: minutosTardanza > 0 ? `Entrada registrada con ${minutosTardanza} minutos de tardanza` : "Entrada registrada a tiempo",
  };
};

/**
 * Decide el estado final al registrar la salida.
 * Si la salida es anticipada, el estado pasa a "salida_anticipada" (los
 * minutos de tardanza siguen guardados en su propia columna). Si no, se
 * conserva el estado de la entrada: quien llegó tarde y salió a tiempo
 * sigue en "tardanza", no se "borra" la novedad.
 */
const evaluarSalida = (turno, registro, ahora = new Date()) => {
  // Los turnos no cruzan la medianoche (CHECK hora_fin > hora_inicio), así que
  // la salida se registra el mismo día; si no, las horas extra quedarían infladas.
  if (fechaLocalISO(ahora) !== turno.fecha_turno) {
    return {
      permitido: false,
      mensaje: "La jornada de ese día ya cerró; la salida solo se registra el mismo día del turno. En nómina se paga hasta el fin del turno.",
    };
  }

  const fin = minutosDelDia(turno.hora_fin);
  const actual = minutosAhora(ahora);
  const minutosAnticipacion = fin - actual;

  if (minutosAnticipacion > TOLERANCIA_MINUTOS) {
    return {
      permitido: true,
      estado: "salida_anticipada",
      minutosAnticipacion,
      observaciones: `Salida ${minutosAnticipacion} minutos antes del fin del turno`,
      mensaje: `Salida registrada ${minutosAnticipacion} minutos antes del fin del turno`,
    };
  }

  return {
    permitido: true,
    estado: registro.estado_registro === "tardanza" ? "tardanza" : "completo",
    minutosAnticipacion: 0,
    observaciones: registro.observaciones || null,
    mensaje: "Salida registrada correctamente",
  };
};

module.exports = {
  TOLERANCIA_MINUTOS,
  ANTICIPACION_MAXIMA_ENTRADA,
  evaluarEntrada,
  evaluarSalida,
};
