const express = require("express");
const router = express.Router();
const usuariosController = require("../controllers/usuarios.controller");
const { autenticar, autorizar } = require("../middlewares/auth");
const { manejarAsync, validarParametroId } = require("../middlewares/errores");
const { GESTORES, ADMINISTRAN_USUARIOS } = require("../config/roles");

router.param("id", validarParametroId);

// El login va antes de "/:id" (para que Express no confunda "login" con un id)
// y antes de autenticar (es la única ruta pública de la API).
router.post("/login", manejarAsync(usuariosController.login));

router.use(autenticar);

router.get("/perfil", manejarAsync(usuariosController.perfil));
router.get("/", autorizar(...GESTORES), manejarAsync(usuariosController.obtenerTodos));
router.get("/:id", manejarAsync(usuariosController.obtenerPorId));
router.post("/", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(usuariosController.crear));
router.put("/:id", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(usuariosController.actualizar));
router.put("/:id/desbloquear", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(usuariosController.desbloquear));
router.put("/:id/password", manejarAsync(usuariosController.cambiarPassword));
router.delete("/:id", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(usuariosController.eliminar));

module.exports = router;
