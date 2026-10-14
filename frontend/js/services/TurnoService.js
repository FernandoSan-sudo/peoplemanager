/* =========================================================
   TurnoService.js
   -----------------------------------------------------------
   Operaciones sobre /api/turnos. El "estado_asistencia" (el
   semáforo que se muestra en pantalla) no se envía nunca desde
   aquí: siempre llega calculado por el backend a partir de
   pm.asistencia.
   ========================================================= */

class TurnoService {
  constructor(api) {
    this.api = api;
  }

  obtenerTodos(idUsuario) {
    const query = idUsuario ? `?id_usuario=${idUsuario}` : "";
    return this.api.get(`/turnos${query}`);
  }

  obtenerPorId(id) {
    return this.api.get(`/turnos/${id}`);
  }

  crear(datosTurno) {
    return this.api.post("/turnos", datosTurno);
  }

  actualizar(id, datosTurno) {
    return this.api.put(`/turnos/${id}`, datosTurno);
  }

  eliminar(id) {
    return this.api.delete(`/turnos/${id}`);
  }
}

const turnoService = new TurnoService(apiService);
