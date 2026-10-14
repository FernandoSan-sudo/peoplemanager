-- =========================================================
-- PeopleManager - Aplicación web funcional
-- database.sql
-- -----------------------------------------------------------
-- Este script es AUTOSUFICIENTE: crea el esquema "pm" y todas
-- las tablas que necesita la API (roles, areas, cargos,
-- usuarios, turnos, asistencia, tipos_solicitud, solicitudes,
-- nomina, auditoria) usando "IF NOT EXISTS", y luego siembra
-- los datos base.
--
-- Por eso se puede ejecutar en DOS escenarios sin ningún
-- problema:
--   1) En una base de datos nueva, vacía (por ejemplo, la del
--      instructor al evaluar el proyecto): crea todo desde cero.
--   2) En tu base de datos real, la que ya construiste en la
--      evidencia de Bases de Datos: como las tablas ya existen,
--      "IF NOT EXISTS" las deja intactas (no borra ni modifica
--      nada de lo que ya tenías) y solo siembra los datos que
--      falten.
--
-- Cómo ejecutarlo:
--   1) Crea (si no existe) una base de datos llamada
--      "peoplemanager" en tu PostgreSQL.
--   2) Conéctate a ELLA (no a "postgres") con DBeaver o psql.
--   3) Ejecuta este script completo.
--
-- Desde psql:
--   psql -U postgres -d peoplemanager -f database.sql
-- Desde DBeaver: clic derecho sobre la conexión "peoplemanager"
-- -> SQL Editor -> New SQL console, pega este script y
-- ejecútalo completo (Alt+X o el botón "Execute SQL Script").
-- =========================================================

-- ---------------------------------------------------------
-- 1) Esquema
-- ---------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS pm;
SET search_path TO pm;

