const express = require("express");
const router = express.Router();
const solicitudesController = require("../controllers/solicitudes.controller");
const { autenticar, autorizar } = require("../middlewares/auth");
const { manejarAsync, validarParametroId } = require("../middlewares/errores");
const { GESTORES } = require("../config/roles");

router.param("id", validarParametroId);
router.use(autenticar);

router.get("/", manejarAsync(solicitudesController.obtenerTodas));
router.get("/:id", manejarAsync(solicitudesController.obtenerPorId));
router.post("/", manejarAsync(solicitudesController.crear));
router.put("/:id/aprobar", autorizar(...GESTORES), manejarAsync(solicitudesController.aprobar));
router.put("/:id/rechazar", autorizar(...GESTORES), manejarAsync(solicitudesController.rechazar));

module.exports = router;
