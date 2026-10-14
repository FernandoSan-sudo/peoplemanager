const express = require("express");
const router = express.Router();
const auditoriaController = require("../controllers/auditoria.controller");
const { autenticar, autorizar } = require("../middlewares/auth");
const { manejarAsync } = require("../middlewares/errores");
const { ROLES } = require("../config/roles");

router.use(autenticar, autorizar(ROLES.ADMIN));

router.get("/", manejarAsync(auditoriaController.listar));
router.get("/acciones", manejarAsync(auditoriaController.listarAcciones));

module.exports = router;
