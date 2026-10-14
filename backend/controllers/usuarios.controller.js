/**
 * controllers/usuarios.controller.js
 * -----------------------------------------------------------
 * CRUD de usuarios + login, con bloqueo tras 5 intentos fallidos
 * (RF-10 del SRS de PeopleManager) y eliminación lógica (RF-03).
 */

const bcrypt = require("bcryptjs");
const usuariosModel = require("../models/usuarios.model");

const RONDAS_SAL = 10;
const MAX_INTENTOS_FALLIDOS = 5;

const obtenerTodos = (req, res) => {
  usuariosModel.obtenerTodos((error, resultados) => {
    if (error) {
      console.error("Error al consultar usuarios:", error.message);
      return res.status(500).json({ mensaje: "Error al consultar los usuarios" });
    }
    res.status(200).json(resultados);
  });
};

const obtenerPorId = (req, res) => {
  const { id } = req.params;
  usuariosModel.obtenerPorId(id, (error, resultados) => {
    if (error) {
      console.error("Error al consultar usuario:", error.message);
      return res.status(500).json({ mensaje: "Error al consultar el usuario" });
    }
    if (resultados.length === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }
    res.status(200).json(resultados[0]);
  });
};

const crear = (req, res) => {
  const { numero_documento, nombre_completo, correo, password, id_rol, id_area, id_cargo } = req.body;

  if (!numero_documento || !nombre_completo || !correo || !password || !id_rol) {
    return res.status(400).json({
      mensaje: "Número de documento, nombre completo, correo, contraseña y rol son obligatorios",
    });
  }

  const contrasenaHash = bcrypt.hashSync(password, RONDAS_SAL);
  const usuario = { numero_documento, nombre_completo, correo, contrasena_hash: contrasenaHash, id_rol, id_area, id_cargo };

  usuariosModel.crear(usuario, (error, resultado) => {
    if (error) {
      // "23505" es el código estándar de PostgreSQL para una violación de
      // restricción UNIQUE (correo o número de documento repetidos).
      if (error.code === "23505") {
        return res.status(409).json({ mensaje: "El correo o el número de documento ya están registrados" });
      }
      console.error("Error al crear usuario:", error.message);
      return res.status(500).json({ mensaje: "Error al crear el usuario" });
    }
    res.status(201).json({ mensaje: "Usuario creado correctamente", id: resultado.insertId });
  });
};

const actualizar = (req, res) => {
  const { id } = req.params;
  const { nombre_completo, correo, id_rol, id_area, id_cargo, estado } = req.body;

  if (!nombre_completo || !correo || !id_rol || !estado) {
    return res.status(400).json({ mensaje: "Nombre, correo, rol y estado son obligatorios" });
  }

  usuariosModel.actualizar(id, { nombre_completo, correo, id_rol, id_area, id_cargo, estado }, (error, resultado) => {
    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ mensaje: "El correo ya está registrado" });
      }
      console.error("Error al actualizar usuario:", error.message);
      return res.status(500).json({ mensaje: "Error al actualizar el usuario" });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }
    res.status(200).json({ mensaje: "Usuario actualizado correctamente" });
  });
};

/** Eliminación lógica: el usuario queda "inactivo" y pierde acceso, pero su historial no se borra. */
const eliminar = (req, res) => {
  const { id } = req.params;

  usuariosModel.eliminarLogico(id, (error, resultado) => {
    if (error) {
      console.error("Error al eliminar usuario:", error.message);
      return res.status(500).json({ mensaje: "Error al eliminar el usuario" });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }
    res.status(200).json({ mensaje: "Usuario desactivado correctamente" });
  });
};

const login = (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ mensaje: "Correo y contraseña son obligatorios" });
  }

  usuariosModel.obtenerPorCorreo(correo, (error, resultados) => {
    if (error) {
      console.error("Error al consultar usuario:", error.message);
      return res.status(500).json({ mensaje: "Error interno del servidor" });
    }

    if (resultados.length === 0) {
      // Mismo mensaje que cuando la contraseña no coincide, para no
      // revelar si un correo existe o no en la base de datos.
      return res.status(401).json({ mensaje: "Credenciales incorrectas" });
    }

    const usuario = resultados[0];

    if (usuario.estado !== "activo") {
      return res.status(403).json({ mensaje: "El usuario se encuentra inactivo. Contacte al administrador." });
    }

    if (usuario.bloqueado) {
      return res.status(403).json({ mensaje: "La cuenta está bloqueada por intentos fallidos. Contacte al administrador." });
    }

    const passwordValida = bcrypt.compareSync(password, usuario.contrasena_hash);

    if (!passwordValida) {
      usuariosModel.registrarIntentoFallido(usuario.id_usuario, usuario.intentos_fallidos, (errorIntento, resultadoIntento) => {
        if (errorIntento) {
          console.error("Error al registrar intento fallido:", errorIntento.message);
        }
        if (resultadoIntento && resultadoIntento.bloqueado) {
          return res.status(403).json({
            mensaje: `La cuenta ha sido bloqueada tras ${MAX_INTENTOS_FALLIDOS} intentos fallidos. Contacte al administrador.`,
          });
        }
        return res.status(401).json({ mensaje: "Credenciales incorrectas" });
      });
      return;
    }

    usuariosModel.reiniciarIntentosFallidos(usuario.id_usuario, () => {
      res.status(200).json({
        mensaje: "Autenticación exitosa",
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre_completo: usuario.nombre_completo,
          correo: usuario.correo,
        },
      });
    });
  });
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  login,
};
