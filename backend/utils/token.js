/**
 * utils/token.js
 * -----------------------------------------------------------
 * Token de sesión firmado con HMAC-SHA256 (mismo principio que un
 * JWT), usando solo el módulo "crypto" que ya trae Node.js, para
 * no añadir dependencias de terceros.
 *
 * Formato: <datos en base64url>.<firma en base64url>
 * La firma impide que el navegador modifique los datos (por
 * ejemplo, cambiar su id o su rol): si alguien altera un solo
 * carácter, la firma deja de coincidir y el token se rechaza.
 */

require("../config/env");
const crypto = require("crypto");

const DURACION_HORAS = 8; // una jornada laboral

let secreto = process.env.TOKEN_SECRET;
if (!secreto) {
  // Sin TOKEN_SECRET en el .env se genera uno aleatorio en cada arranque:
  // funciona, pero todas las sesiones se cierran cuando se reinicia el servidor.
  secreto = crypto.randomBytes(32).toString("hex");
  console.warn("Aviso: TOKEN_SECRET no está definido en .env; las sesiones se cerrarán al reiniciar el servidor.");
}

const calcularFirma = (cuerpo) => crypto.createHmac("sha256", secreto).update(cuerpo).digest("base64url");

/** Crea un token con los datos indicados y una fecha de expiración. */
const crearToken = (datos, duracionHoras = DURACION_HORAS) => {
  const contenido = { ...datos, exp: Date.now() + duracionHoras * 60 * 60 * 1000 };
  const cuerpo = Buffer.from(JSON.stringify(contenido)).toString("base64url");
  return `${cuerpo}.${calcularFirma(cuerpo)}`;
};

/** Devuelve los datos del token si la firma es válida y no ha expirado; si no, null. */
const verificarToken = (token) => {
  if (typeof token !== "string") return null;

  const partes = token.split(".");
  if (partes.length !== 2) return null;

  const [cuerpo, firma] = partes;
  const firmaEsperada = calcularFirma(cuerpo);

  // timingSafeEqual compara en tiempo constante (evita ataques por tiempo de respuesta).
  const a = Buffer.from(firma);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf-8"));
    if (!datos.exp || datos.exp < Date.now()) return null;
    return datos;
  } catch (error) {
    return null;
  }
};

module.exports = {
  DURACION_HORAS,
  crearToken,
  verificarToken,
};
