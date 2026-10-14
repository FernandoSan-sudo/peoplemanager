/* =========================================================
   TurnoService.js
   -----------------------------------------------------------
   Operaciones sobre /api/turnos. El "estado_asistencia" (el
   semáforo que se muestra en pantalla) no se envía nunca desde
   aquí: siempre llega calculado por el backend a partir de
   pm.asistencia y pm.solicitudes.
   ========================================================= */

class TurnoService {
  constructor(api) {
    this.api = api;
  }

  /** @param {{ id_usuario?, id_area?, fecha?, desde?, hasta? }} filtros */
  obtenerTodos(filtros = {}) {
    return this.api.get(`/turnos${ApiService.construirQuery(filtros)}`);
  }

  obtenerPorId(id) {
    return this.api.get(`/turnos/${id}`);
  }

  crear(datosTurno) {
    return this.api.post("/turnos", datosTurno);
  }

  /** Mismo horario en varios días: { id_usuario, fecha_inicio, fecha_fin, dias_semana: [1..5], hora_inicio, hora_fin, id_area } */
  crearLote(datosLote) {
    return this.api.post("/turnos/lote", datosLote);
  }

  actualizar(id, datosTurno) {
    return this.api.put(`/turnos/${id}`, datosTurno);
  }

  eliminar(id) {
    return this.api.delete(`/turnos/${id}`);
  }
}

const turnoService = new TurnoService(apiService);
