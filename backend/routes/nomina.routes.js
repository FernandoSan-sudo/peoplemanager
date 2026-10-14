const express = require("express");
const router = express.Router();
const nominaController = require("../controllers/nomina.controller");
const { autenticar, autorizar } = require("../middlewares/auth");
const { manejarAsync, validarParametroId } = require("../middlewares/errores");
const { ADMINISTRAN_USUARIOS } = require("../config/roles");

router.param("id", validarParametroId);
router.use(autenticar);

// Cualquier usuario: sus propios desprendibles (solo nóminas aprobadas o pagadas).
router.get("/mias", manejarAsync(nominaController.listarMias));
router.get("/:id", manejarAsync(nominaController.detalle));

// Liquidación: Administrador y RRHH.
router.get("/", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(nominaController.previsualizar));
router.post("/calcular", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(nominaController.calcular));
router.put("/:id/ajustes", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(nominaController.ajustar));
router.put("/:id/aprobar", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(nominaController.aprobar));
router.put("/:id/pagar", autorizar(...ADMINISTRAN_USUARIOS), manejarAsync(nominaController.pagar));

module.exports = router;
