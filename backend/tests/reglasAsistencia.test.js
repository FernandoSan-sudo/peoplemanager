/**
 * Pruebas de las reglas de asistencia (funciones puras, no usan la BD).
 * Ejecutar con: npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluarEntrada, evaluarSalida } = require("../utils/reglasAsistencia");
const { fechaLocalISO } = require("../utils/fechas");

// Turno de hoy de 08:00 a 17:00. aLas() crea un Date de hoy a esa hora local.
const hoy = new Date();
const turno = { fecha_turno: fechaLocalISO(hoy), hora_inicio: "08:00:00", hora_fin: "17:00:00" };
const aLas = (hh, mm) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), hh, mm);

test("entrada a tiempo (dentro de los 10 minutos de tolerancia)", () => {
  const r = evaluarEntrada(turno, aLas(8, 10));
  assert.equal(r.permitido, true);
  assert.equal(r.estado, "completo");
  assert.equal(r.minutosTardanza, 0);
});

test("entrada tarde registra los minutos de tardanza", () => {
  const r = evaluarEntrada(turno, aLas(8, 25));
  assert.equal(r.estado, "tardanza");
  assert.equal(r.minutosTardanza, 25);
});

test("no permite marcar entrada más de 60 minutos antes del turno", () => {
  assert.equal(evaluarEntrada(turno, aLas(6, 30)).permitido, false);
  assert.equal(evaluarEntrada(turno, aLas(7, 0)).permitido, true);
});

test("no permite marcar entrada cuando el turno ya terminó", () => {
  assert.equal(evaluarEntrada(turno, aLas(17, 0)).permitido, false);
});

test("no permite marcar entrada en un turno de otro día", () => {
  assert.equal(evaluarEntrada({ ...turno, fecha_turno: "2000-01-01" }, aLas(8, 0)).permitido, false);
  assert.equal(evaluarEntrada({ ...turno, fecha_turno: "2999-01-01" }, aLas(8, 0)).permitido, false);
});

test("salida anticipada cuando sale más de 10 minutos antes del fin", () => {
  const r = evaluarSalida(turno, { estado_registro: "completo" }, aLas(16, 0));
  assert.equal(r.estado, "salida_anticipada");
  assert.equal(r.minutosAnticipacion, 60);
});

test("la salida a tiempo conserva la tardanza de la entrada", () => {
  const r = evaluarSalida(turno, { estado_registro: "tardanza" }, aLas(17, 0));
  assert.equal(r.estado, "tardanza");
});

test("la salida a tiempo de quien llegó puntual queda completa", () => {
  const r = evaluarSalida(turno, { estado_registro: "completo" }, aLas(16, 55));
  assert.equal(r.estado, "completo");
});

test("la salida solo se registra el mismo día del turno", () => {
  const ayer = { ...turno, fecha_turno: "2000-01-01" };
  assert.equal(evaluarSalida(ayer, { estado_registro: "completo" }, aLas(17, 0)).permitido, false);
  assert.equal(evaluarSalida(turno, { estado_registro: "completo" }, aLas(17, 0)).permitido, true);
});
