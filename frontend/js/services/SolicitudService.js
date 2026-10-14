/* =========================================================
   SolicitudService.js
   -----------------------------------------------------------
   Operaciones sobre /api/solicitudes: crear, listar y
   aprobar/rechazar (aprobar/rechazar las hace un gestor:
   Administrador, Supervisor o RRHH).
   ========================================================= */

class SolicitudService {
  constructor(api) {
    this.api = api;
  }

  /** @param {{ id_usuario?, estado? }} filtros */
  obtenerTodas(filtros = {}) {
    return this.api.get(`/solicitudes${ApiService.construirQuery(filtros)}`);
  }

  obtenerPorId(id) {
    return this.api.get(`/solicitudes/${id}`);
  }

  crear(datosSolicitud) {
    return this.api.post("/solicitudes", datosSolicitud);
  }

  aprobar(id, observacion) {
    return this.api.put(`/solicitudes/${id}/aprobar`, { observacion_resp: observacion });
  }

  rechazar(id, observacion) {
    return this.api.put(`/solicitudes/${id}/rechazar`, { observacion_resp: observacion });
  }
}

const solicitudService = new SolicitudService(apiService);
