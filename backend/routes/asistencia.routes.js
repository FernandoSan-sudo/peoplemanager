const express = require("express");
const router = express.Router();
const asistenciaController = require("../controllers/asistencia.controller");
const { autenticar } = require("../middlewares/auth");
const { manejarAsync, validarParametroId } = require("../middlewares/errores");

router.param("idUsuario", validarParametroId);
router.use(autenticar);

// Los permisos finos (un empleado solo marca/consulta lo suyo) se validan en el controlador.
router.get("/", manejarAsync(asistenciaController.listar));
router.post("/entrada", manejarAsync(asistenciaController.registrarEntrada));
router.post("/salida", manejarAsync(asistenciaController.registrarSalida));
router.get("/usuario/:idUsuario", manejarAsync(asistenciaController.obtenerPorUsuario));

module.exports = router;
