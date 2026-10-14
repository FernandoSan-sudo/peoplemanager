/**
 * Pruebas de las reglas de nómina (funciones puras, no usan la BD).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const n = require("../utils/reglasNomina");

// Crea un timestamp local para una fecha y hora.
const a = (fechaISO, hhmm) => {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
};
const turno = (extra) => ({
  id_turno: 1, fecha_turno: "2026-09-22", hora_inicio: "08:00:00", hora_fin: "16:00:00",
  estado_asistencia: "completo", minutos_tardanza: 0, ...extra,
});
const HOY = "2026-09-30";

test("festivos de Colombia 2026 (Ley Emiliani y Pascua)", () => {
  const esperados = [
    "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-18",
    "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12",
    "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
  ];
  assert.deepEqual([...n.festivosColombia(2026)].sort(), esperados);
  assert.equal(n.domingoDePascua(2026), "2026-04-05");
});

test("domingos y festivos se reconocen", () => {
  assert.equal(n.esDominicalOFestivo("2026-09-27"), true); // domingo
  assert.equal(n.esDominicalOFestivo("2026-10-12"), true); // festivo
  assert.equal(n.esDominicalOFestivo("2026-09-22"), false); // martes
});

test("recargo dominical según la reforma de 2025", () => {
  assert.equal(n.porcentajeRecargoDominical("2025-05-10"), 75);
  assert.equal(n.porcentajeRecargoDominical("2026-06-30"), 80);
  assert.equal(n.porcentajeRecargoDominical("2026-07-01"), 90);
  assert.equal(n.porcentajeRecargoDominical("2027-07-01"), 100);
});

test("turno completo: 8 horas ordinarias", () => {
  const r = n.liquidarTurno(turno({ hora_entrada: a("2026-09-22", "07:50"), hora_salida: a("2026-09-22", "16:05") }), HOY);
  assert.equal(r.min_ordinarios, 480); // llegar antes no suma
  assert.equal(r.min_extra_diurnos + r.min_extra_nocturnos, 0); // 5 min está dentro de la tolerancia
});

test("la tardanza descuenta tiempo ordinario", () => {
  const r = n.liquidarTurno(turno({ hora_entrada: a("2026-09-22", "08:30"), hora_salida: a("2026-09-22", "16:00"), minutos_tardanza: 30, estado_asistencia: "tardanza" }), HOY);
  assert.equal(r.min_ordinarios, 450);
});

test("horas extra se dividen en diurnas y nocturnas (nocturno desde las 7 p. m.)", () => {
  const r = n.liquidarTurno(turno({ hora_entrada: a("2026-09-22", "08:00"), hora_salida: a("2026-09-22", "20:00") }), HOY);
  assert.equal(r.min_ordinarios, 480);
  assert.equal(r.min_extra_diurnos, 180); // 16:00-19:00
  assert.equal(r.min_extra_nocturnos, 60); // 19:00-20:00
});

test("ausencia no se paga; vacaciones completas; permiso no", () => {
  assert.equal(n.liquidarTurno(turno({ estado_asistencia: "ausente" }), HOY).min_ordinarios, 0);
  assert.equal(n.liquidarTurno(turno({ estado_asistencia: "justificado", justificacion: "Vacaciones" }), HOY).min_ordinarios, 480);
  assert.equal(n.liquidarTurno(turno({ estado_asistencia: "justificado", justificacion: "Permiso" }), HOY).min_ordinarios, 0);
});

test("entrada sin salida en un día pasado: se paga hasta el fin del turno y genera alerta", () => {
  const r = n.liquidarTurno(turno({ hora_entrada: a("2026-09-22", "08:00") }), HOY);
  assert.equal(r.min_ordinarios, 480);
  assert.ok(r.alerta);
});

test("consolidado del mes con recargo dominical y fórmula de la BD", () => {
  const turnos = [
    turno({ id_turno: 1, hora_entrada: a("2026-09-22", "08:00"), hora_salida: a("2026-09-22", "16:00") }),
    // Domingo 27/09/2026 (recargo del 90 %)
    turno({ id_turno: 2, fecha_turno: "2026-09-27", hora_entrada: a("2026-09-27", "08:00"), hora_salida: a("2026-09-27", "16:00") }),
    turno({ id_turno: 3, fecha_turno: "2026-09-23", estado_asistencia: "ausente" }),
  ];
  const r = n.consolidarMes(turnos, { bonificaciones: 50000, descuentos: 20000 }, HOY);
  assert.equal(r.horas_ordinarias, 16);
  assert.equal(r.horas_en_festivo, 8);
  assert.equal(r.recargo_festivo, 72000); // 8 h × 10.000 × 90 %
  assert.equal(r.ausencias, 1);
  assert.equal(r.total_estimado, 16 * 10000 + 72000 + 50000 - 20000);
});

test("incapacidad: 66,67 % hasta el día 90, 50 % hasta el 180, luego 0", () => {
  const inc = (desde) => n.liquidarTurno(turno({ estado_asistencia: "justificado", justificacion: "Incapacidad", justificacion_desde: desde }), HOY);
  assert.equal(n.diaDeIncapacidad("2026-09-20", "2026-09-22"), 3);
  assert.equal(inc("2026-09-20").min_ordinarios, 320); // 480 × 66,67 % = 5,33 h
  assert.match(inc("2026-09-20").nota, /día 3/);
  assert.equal(inc("2026-06-01").min_ordinarios, 240); // día 114 -> 50 %
  assert.equal(inc("2026-03-01").min_ordinarios, 0); // día 206
});
