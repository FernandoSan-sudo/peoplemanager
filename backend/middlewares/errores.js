/**
 * middlewares/errores.js
 * -----------------------------------------------------------
 * Manejo centralizado de errores. Los controladores ya no repiten
 * try/catch con console.error + 500 en cada función: si algo
 * falla, el error llega aquí y se traduce a una respuesta clara.
 *
 * Códigos de error de PostgreSQL que se traducen:
 *   22P02 / 22007 / 22008 -> dato con formato inválido (ej. "abc" como id)
 *   23503 -> llave foránea: el registro relacionado no existe
 *   23505 -> UNIQUE: el dato ya está registrado
 *   23514 -> CHECK: el dato no cumple una regla de la tabla
 */

/** Envuelve un controlador async para que sus errores lleguen al manejador (Express 4 no lo hace solo). */
const manejarAsync = (controlador) => (req, res, next) => {
  Promise.resolve(controlador(req, res, next)).catch(next);
};

/** Valida que los parámetros de ruta :id, :idUsuario sean enteros positivos antes de llegar al controlador. */
const validarParametroId = (req, res, next, valor) => {
  if (!/^\d+$/.test(valor) || Number(valor) <= 0 || Number(valor) > 2147483647) {
    return res.status(400).json({ mensaje: "El identificador enviado en la ruta no es válido" });
  }
  next();
};

const rutaNoEncontrada = (req, res) => {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const manejarErrores = (error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ mensaje: "El cuerpo de la petición no es un JSON válido" });
  }

  switch (error.code) {
    case "22P02":
    case "22007":
    case "22008":
      return res.status(400).json({ mensaje: "Alguno de los datos enviados tiene un formato inválido" });
    case "23503":
      return res.status(400).json({ mensaje: "Uno de los registros relacionados (usuario, área, rol, tipo...) no existe" });
    case "23505":
      return res.status(409).json({ mensaje: "Ya existe un registro con esos datos" });
    case "23514":
      return res.status(400).json({ mensaje: "Los datos no cumplen las reglas de la base de datos" });
    default:
      console.error(`Error en ${req.method} ${req.originalUrl}:`, error);
      return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

module.exports = {
  manejarAsync,
  validarParametroId,
  rutaNoEncontrada,
  manejarErrores,
};
