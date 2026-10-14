/* =========================================================
   CatalogoService.js
   -----------------------------------------------------------
   Trae los catálogos de solo lectura (roles, áreas, cargos,
   tipos de solicitud) que alimentan los <select> de los
   formularios.
   ========================================================= */

class CatalogoService {
  constructor(api) {
    this.api = api;
  }

  obtenerRoles() {
    return this.api.get("/catalogos/roles");
  }

  obtenerAreas() {
    return this.api.get("/catalogos/areas");
  }

  obtenerCargos() {
    return this.api.get("/catalogos/cargos");
  }

  obtenerTiposSolicitud() {
    return this.api.get("/catalogos/tipos-solicitud");
  }
}

const catalogoService = new CatalogoService(apiService);
