const express = require("express");
const router = express.Router();
const activosController = require("../controllers/activos.controller");
const { autenticar, autorizar } = require("../middlewares/auth");
const { manejarAsync, validarParametroId } = require("../middlewares/errores");
const { GESTORES, ADMINISTRAN_USUARIOS } = require("../config/roles");

router.param("id", validarParametroId);
router.use(autenticar);

// Cualquier usuario: los equipos que tiene asignados.
router.get("/mios", manejarAsync(activosController.listarMios));
router.get("/:id", manejarAsync(activosController.obtenerPorId));

// Consulta del inventario: gestores (Administrador, Supervisor, RRHH).
router.get("/", autorizar(...GESTORES), manejarAsync(activosController.listar));
router.get("/:id/historial", autorizar(...GESTORES), manejarAsync(activosController.historial));

// Gestión: Administrador y RRHH.
router.post("/", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(activosController.crear));
router.put("/:id", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(activosController.actualizar));
router.delete("/:id", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(activosController.eliminar));
router.post("/:id/asignar", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(activosController.asignar));
router.post("/:id/devolver", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(activosController.devolver));
router.post("/:id/trasladar", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(activosController.trasladar));

module.exports = router;
