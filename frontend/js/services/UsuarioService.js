/* =========================================================
   UsuarioService.js
   -----------------------------------------------------------
   Operaciones sobre /api/usuarios: login, CRUD, desbloqueo y
   cambio de contraseña. Usa la instancia compartida de
   ApiService (ver ApiService.js).
   ========================================================= */

class UsuarioService {
  constructor(api) {
    this.api = api;
  }

  login(correo, password) {
    return this.api.post("/usuarios/login", { correo, password });
  }

  obtenerPerfil() {
    return this.api.get("/usuarios/perfil");
  }

  /** @param {{ estado? }} filtros */
  obtenerTodos(filtros = {}) {
    return this.api.get(`/usuarios${ApiService.construirQuery(filtros)}`);
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

  /** Eliminación lógica: el usuario queda "inactivo". */
  eliminar(id) {
    return this.api.delete(`/usuarios/${id}`);
  }

  desbloquear(id) {
    return this.api.put(`/usuarios/${id}/desbloquear`);
  }

  /** passwordActual solo es obligatoria cuando el usuario cambia su propia contraseña. */
  cambiarPassword(id, passwordNueva, passwordActual) {
    return this.api.put(`/usuarios/${id}/password`, { password_nueva: passwordNueva, password_actual: passwordActual });
  }
}

const usuarioService = new UsuarioService(apiService);
