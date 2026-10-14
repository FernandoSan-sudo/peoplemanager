/* =========================================================
   ApiService.js
   -----------------------------------------------------------
   Clase base para hablar con el backend real de PeopleManager
   usando fetch(). Todas las clases de servicio (UsuarioService,
   TurnoService, etc.) heredan de esta o la usan internamente,
   siguiendo el patrón pedido en la guía de la evidencia
   (GA4-220501096-AA1-EV02): una sola clase concentra el uso de
   fetch, con métodos get/post/put/delete reutilizables.
   ========================================================= */

class ApiService {
  /**
   * @param {string} baseUrl - URL base de la API, por ejemplo "http://localhost:3000/api"
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /** Arma la URL completa a partir de una ruta relativa como "/usuarios" o "/turnos?id_usuario=3". */
  construirUrl(ruta) {
    return this.baseUrl + ruta;
  }

  /**
   * Hace la petición fetch y centraliza el manejo de errores: si el backend
   * responde con un código distinto de 2xx, lanza un Error con el mensaje
   * que mandó la API (o uno genérico si no pudo leerlo), para que quien
   * llame pueda mostrarlo directamente al usuario.
   */
  async solicitar(ruta, opciones = {}) {
    let respuesta;
    try {
      respuesta = await fetch(this.construirUrl(ruta), opciones);
    } catch (errorRed) {
      throw new Error("No se pudo conectar con el servidor. Verifique que la API esté encendida.");
    }

    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch (errorParseo) {
      cuerpo = null;
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
      body: JSON.stringify(datos),
    });
  }

  put(ruta, datos) {
    return this.solicitar(ruta, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
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
const apiService = new ApiService(API_BASE_URL);
