/* =========================================================
   ReporteService.js
   -----------------------------------------------------------
   Consultas de solo lectura para el dashboard (/api/reportes/
   resumen), el consolidado de asistencia por empleado y la
   bitácora de auditoría (/api/auditoria, solo Administrador).
   ========================================================= */

class ReporteService {
  constructor(api) {
    this.api = api;
  }

  obtenerResumen() {
    return this.api.get("/reportes/resumen");
  }

  /** @param {{ desde?, hasta?, id_area? }} filtros */
  obtenerAsistenciaPorEmpleado(filtros = {}) {
    return this.api.get(`/reportes/asistencia${ApiService.construirQuery(filtros)}`);
  }

  /** @param {{ limite?, accion?, id_usuario? }} filtros */
  obtenerAuditoria(filtros = {}) {
    return this.api.get(`/auditoria${ApiService.construirQuery(filtros)}`);
  }

  obtenerAccionesAuditoria() {
    return this.api.get("/auditoria/acciones");
  }
}

const reporteService = new ReporteService(apiService);
