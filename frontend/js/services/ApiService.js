/* =========================================================
   ApiService.js
   -----------------------------------------------------------
   Clase base para hablar con el backend real de PeopleManager
   usando fetch(). Todas las clases de servicio (UsuarioService,
   TurnoService, etc.) usan una instancia de esta clase,
   siguiendo el patrón pedido en la guía de la evidencia
   (GA4-220501096-AA1-EV02): una sola clase concentra el uso de
   fetch, con métodos get/post/put/delete reutilizables.

   Además:
     - Adjunta el token de sesión ("Authorization: Bearer ...")
       en cada petición.
     - Si la API responde 401 (sesión vencida o usuario
       desactivado), cierra la sesión local y lleva al login.
   ========================================================= */

class ApiService {
  /**
   * @param {string} baseUrl - URL base de la API, por ejemplo "http://localhost:3000/api"
   * @param {string} claveSesion - clave donde script.js guarda la sesión en el navegador
   */
  constructor(baseUrl, claveSesion) {
    this.baseUrl = baseUrl;
    this.claveSesion = claveSesion;
  }

  /** Arma la URL completa a partir de una ruta relativa como "/usuarios" o "/turnos?id_usuario=3". */
  construirUrl(ruta) {
    return this.baseUrl + ruta;
  }

  /** Convierte un objeto de filtros en "?a=1&b=2", omitiendo los vacíos. */
  static construirQuery(filtros = {}) {
    const parametros = new URLSearchParams();
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== "") parametros.append(clave, valor);
    });
    const texto = parametros.toString();
    return texto ? `?${texto}` : "";
  }

  /** Lee el token guardado por el login (sessionStorage o, si marcó "Recordarme", localStorage). */
  obtenerToken() {
    try {
      const crudo = sessionStorage.getItem(this.claveSesion) || localStorage.getItem(this.claveSesion);
      return crudo ? JSON.parse(crudo).token : null;
    } catch (error) {
      return null;
    }
  }

  manejarSesionVencida() {
    try {
      sessionStorage.removeItem(this.claveSesion);
      localStorage.removeItem(this.claveSesion);
    } catch (error) {
      // Si el navegador bloquea el almacenamiento, no hay nada que limpiar.
    }
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html?sesion=expirada";
    }
  }

  /**
   * Hace la petición fetch y centraliza el manejo de errores: si el backend
   * responde con un código distinto de 2xx, lanza un Error con el mensaje
   * que mandó la API (o uno genérico si no pudo leerlo), para que quien
   * llame pueda mostrarlo directamente al usuario.
   */
  async solicitar(ruta, opciones = {}) {
    const token = this.obtenerToken();
    const encabezados = { ...(opciones.headers || {}) };
    if (token) encabezados.Authorization = `Bearer ${token}`;

    let respuesta;
    try {
      respuesta = await fetch(this.construirUrl(ruta), { ...opciones, headers: encabezados });
    } catch (errorRed) {
      throw new Error("No se pudo conectar con el servidor. Verifique que la API esté encendida.");
    }

    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch (errorParseo) {
      cuerpo = null;
    }

    // 401 en el login significa "credenciales incorrectas", no "sesión vencida".
    if (respuesta.status === 401 && ruta !== "/usuarios/login") {
      this.manejarSesionVencida();
    }

    if (!respuesta.ok) {
      const mensaje = (cuerpo && cuerpo.mensaje) || `Error ${respuesta.status} al comunicarse con el servidor`;
      const error = new Error(mensaje);
      error.status = respuesta.status;
      error.cuerpo = cuerpo;
      throw error;
    }

    return cuerpo;
  }

  get(ruta) {
    return this.solicitar(ruta, { method: "GET" });
  }

  post(ruta, datos) {
    return this.solicitar(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos || {}),
    });
  }

  put(ruta, datos) {
    return this.solicitar(ruta, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos || {}),
    });
  }

  delete(ruta) {
    return this.solicitar(ruta, { method: "DELETE" });
  }
}

/**
 * URL base única de la API para todo el front-end. Si el backend corre en
 * otro puerto o servidor, este es el único lugar que hay que cambiar.
 */
const API_BASE_URL = "http://localhost:3000/api";
const CLAVE_SESION = "pm_sesion";
const apiService = new ApiService(API_BASE_URL, CLAVE_SESION);
