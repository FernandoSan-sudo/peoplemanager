/**
 * utils/fechas.js
 * -----------------------------------------------------------
 * Utilidades de fecha y hora en la zona horaria LOCAL del
 * servidor. Se usan en lugar de toISOString(), que trabaja en
 * UTC: en Colombia (UTC-5), después de las 7:00 p. m.,
 * toISOString() ya devuelve la fecha del día siguiente.
 */

const dosDigitos = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" de la fecha indicada (por defecto, hoy). */
const fechaLocalISO = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;

/** "HH:MM" de la fecha indicada (por defecto, ahora). */
const horaLocalHHMM = (fecha = new Date()) => `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;

/** Convierte "HH:MM" o "HH:MM:SS" a minutos desde la medianoche. */
const minutosDelDia = (hora) => {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + m;
};

/** Suma días a una fecha "YYYY-MM-DD" y devuelve otra "YYYY-MM-DD". */
const sumarDias = (fechaISO, dias) => {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return fechaLocalISO(new Date(a, m - 1, d + dias));
};

/** Día de la semana de una fecha "YYYY-MM-DD" (0 = domingo ... 6 = sábado). */
const diaDeLaSemana = (fechaISO) => {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(a, m - 1, d).getDay();
};

/** "dd/mm/aaaa" para mensajes dirigidos al usuario. */
const formatoCorto = (fechaISO) => {
  const [a, m, d] = String(fechaISO).split("-");
  return `${d}/${m}/${a}`;
};

module.exports = {
  fechaLocalISO,
  horaLocalHHMM,
  minutosDelDia,
  sumarDias,
  diaDeLaSemana,
  formatoCorto,
};
