const express = require("express");
const router = express.Router();
const turnosController = require("../controllers/turnos.controller");
const { autenticar, autorizar } = require("../middlewares/auth");
const { manejarAsync, validarParametroId } = require("../middlewares/errores");
const { PLANIFICAN_TURNOS } = require("../config/roles");

router.param("id", validarParametroId);
router.use(autenticar);

router.get("/", manejarAsync(turnosController.obtenerTodos));
router.get("/:id", manejarAsync(turnosController.obtenerPorId));
router.post("/", autorizar(...PLANIFICAN_TURNOS), manejarAsync(turnosController.crear));
router.post("/lote", autorizar(...PLANIFICAN_TURNOS), manejarAsync(turnosController.crearLote));
router.put("/:id", autorizar(...PLANIFICAN_TURNOS), manejarAsync(turnosController.actualizar));
router.delete("/:id", autorizar(...PLANIFICAN_TURNOS), manejarAsync(turnosController.eliminar));

module.exports = router;