-- ---------------------------------------------------------
-- 2) Tablas (mismo diseño de la evidencia de Bases de Datos)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    id_rol         SERIAL PRIMARY KEY,
    nombre_rol     VARCHAR(50)  NOT NULL UNIQUE,
    descripcion    VARCHAR(200),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS areas (
    id_area      SERIAL PRIMARY KEY,
    nombre_area  VARCHAR(100) NOT NULL UNIQUE,
    descripcion  VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS cargos (
    id_cargo       SERIAL PRIMARY KEY,
    nombre_cargo   VARCHAR(100) NOT NULL UNIQUE,
    nivel          VARCHAR(20)  NOT NULL
                       CHECK (nivel IN ('operativo','táctico','estratégico')),
    salario_base   NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario         SERIAL PRIMARY KEY,
    numero_documento   VARCHAR(20)  NOT NULL UNIQUE,
    nombre_completo    VARCHAR(150) NOT NULL,
    correo             VARCHAR(120) NOT NULL UNIQUE,
    contrasena_hash    VARCHAR(255) NOT NULL,
    id_rol             INT NOT NULL REFERENCES roles(id_rol),
    id_area            INT REFERENCES areas(id_area),
    id_cargo           INT REFERENCES cargos(id_cargo),
    estado             VARCHAR(10) NOT NULL DEFAULT 'activo'
                           CHECK (estado IN ('activo','inactivo')),
    intentos_fallidos  INT DEFAULT 0,
    bloqueado          BOOLEAN DEFAULT FALSE,
    fecha_creacion     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Por si "usuarios" ya existía (tu base real) desde antes de que se
-- agregara la columna id_cargo en la evidencia de SQL: la añade solo
-- si todavía no está.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_cargo INT REFERENCES cargos(id_cargo);

CREATE TABLE IF NOT EXISTS turnos (
    id_turno         SERIAL PRIMARY KEY,
    id_usuario       INT NOT NULL REFERENCES usuarios(id_usuario),
    fecha_turno      DATE NOT NULL,
    hora_inicio      TIME NOT NULL,
    hora_fin         TIME NOT NULL,
    id_area          INT REFERENCES areas(id_area),
    creado_por       INT REFERENCES usuarios(id_usuario),
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_horas CHECK (hora_fin > hora_inicio)
);

CREATE TABLE IF NOT EXISTS asistencia (
    id_asistencia    SERIAL PRIMARY KEY,
    id_turno         INT NOT NULL REFERENCES turnos(id_turno),
    id_usuario       INT NOT NULL REFERENCES usuarios(id_usuario),
    hora_entrada     TIMESTAMP,
    hora_salida      TIMESTAMP,
    latitud_entrada  NUMERIC(10,7),
    longitud_entrada NUMERIC(10,7),
    latitud_salida   NUMERIC(10,7),
    longitud_salida  NUMERIC(10,7),
    minutos_tardanza INT DEFAULT 0,
    estado_registro  VARCHAR(20) DEFAULT 'pendiente'
        CHECK (estado_registro IN ('pendiente','completo',
               'tardanza','salida_anticipada','ausente')),
    observaciones    TEXT
);

CREATE TABLE IF NOT EXISTS tipos_solicitud (
    id_tipo      SERIAL PRIMARY KEY,
    nombre_tipo  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS solicitudes (
    id_solicitud     SERIAL PRIMARY KEY,
    id_usuario       INT NOT NULL REFERENCES usuarios(id_usuario),
    id_tipo          INT NOT NULL REFERENCES tipos_solicitud(id_tipo),
    fecha_inicio     DATE NOT NULL,
    fecha_fin        DATE NOT NULL,
    motivo           TEXT NOT NULL,
    estado           VARCHAR(15) DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente','aprobada','rechazada')),
    id_aprobador     INT REFERENCES usuarios(id_usuario),
    observacion_resp TEXT,
    fecha_creacion   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta  TIMESTAMP,
    CONSTRAINT chk_fechas_sol CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS nomina (
    id_nomina          SERIAL PRIMARY KEY,
    id_usuario         INT NOT NULL REFERENCES usuarios(id_usuario),
    periodo_mes        INT NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
    periodo_anio       INT NOT NULL,
    horas_ordinarias   NUMERIC(6,2) DEFAULT 0,
    horas_extra_diurna NUMERIC(6,2) DEFAULT 0,
    horas_extra_noct   NUMERIC(6,2) DEFAULT 0,
    recargo_festivo    NUMERIC(10,2) DEFAULT 0,
    bonificaciones     NUMERIC(10,2) DEFAULT 0,
    descuentos         NUMERIC(10,2) DEFAULT 0,
    total_pagar        NUMERIC(12,2) GENERATED ALWAYS AS (
                           horas_ordinarias * 10000
                           + horas_extra_diurna * 12500
                           + horas_extra_noct  * 15000
                           + recargo_festivo + bonificaciones - descuentos
                       ) STORED,
    estado             VARCHAR(15) DEFAULT 'calculada'
        CHECK (estado IN ('calculada','aprobada','pagada')),
    fecha_calculo      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_usuario, periodo_mes, periodo_anio)
);

CREATE TABLE IF NOT EXISTS auditoria (
    id_auditoria    SERIAL PRIMARY KEY,
    id_usuario      INT REFERENCES usuarios(id_usuario),
    accion          VARCHAR(100) NOT NULL,
    tabla_afectada  VARCHAR(60),
    id_registro     INT,
    detalle         TEXT,
    fecha_accion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 3) Índices
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_turnos_usuario  ON turnos(id_usuario);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha    ON turnos(fecha_turno);
CREATE INDEX IF NOT EXISTS idx_asistencia_usr  ON asistencia(id_usuario);
CREATE INDEX IF NOT EXISTS idx_solicitudes_usr ON solicitudes(id_usuario);
CREATE INDEX IF NOT EXISTS idx_nomina_periodo  ON nomina(periodo_anio, periodo_mes);

-- ---------------------------------------------------------
-- 4) Datos base (catálogos que la aplicación necesita para
--    funcionar). Es seguro correr esto varias veces: si el
--    dato ya existe, no se duplica ni se modifica.
-- ---------------------------------------------------------

INSERT INTO roles (nombre_rol, descripcion) VALUES
  ('Administrador', 'Gestión general del sistema, usuarios y configuración'),
  ('Supervisor', 'Gestión de turnos, asistencia y aprobación de solicitudes de su área'),
  ('Empleado', 'Consulta sus turnos, registra su asistencia y crea solicitudes')
ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO areas (nombre_area, descripcion) VALUES
  ('Atención al cliente', 'Atención directa al cliente y soporte'),
  ('Logística', 'Operaciones logísticas y distribución'),
  ('Producción', 'Procesos de producción y planta')
ON CONFLICT (nombre_area) DO NOTHING;

INSERT INTO tipos_solicitud (nombre_tipo) VALUES
  ('Permiso'),
  ('Vacaciones'),
  ('Incapacidad')
ON CONFLICT (nombre_tipo) DO NOTHING;

-- ---------------------------------------------------------
-- 5) Usuario administrador de prueba, listo para iniciar
--    sesión de inmediato (contraseña ya encriptada con bcrypt,
--    10 rondas, calculada con el mismo bcryptjs que usa el
--    backend):
--      correo:    admin@peoplemanager.com
--      password:  admin123
--    Se le asigna el rol "Administrador" recién sembrado
--    arriba. Solo se inserta si no existe ya un usuario con
--    ese correo o ese número de documento.
-- ---------------------------------------------------------
INSERT INTO usuarios (numero_documento, nombre_completo, correo, contrasena_hash, id_rol, estado)
SELECT
  '0000000000',
  'Administrador',
  'admin@peoplemanager.com',
  '$2b$10$2lKnLqDOtN.9.XOgGbp1Qeh9aRXx.LzpDylCArT3TukuNml39U8E.',
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'),
  'activo'
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE correo = 'admin@peoplemanager.com' OR numero_documento = '0000000000'
);
