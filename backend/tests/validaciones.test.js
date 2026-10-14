const test = require("node:test");
const assert = require("node:assert/strict");
const v = require("../utils/validaciones");
const f = require("../utils/fechas");

test("fechas: formato y existencia en el calendario", () => {
  assert.equal(v.esFechaValida("2026-06-03"), true);
  assert.equal(v.esFechaValida("2026-02-30"), false);
  assert.equal(v.esFechaValida("03/06/2026"), false);
});

test("horas HH:MM y HH:MM:SS", () => {
  assert.equal(v.esHoraValida("08:00"), true);
  assert.equal(v.esHoraValida("23:59:59"), true);
  assert.equal(v.esHoraValida("24:00"), false);
});

test("política de contraseñas: 8 caracteres con letras y números", () => {
  assert.notEqual(v.validarPassword("corta1"), null);
  assert.notEqual(v.validarPassword("solotexto"), null);
  assert.notEqual(v.validarPassword("12345678"), null);
  assert.equal(v.validarPassword("Segura2026"), null);
});

test("correo, documento e ids", () => {
  assert.equal(v.esCorreoValido("ana@empresa.com"), true);
  assert.equal(v.esCorreoValido("ana@empresa"), false);
  assert.equal(v.esDocumentoValido("1234567890"), true);
  assert.equal(v.esDocumentoValido("12ab"), false);
  assert.equal(v.esIdValido("5"), true);
  assert.equal(v.esIdValido("0"), false);
  assert.equal(v.esIdValido("1 OR 1=1"), false);
});

test("utilidades de fechas locales", () => {
  assert.equal(f.sumarDias("2026-01-31", 1), "2026-02-01");
  assert.equal(f.sumarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(f.diaDeLaSemana("2026-09-24"), 4); // jueves
  assert.equal(f.formatoCorto("2026-09-24"), "24/09/2026");
  assert.equal(f.minutosDelDia("08:30:00"), 510);
});
