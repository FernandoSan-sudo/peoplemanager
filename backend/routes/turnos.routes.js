const express = require("express");
const router = express.Router();
const turnosController = require("../controllers/turnos.controller");

router.get("/", turnosController.obtenerTodos);
router.get("/:id", turnosController.obtenerPorId);
router.post("/", turnosController.crear);
router.put("/:id", turnosController.actualizar);
router.delete("/:id", turnosController.eliminar);

module.exports = router;
