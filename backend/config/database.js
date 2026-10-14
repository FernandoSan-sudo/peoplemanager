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
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  options: "-c search_path=pm",
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
