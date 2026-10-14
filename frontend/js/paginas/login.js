/* =========================================================
   paginas/login.js — Inicio de sesión (login.html)
   -----------------------------------------------------------
   Valida el formulario, llama a POST /api/usuarios/login y
   guarda el token. Si el usuario venía de una página privada
   (?destino=turnos.html), vuelve a ella después del login.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  const formulario = document.getElementById("formLogin");
  if (!formulario) return;

  const parametros = new URLSearchParams(window.location.search);
  const PAGINAS_PERMITIDAS = ["index.html", "turnos.html", "asistencia.html", "solicitudes.html", "usuarios.html", "reportes.html", "nomina.html"];
  const destino = PAGINAS_PERMITIDAS.includes(parametros.get("destino")) ? parametros.get("destino") : "index.html";

  // Si ya hay sesión abierta, no tiene sentido mostrar el login.
  if (obtenerSesion()) {
    window.location.href = destino;
    return;
  }

  const campoEmail = document.getElementById("email");
  const campoPassword = document.getElementById("password");
  const campoRecordarme = document.getElementById("recordarme");
  const botonMostrarPassword = document.getElementById("togglePassword");
  const alertaExito = document.getElementById("loginExito");
  const alertaError = document.getElementById("loginError");
  const alertaInfo = document.getElementById("loginInfo");

  const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const avisos = {
    expirada: "Tu sesión expiró o fue cerrada por un administrador. Inicia sesión nuevamente.",
    cerrada: "Cerraste sesión correctamente.",
  };
  if (alertaInfo && avisos[parametros.get("sesion")]) {
    alertaInfo.textContent = avisos[parametros.get("sesion")];
    alertaInfo.classList.remove("d-none");
  } else if (alertaInfo && parametros.get("destino")) {
    alertaInfo.textContent = "Debes iniciar sesión para continuar.";
    alertaInfo.classList.remove("d-none");
  }

  function marcarCampoInvalido(campo, mensaje) {
    campo.classList.add("is-invalid");
    campo.classList.remove("is-valid");
    const feedback = document.getElementById(campo.id + "Feedback");
    if (feedback) feedback.textContent = mensaje;
  }

  function marcarCampoValido(campo) {
    campo.classList.remove("is-invalid");
    campo.classList.add("is-valid");
  }

  function validarEmail() {
    const valor = campoEmail.value.trim();
    if (valor === "") {
      marcarCampoInvalido(campoEmail, "El correo electrónico es obligatorio.");
      return false;
    }
    if (!REGEX_EMAIL.test(valor)) {
      marcarCampoInvalido(campoEmail, "Ingrese un correo electrónico con un formato válido (ejemplo: usuario@dominio.com).");
      return false;
    }
    marcarCampoValido(campoEmail);
    return true;
  }

  // En el login solo se exige que la contraseña no esté vacía: la política de
  // longitud aplica al crear/cambiar contraseñas, no a las que ya existen.
  function validarPassword() {
    if (campoPassword.value === "") {
      marcarCampoInvalido(campoPassword, "La contraseña es obligatoria.");
      return false;
    }
    marcarCampoValido(campoPassword);
    return true;
  }

  campoEmail.addEventListener("blur", validarEmail);
  campoPassword.addEventListener("blur", validarPassword);
  campoEmail.addEventListener("input", function () {
    if (campoEmail.classList.contains("is-invalid")) validarEmail();
  });
  campoPassword.addEventListener("input", function () {
    if (campoPassword.classList.contains("is-invalid")) validarPassword();
  });

  if (botonMostrarPassword) {
    botonMostrarPassword.addEventListener("click", function () {
      const seEstaMostrando = campoPassword.getAttribute("type") === "text";
      campoPassword.setAttribute("type", seEstaMostrando ? "password" : "text");
      botonMostrarPassword.setAttribute("aria-pressed", String(!seEstaMostrando));
      botonMostrarPassword.textContent = seEstaMostrando ? "Mostrar" : "Ocultar";
    });
  }

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    alertaExito.classList.add("d-none");
    alertaError.classList.add("d-none");
    if (alertaInfo) alertaInfo.classList.add("d-none");

    const emailValido = validarEmail();
    const passwordValido = validarPassword();
    if (!emailValido || !passwordValido) {
      const primerCampoInvalido = formulario.querySelector(".is-invalid");
      if (primerCampoInvalido) primerCampoInvalido.focus();
      return;
    }

    const botonEnviar = formulario.querySelector('button[type="submit"]');
    botonEnviar.disabled = true;
    botonEnviar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Verificando...';

    try {
      // POST /api/usuarios/login devuelve el token y los datos del usuario (incluido su rol).
      const respuesta = await usuarioService.login(campoEmail.value.trim(), campoPassword.value);
      guardarSesion(respuesta, campoRecordarme && campoRecordarme.checked);

      alertaExito.textContent = "¡Bienvenido(a), " + respuesta.usuario.nombre_completo + "! Redirigiendo...";
      alertaExito.classList.remove("d-none");
      alertaExito.focus();
      formulario.reset();

      setTimeout(function () {
        window.location.href = destino;
      }, 700);
    } catch (error) {
      alertaError.textContent = error.message || "Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.";
      alertaError.classList.remove("d-none");
      alertaError.focus();
      campoPassword.value = "";
      campoPassword.classList.remove("is-valid");
      campoPassword.focus();
      botonEnviar.disabled = false;
      botonEnviar.textContent = "Iniciar sesión";
    }
  });
});
