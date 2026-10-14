/* =========================================================
   AsistenciaService.js
   -----------------------------------------------------------
   Registra entrada/salida contra /api/asistencia. El estado
   (a tiempo, tardanza, salida anticipada) lo calcula el
   backend comparando la hora real contra el turno; aquí solo
   se envían los ids necesarios.
   ========================================================= */

class AsistenciaService {
  constructor(api) {
    this.api = api;
  }

  registrarEntrada(idTurno, idUsuario) {
    return this.api.post("/asistencia/entrada", { id_turno: idTurno, id_usuario: idUsuario });
  }

  registrarSalida(idTurno) {
    return this.api.post("/asistencia/salida", { id_turno: idTurno });
  }

  obtenerPorUsuario(idUsuario) {
    return this.api.get(`/asistencia/usuario/${idUsuario}`);
  }
}

const asistenciaService = new AsistenciaService(apiService);
