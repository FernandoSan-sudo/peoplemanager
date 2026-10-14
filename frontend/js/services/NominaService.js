/* =========================================================
   NominaService.js
   -----------------------------------------------------------
   Operaciones sobre /api/nomina: liquidación mensual a partir
   de la asistencia (Administrador y RRHH) y desprendibles de
   pago (cada empleado ve los suyos aprobados o pagados).
   ========================================================= */

class NominaService {
  constructor(api) {
    this.api = api;
  }

  /** Vista previa del mes (no guarda nada). */
  previsualizar(anio, mes) {
    return this.api.get(`/nomina${ApiService.construirQuery({ anio, mes })}`);
  }

  /** Guarda en pm.nomina la liquidación del mes (estado "calculada"). */
  calcular(anio, mes) {
    return this.api.post("/nomina/calcular", { anio, mes });
  }

  obtenerMias() {
    return this.api.get("/nomina/mias");
  }

  /** Desprendible: nómina guardada + detalle por turno. */
  obtenerDetalle(id) {
    return this.api.get(`/nomina/${id}`);
  }

  ajustar(id, bonificaciones, descuentos, motivo) {
    return this.api.put(`/nomina/${id}/ajustes`, { bonificaciones, descuentos, motivo });
  }

  aprobar(id) {
    return this.api.put(`/nomina/${id}/aprobar`);
  }

  pagar(id) {
    return this.api.put(`/nomina/${id}/pagar`);
  }
}

const nominaService = new NominaService(apiService);
