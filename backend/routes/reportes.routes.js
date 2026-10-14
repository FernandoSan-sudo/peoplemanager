const express = require("express");
const router = express.Router();
const reportesController = require("../controllers/reportes.controller");
const { autenticar, autorizar } = require("../middlewares/auth");
const { manejarAsync } = require("../middlewares/errores");
const { GESTORES } = require("../config/roles");

router.use(autenticar);

router.get("/resumen", manejarAsync(reportesController.resumen));
router.get("/asistencia", autorizar(...GESTORES), manejarAsync(reportesController.asistencia));

module.exports = router;
