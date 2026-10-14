require("./config/env");
const express = require("express");

const usuariosRoutes = require("./routes/usuarios.routes");
const catalogosRoutes = require("./routes/catalogos.routes");
const turnosRoutes = require("./routes/turnos.routes");
const asistenciaRoutes = require("./routes/asistencia.routes");
const solicitudesRoutes = require("./routes/solicitudes.routes");

const app = express();

// CORS: el frontend se abre con Live Server (http://127.0.0.1:5500) y la API
// corre en el puerto 3000; son orígenes distintos, así que el navegador exige
// estas cabeceras. Se implementa a mano para no añadir el paquete "cors".
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

app.use("/api/usuarios", usuariosRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/turnos", turnosRoutes);
app.use("/api/asistencia", asistenciaRoutes);
app.use("/api/solicitudes", solicitudesRoutes);

app.get("/", (req, res) => {
  res.json({ mensaje: "API PeopleManager (esquema pm) funcionando correctamente" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

module.exports = app;
