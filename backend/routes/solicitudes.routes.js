const express = require("express");
const router = express.Router();
const solicitudesController = require("../controllers/solicitudes.controller");

router.get("/", solicitudesController.obtenerTodas);
router.get("/:id", solicitudesController.obtenerPorId);
router.post("/", solicitudesController.crear);
router.put("/:id/aprobar", solicitudesController.aprobar);
router.put("/:id/rechazar", solicitudesController.rechazar);

module.exports = router;
