/**
 * config/env.js
 * -----------------------------------------------------------
 * Carga las variables del archivo .env a process.env, sin
 * depender de ningún paquete externo (evita añadir una
 * dependencia de terceros solo para leer 4 líneas de texto).
 *
 * Formato soportado: NOMBRE=valor, una por línea. Ignora líneas
 * vacías y las que empiezan con #. No sobreescribe una variable
 * que ya exista en process.env (por ejemplo, si el sistema
 * operativo ya la definió).
 */

const fs = require("fs");
const path = require("path");

const rutaEnv = path.join(__dirname, "..", ".env");

if (fs.existsSync(rutaEnv)) {
  const contenido = fs.readFileSync(rutaEnv, "utf-8");

  contenido.split("\n").forEach((linea) => {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) return;

    const separador = limpia.indexOf("=");
    if (separador === -1) return;

    const clave = limpia.slice(0, separador).trim();
    let valor = limpia.slice(separador + 1).trim();

    // Quita comillas si el valor viene entre "..." o '...'
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }

    if (clave && process.env[clave] === undefined) {
      process.env[clave] = valor;
    }
  });
}
