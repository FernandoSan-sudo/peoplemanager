/**
 * config/roles.js
 * -----------------------------------------------------------
 * Nombres de los roles tal como existen en pm.roles. Se usan en
 * los middlewares de autorización para decidir qué puede hacer
 * cada usuario:
 *   - Administrador: todo el sistema.
 *   - RRHH: gestión de personal (usuarios), solicitudes y reportes.
 *   - Supervisor: turnos, asistencia de su equipo y solicitudes.
 *   - Empleado: solo sus propios turnos, asistencia y solicitudes.
 */

const ROLES = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  RRHH: "RRHH",
  EMPLEADO: "Empleado",
};

/** Roles que gestionan a otras personas (ven y administran datos de todos). */
const GESTORES = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.RRHH];

/** Roles que pueden crear, editar y desactivar usuarios. */
const ADMINISTRAN_USUARIOS = [ROLES.ADMIN, ROLES.RRHH];

/** Roles que planifican turnos. */
const PLANIFICAN_TURNOS = [ROLES.ADMIN, ROLES.SUPERVISOR];

const esGestor = (usuario) => Boolean(usuario) && GESTORES.includes(usuario.nombre_rol);

module.exports = {
  ROLES,
  GESTORES,
  ADMINISTRAN_USUARIOS,
  PLANIFICAN_TURNOS,
  esGestor,
};
