# PeopleManager – Aplicación web funcional (GA4-220501096-AA1-EV02)

Este proyecto conecta el front-end de PeopleManager (HTML/CSS/JS) con la API
real del backend (Node.js + Express + PostgreSQL), usando `fetch()` y clases
de servicio (POO), tal como lo pide la guía de la evidencia.

El diseño de la base de datos (esquema `pm`, con las tablas `usuarios`,
`turnos`, `asistencia`, `solicitudes`, `roles`, `areas`, `cargos` y
`tipos_solicitud`) es el mismo que ya construiste en la evidencia de Bases
de Datos: no se le cambió ni se le agregó ninguna columna nueva.

`database.sql` está escrito para que **funcione en cualquier equipo**,
tenga o no la base de datos creada de antes:
- Si la base de datos `peoplemanager` ya tiene el esquema `pm` con sus
  tablas (como en tu computador), el script no las toca — solo siembra los
  datos que falten.
- Si se ejecuta en un computador donde `peoplemanager` está vacía (por
  ejemplo, el de tu instructor, al evaluar el proyecto), el script crea el
  esquema y las tablas desde cero, y luego las siembra.

Por eso, para entregar el proyecto no era obligatorio exportar la base de
datos — con `database.sql` bastaba. Aun así, esta carpeta incluye además
`peoplemanager_dump.sql`, un respaldo completo de la base de datos real
(hecho con la función "Backup" de DBeaver), para que tu instructor pueda
levantar el sistema con tus datos reales de prueba en vez de una base
vacía. Ver la sección "Restaurar el respaldo de la base de datos" más
abajo para instrucciones.

## Estructura de la carpeta

```
PeopleManager_WebFuncional/
├── frontend/            → páginas HTML, CSS y JS del sistema
│   └── js/services/     → ApiService y los servicios por recurso (fetch)
├── backend/              → API REST (Node/Express) contra la BD real
├── database.sql          → crea el esquema/tablas si no existen + siembra catálogos y un usuario admin
├── peoplemanager_dump.sql → respaldo completo de la base de datos real (formato binario de pg_dump)
├── postman/               → colección de Postman con todos los endpoints
└── README.md              → este archivo
```

## 1. Preparar la base de datos

Hay dos formas de tener la base de datos lista. Usa la que prefieras — no
hace falta hacer las dos.

### Opción A: restaurar el respaldo real (`peoplemanager_dump.sql`)

Este archivo, aunque termina en `.sql`, **no es texto plano**: es un
respaldo en formato binario, hecho con la herramienta "Backup" de DBeaver.
Solo se restaura con DBeaver (o `pg_restore`), no se puede abrir ni pegar
en un editor SQL.

1. En DBeaver, crea una conexión nueva a PostgreSQL apuntando a una base de
   datos vacía llamada `peoplemanager` (o usa una conexión ya existente que
   apunte a ella).
2. Haz clic derecho sobre esa conexión (o sobre la base de datos) →
   **Herramientas → Restaurar backup** (Tools → Restore).
3. Selecciona el archivo `peoplemanager_dump.sql` y confirma.
4. Cuando termine, ya tendrás el esquema `pm` con todas sus tablas y los
   datos reales de prueba.

### Opción B: correr `database.sql` (crea todo desde cero, con datos mínimos)

1. Conéctate con DBeaver a una base de datos `peoplemanager` (vacía o no).
2. Abre `database.sql` en una consola SQL **conectada a esa base** (clic
   derecho en la conexión → SQL Editor → New SQL console) y ejecútalo
   completo.
3. Esto:
   - Crea el esquema `pm` y todas sus tablas, si no existen (si ya
     existen, no las toca).
   - Siembra los roles (Administrador, Supervisor, Empleado), las áreas
     (Atención al cliente, Logística, Producción) y los tipos de
     solicitud (Permiso, Vacaciones, Incapacidad), si no existen.
   - Crea un usuario administrador de prueba, **solo si no existe ya un
     usuario con ese correo o número de documento**:
     - correo: `admin@peoplemanager.com`
     - contraseña: `admin123`

   El script usa `IF NOT EXISTS`, `ON CONFLICT DO NOTHING` y
   `WHERE NOT EXISTS`, así que se puede ejecutar varias veces sin miedo a
   duplicar nada.

## 2. Configurar y correr el backend

