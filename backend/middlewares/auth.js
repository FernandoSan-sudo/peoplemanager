/**
 * middlewares/auth.js
 * -----------------------------------------------------------
 * autenticar: exige el encabezado "Authorization: Bearer <token>"
 *   que entrega POST /api/usuarios/login. Además de validar la
 *   firma del token, vuelve a consultar al usuario en la base de
 *   datos en cada petición: si un administrador lo desactivó, lo
 *   bloqueó o le cambió el rol, el cambio aplica de inmediato y
 *   no hasta que el token expire.
 *
 * autorizar(...roles): deja pasar solo a los roles indicados.
 */

const { verificarToken } = require("../utils/token");
const usuariosModel = require("../models/usuarios.model");

const autenticar = async (req, res, next) => {
  const [tipo, token] = (req.headers.authorization || "").split(" ");

  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ mensaje: "Debe iniciar sesión para acceder a este recurso" });
  }

  const datos = verificarToken(token);
  if (!datos) {
    return res.status(401).json({ mensaje: "La sesión expiró o no es válida. Inicie sesión nuevamente." });
  }

  try {
    const usuario = await usuariosModel.obtenerDatosSesion(datos.id_usuario);
    if (!usuario || usuario.estado !== "activo" || usuario.bloqueado) {
      return res.status(401).json({ mensaje: "Su usuario ya no tiene acceso al sistema. Contacte al administrador." });
    }
    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
};

const autorizar = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuario || !rolesPermitidos.includes(req.usuario.nombre_rol)) {
    return res.status(403).json({ mensaje: "No tiene permisos para realizar esta acción" });
  }
  next();
};

module.exports = {
  autenticar,
  autorizar,
};
