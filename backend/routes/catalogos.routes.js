const express = require("express");
const router = express.Router();
const catalogosController = require("../controllers/catalogos.controller");
const { autenticar } = require("../middlewares/auth");
const { manejarAsync } = require("../middlewares/errores");

router.use(autenticar);

router.get("/roles", manejarAsync(catalogosController.obtenerRoles));
router.get("/areas", manejarAsync(catalogosController.obtenerAreas));
router.get("/cargos", manejarAsync(catalogosController.obtenerCargos));
router.get("/tipos-solicitud", manejarAsync(catalogosController.obtenerTiposSolicitud));

module.exports = router;
