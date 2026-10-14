/* =========================================================
   ActivoService.js
   -----------------------------------------------------------
   Operaciones sobre /api/activos: inventario de productos de
   la empresa (equipos), su asignación a empleados, devolución
   y traslados entre áreas.
   ========================================================= */

class ActivoService {
  constructor(api) {
    this.api = api;
  }

  /** @param {{ id_area?, estado?: 'asignado'|'disponible', id_usuario? }} filtros */
  obtenerTodos(filtros = {}) {
    return this.api.get(`/activos${ApiService.construirQuery(filtros)}`);
  }

  obtenerMios() {
    return this.api.get("/activos/mios");
  }

  obtenerPorId(id) {
    return this.api.get(`/activos/${id}`);
  }

  obtenerHistorial(id) {
    return this.api.get(`/activos/${id}/historial`);
  }

  crear(datosActivo) {
    return this.api.post("/activos", datosActivo);
  }

  actualizar(id, datosActivo) {
    return this.api.put(`/activos/${id}`, datosActivo);
  }

  eliminar(id) {
    return this.api.delete(`/activos/${id}`);
  }

  asignar(id, idUsuario) {
    return this.api.post(`/activos/${id}/asignar`, { id_usuario: idUsuario });
  }

  devolver(id, observacion) {
    return this.api.post(`/activos/${id}/devolver`, { observacion });
  }

  trasladar(id, idArea) {
    return this.api.post(`/activos/${id}/trasladar`, { id_area: idArea });
  }
}

const activoService = new ActivoService(apiService);