1. Entra a la carpeta `backend/`.
2. Copia `.env.example` a un archivo nuevo llamado `.env` y coloca tus datos
   reales de conexión a PostgreSQL:

   ```
   DB_HOST=localhost
   DB_USER=postgres
   DB_PASSWORD=tu_contraseña_real
   DB_NAME=peoplemanager
   DB_PORT=5432
   PORT=3000
   ```

3. Instala las dependencias:

   ```
   npm install
   ```

4. Inicia el servidor:

   ```
   npm start
   ```

   Si todo está bien, verás en la consola:

   ```
   Conexión con PostgreSQL (esquema pm) establecida correctamente
   Servidor escuchando en el puerto 3000
   ```

   Nota: este backend no usa el paquete `dotenv` — trae su propio cargador
   de `.env` en `config/env.js` (unas pocas líneas, sin dependencias de
   terceros), así que no hace falta instalar nada aparte para eso.

## 3. Abrir el front-end

El front-end está en `frontend/`. Puedes abrir `frontend/index.html`
directamente en el navegador, o servirlo con la extensión "Live Server" de
VS Code (recomendado, para evitar problemas de rutas relativas).

La URL de la API está fijada en `frontend/js/services/ApiService.js`:

```js
const API_BASE_URL = "http://localhost:3000/api";
```

Si corres el backend en otro puerto o servidor, cambia esa línea.

## 4. Probar el sistema

1. Ve a **Iniciar sesión** y entra con `admin@peoplemanager.com` / `admin123`.
2. En **Turnos**, asigna un turno nuevo a un empleado (el backend ya trae
   sembrados algunos usuarios de las evidencias anteriores; si no hay
   ninguno, créalo primero desde Postman con `POST /api/usuarios`).
3. En **Asistencia**, verás el mismo turno: pulsa "Registrar entrada" y
   luego "Registrar salida". El estado (a tiempo, tardanza, etc.) lo calcula
   el backend automáticamente comparando la hora real contra el horario del
   turno — no hay ningún dato de "estado" guardado directamente en la tabla
   de turnos, por diseño (evita duplicar información que ya vive en la
   tabla de asistencia).
4. En **Solicitudes**, crea una solicitud de permiso/vacaciones/incapacidad
   y luego apruébala o recházala.
5. En **Inicio**, verás el resumen (turnos completados, pendientes,
   tardanzas y solicitudes pendientes) calculado con datos reales de la API.

## 5. Probar con Postman

Importa `postman/PeopleManager-API.postman_collection.json` en Postman.
Trae una carpeta por cada módulo (Usuarios, Catálogos, Turnos, Asistencia,
Solicitudes) con ejemplos ya armados. Cambia la variable `baseUrl` si tu
backend corre en otra dirección.

## Decisiones de diseño importantes

- **La base de datos real (`pm`) no se modificó.** No se agregó ninguna
  columna nueva (por ejemplo, un "estado" en `turnos`): todo lo que el
  front-end necesita mostrar pero no tiene columna propia (el semáforo de
  asistencia de un turno) se calcula con una consulta SQL (`JOIN`) en el
  backend, en el momento en que se pide la información. Esto evita que dos
  columnas digan cosas distintas sobre lo mismo.
- **No se pide ubicación GPS** al registrar asistencia, aunque la tabla
  `pm.asistencia` tiene columnas para eso (`latitud_entrada`, etc.): el
  front-end de esta evidencia no la captura, así que esas columnas
  simplemente quedan vacías.
- **Nómina no se conectó en esta evidencia.** Se dejó fuera del alcance por
  el tiempo disponible; queda como una posible ampliación futura.

## Antes de comprimir la carpeta para entregar

Estos archivos y carpetas quedaron en `backend/` solo para hacer pruebas
locales durante el desarrollo y **no deben ir en la entrega**. Bórralos a
mano antes de crear el .zip:

- `backend/node_modules/` (se regenera con `npm install`)
- `backend/_test/` (harness de pruebas, no es parte del proyecto)
- `backend/.env` (contiene credenciales; cada quien pone las suyas)
- `backend/config/database.js.real` y `backend/config/database.js.test`,
  si aparecen (restos de pruebas)
- `backend/package-lock.json` (opcional, se regenera solo)

## Usuario de prueba

| Correo | Contraseña |
|---|---|
| admin@peoplemanager.com | admin123 |
