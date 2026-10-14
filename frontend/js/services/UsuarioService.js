/* =========================================================
   UsuarioService.js
   -----------------------------------------------------------
   Operaciones sobre /api/usuarios: login y CRUD. Usa la
   instancia compartida de ApiService (ver ApiService.js).
   ========================================================= */

class UsuarioService {
  constructor(api) {
    this.api = api;
  }

  login(correo, password) {
    return this.api.post("/usuarios/login", { correo, password });
  }

  obtenerTodos() {
    return this.api.get("/usuarios");
  }

  obtenerPorId(id) {
    return this.api.get(`/usuarios/${id}`);
  }

  crear(datosUsuario) {
    return this.api.post("/usuarios", datosUsuario);
  }

  actualizar(id, datosUsuario) {
    return this.api.put(`/usuarios/${id}`, datosUsuario);
  }

  eliminar(id) {
    return this.api.delete(`/usuarios/${id}`);
  }
}

const usuarioService = new UsuarioService(apiService);
