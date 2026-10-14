/**
 * Pruebas de la API que NO necesitan datos: protección de rutas,
 * respuestas de error en JSON y validación de entradas. Levantan la
 * app en un puerto aleatorio y no escriben nada en la base de datos.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const pool = require("../config/database");

let servidor;
let base;

test.before(async () => {
  servidor = app.listen(0);
  await new Promise((resolver) => servidor.once("listening", resolver));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(async () => {
  servidor.close();
  await pool.end();
});

const enviarJson = (ruta, cuerpo) =>
  fetch(base + ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo });

test("las rutas protegidas exigen iniciar sesión (401)", async () => {
  for (const ruta of ["/api/usuarios", "/api/turnos", "/api/solicitudes", "/api/catalogos/areas", "/api/reportes/resumen", "/api/auditoria", "/api/nomina", "/api/activos"]) {
    const respuesta = await fetch(base + ruta);
    assert.equal(respuesta.status, 401, ruta);
  }
});

test("un token falso se rechaza (401)", async () => {
  const respuesta = await fetch(`${base}/api/turnos`, { headers: { Authorization: "Bearer inventado.firma" } });
  assert.equal(respuesta.status, 401);
});

test("DELETE sin sesión no borra nada (401)", async () => {
  const respuesta = await fetch(`${base}/api/usuarios/1`, { method: "DELETE" });
  assert.equal(respuesta.status, 401);
});

test("una ruta inexistente responde 404 en JSON", async () => {
  const respuesta = await fetch(`${base}/api/no-existe`);
  assert.equal(respuesta.status, 404);
  assert.match((await respuesta.json()).mensaje, /Ruta no encontrada/);
});

test("un JSON mal formado responde 400", async () => {
  const respuesta = await enviarJson("/api/usuarios/login", "{correo: sin comillas");
  assert.equal(respuesta.status, 400);
});

test("el login sin datos responde 400", async () => {
  const respuesta = await enviarJson("/api/usuarios/login", JSON.stringify({}));
  assert.equal(respuesta.status, 400);
});

test("CORS: la verificación previa del navegador responde 204", async () => {
  const respuesta = await fetch(`${base}/api/usuarios/login`, { method: "OPTIONS" });
  assert.equal(respuesta.status, 204);
  assert.equal(respuesta.headers.get("access-control-allow-origin"), "*");
});
