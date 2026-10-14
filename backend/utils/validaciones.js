/**
 * utils/validaciones.js
 * -----------------------------------------------------------
 * Validaciones de formato reutilizadas por los controladores.
 * El backend nunca confía en que el front-end ya validó: cualquier
 * cliente (Postman, otra app) puede enviar datos directamente.
 */

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const REGEX_DOCUMENTO = /^\d{5,20}$/;

const LONGITUD_MIN_PASSWORD = 8;

const esIdValido = (valor) => /^\d+$/.test(String(valor)) && Number(valor) > 0 && Number(valor) <= 2147483647;

const esCorreoValido = (valor) => typeof valor === "string" && valor.length <= 120 && REGEX_CORREO.test(valor.trim());

const esDocumentoValido = (valor) => REGEX_DOCUMENTO.test(String(valor).trim());

/** Fecha "YYYY-MM-DD" que además exista en el calendario (rechaza 2026-02-30). */
const esFechaValida = (valor) => {
  if (typeof valor !== "string" || !REGEX_FECHA.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d;
};

const esHoraValida = (valor) => typeof valor === "string" && REGEX_HORA.test(valor);

/** Devuelve un mensaje de error si la contraseña no cumple la política, o null si es válida. */
const validarPassword = (password) => {
  if (typeof password !== "string" || password.length < LONGITUD_MIN_PASSWORD) {
    return `La contraseña debe tener mínimo ${LONGITUD_MIN_PASSWORD} caracteres`;
  }
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    return "La contraseña debe combinar letras y números";
  }
  return null;
};

module.exports = {
  LONGITUD_MIN_PASSWORD,
  esIdValido,
  esCorreoValido,
  esDocumentoValido,
  esFechaValida,
  esHoraValida,
  validarPassword,
};
