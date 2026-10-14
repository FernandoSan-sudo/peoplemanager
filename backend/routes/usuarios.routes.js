const express = require("express");
const router = express.Router();
const usuariosController = require("../controllers/usuarios.controller");

// El login va antes de "/:id" para que Express no confunda "login" con un id.
router.post("/login", usuariosController.login);

router.get("/", usuariosController.obtenerTodos);
router.get("/:id", usuariosController.obtenerPorId);
router.post("/", usuariosController.crear);
router.put("/:id", usuariosController.actualizar);
router.delete("/:id", usuariosController.eliminar);

module.exports = router;
