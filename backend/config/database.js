/**
 * config/database.js
 * -----------------------------------------------------------
 * Conexión a la base de datos PostgreSQL "peoplemanager", donde
 * vive el esquema "pm" con todas las tablas reales del proyecto
 * (usuarios, turnos, asistencia, solicitudes, roles, areas,
 * tipos_solicitud, etc.), diseñadas en la evidencia de Bases de
 * Datos.
 *
 * Se fija "pm" como search_path por defecto de cada conexión del
 * pool, así los modelos pueden escribir "usuarios", "turnos",
 * etc. sin tener que anteponer "pm." en cada consulta SQL.
 */

require("./env");
const { Pool, types } = require("pg");

// Las columnas DATE (fecha_turno, fecha_inicio, fecha_fin) se devuelven
// tal cual vienen de PostgreSQL ("2026-06-03"). Sin esto, "pg" las
// convierte en un Date de JavaScript a medianoche local y el JSON termina
// como "2026-06-03T05:00:00.000Z", lo que rompe los filtros por fecha y
// los <input type="date"> del front-end. 1082 es el OID del tipo DATE.
types.setTypeParser(1082, (valor) => valor);

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  options: "-c search_path=pm",
});

// Si PostgreSQL cierra una conexión inactiva (por ejemplo, al reiniciar el
// servicio), el pool emite "error". Sin este manejador el proceso de Node se
// detendría; con él, se informa y el pool abre una conexión nueva en la
// siguiente consulta.
pool.on("error", (error) => {
  console.error("Se perdió una conexión con PostgreSQL:", error.message);
});

pool
  .connect()
  .then((cliente) => {
    console.log("Conexión con PostgreSQL (esquema pm) establecida correctamente");
    cliente.release();
  })
  .catch((error) => {
    console.error("Error al conectar con PostgreSQL:", error.message);
  });

module.exports = pool;
