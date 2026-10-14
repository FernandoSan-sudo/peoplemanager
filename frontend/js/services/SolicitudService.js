/* =========================================================
   SolicitudService.js
   -----------------------------------------------------------
   Operaciones sobre /api/solicitudes: crear, listar y
   aprobar/rechazar (aprobar/rechazar las hace un supervisor o
   administrador).
   ========================================================= */

class SolicitudService {
  constructor(api) {
    this.api = api;
  }

  obtenerTodas(idUsuario) {
    const query = idUsuario ? `?id_usuario=${idUsuario}` : "";
    return this.api.get(`/solicitudes${query}`);
  }

  obtenerPorId(id) {
    return this.api.get(`/solicitudes/${id}`);
  }

  crear(datosSolicitud) {
    return this.api.post("/solicitudes", datosSolicitud);
  }

  aprobar(id, idAprobador, observacion) {
    return this.api.put(`/solicitudes/${id}/aprobar`, { id_aprobador: idAprobador, observacion_resp: observacion });
  }

  rechazar(id, idAprobador, observacion) {
    return this.api.put(`/solicitudes/${id}/rechazar`, { id_aprobador: idAprobador, observacion_resp: observacion });
  }
}

const solicitudService = new SolicitudService(apiService);
