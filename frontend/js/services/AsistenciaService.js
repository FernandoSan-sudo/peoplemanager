/* =========================================================
   AsistenciaService.js
   -----------------------------------------------------------
   Registra entrada/salida contra /api/asistencia. El estado
   (a tiempo, tardanza, salida anticipada) y la hora los pone
   el backend; aquí solo se envía el id del turno.
   ========================================================= */

class AsistenciaService {
  constructor(api) {
    this.api = api;
  }

  registrarEntrada(idTurno) {
    return this.api.post("/asistencia/entrada", { id_turno: idTurno });
  }

  registrarSalida(idTurno) {
    return this.api.post("/asistencia/salida", { id_turno: idTurno });
  }

  /** Historial con horas trabajadas. @param {{ id_usuario?, desde?, hasta? }} filtros */
  obtenerHistorial(filtros = {}) {
    return this.api.get(`/asistencia${ApiService.construirQuery(filtros)}`);
  }

  obtenerPorUsuario(idUsuario) {
    return this.api.get(`/asistencia/usuario/${idUsuario}`);
  }
}

const asistenciaService = new AsistenciaService(apiService);
