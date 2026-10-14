const express = require("express");
const router = express.Router();
const asistenciaController = require("../controllers/asistencia.controller");

router.post("/entrada", asistenciaController.registrarEntrada);
router.post("/salida", asistenciaController.registrarSalida);
router.get("/usuario/:idUsuario", asistenciaController.obtenerPorUsuario);

module.exports = router;
