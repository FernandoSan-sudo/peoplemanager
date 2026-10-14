const test = require("node:test");
const assert = require("node:assert/strict");
const { crearToken, verificarToken } = require("../utils/token");

test("un token recién creado es válido y conserva los datos", () => {
  const datos = verificarToken(crearToken({ id_usuario: 7 }));
  assert.equal(datos.id_usuario, 7);
});

test("un token alterado se rechaza", () => {
  const token = crearToken({ id_usuario: 7 });
  const [cuerpo, firma] = token.split(".");
  const cuerpoFalso = Buffer.from(JSON.stringify({ id_usuario: 1, exp: Date.now() + 999999 })).toString("base64url");
  assert.equal(verificarToken(`${cuerpoFalso}.${firma}`), null);
  assert.equal(verificarToken(`${cuerpo}.firmaInventada`), null);
});

test("un token expirado se rechaza", () => {
  assert.equal(verificarToken(crearToken({ id_usuario: 7 }, -1)), null);
});

test("valores que no son token se rechazan", () => {
  assert.equal(verificarToken(undefined), null);
  assert.equal(verificarToken("abc"), null);
  assert.equal(verificarToken("a.b.c"), null);
});
