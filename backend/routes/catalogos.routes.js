const express = require("express");
const router = express.Router();
const catalogosController = require("../controllers/catalogos.controller");

router.get("/roles", catalogosController.obtenerRoles);
router.get("/areas", catalogosController.obtenerAreas);
router.get("/cargos", catalogosController.obtenerCargos);
router.get("/tipos-solicitud", catalogosController.obtenerTiposSolicitud);

module.exports = router;
