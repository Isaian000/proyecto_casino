# Proyecto Casino - Version Integrada

Servidor HTTP desarrollado en equipo utilizando Node.js, Express y TypeScript, conectado a MongoDB Atlas. El proyecto fue construido tomando como base avances y estructuras desarrolladas en sprints anteriores, manteniendo consistencia en estilo, arquitectura y decisiones técnicas.

Incluye autenticación local (email/password) y con Google OAuth, sistema de amigos, billetera con operaciones atómicas, lobbies para juegos, subida de avatares con Cloudinary y consumo de una API externa de tipo de cambio.

El **frontend** (HTML, CSS y JavaScript del navegador) fue adaptado para consumir directamente los endpoints del backend, respetando la lógica ya definida y asegurando compatibilidad completa entre cliente y servidor.

La lógica de los juegos (Blackjack y Ruleta) no está implementada todavía; sin embargo, se deja preparada la estructura de lobbies y un flujo de prueba en el cliente para apostar y registrar resultados utilizando `/api/wallet/bet` y `/api/wallet/win`.

---

## Integración y desarrollo

### Base del proyecto

El sistema se construyó a partir de una base trabajada en entregas anteriores, conservando:

- Configuración (`src/config`): `db.ts`, `env.ts`, `passport.ts`, `cloudinary.ts`.
- Middleware `isLoggedIn` para autenticación mediante JWT, cookies o sesión.
- Modelos Mongoose: `user`, `friendship`, `lobby`, `transaction`.
- Controladores principales: `auth`, `wallet`, `friend`, `lobby`, `avatar`, `exchange`.
- Rutas funcionales para cada módulo del sistema.

### Frontend

Se integraron y adaptaron vistas y recursos del cliente:

- Vistas HTML: `index`, `login`, `register`, `perfil`, `mesas`, `blackjack`, `ruleta`, `404`.
- Estilos CSS organizados por vista.
- Recursos gráficos en `public/img`.

### Adaptaciones realizadas

Se reescribieron los scripts del frontend para alinearlos completamente con los endpoints del backend:

- Consumo de rutas REST (`/api/auth`, `/api/users`, `/api/wallet`, `/api/lobbies`).
- Ajuste de nombres de campos entre backend y frontend.
- Manejo de autenticación y persistencia de sesión desde el cliente.

### Extensiones implementadas

Se añadieron funcionalidades necesarias para completar el flujo del sistema:

- Controlador de usuario:
  - Cambio de contraseña.
  - Eliminación de cuenta.
- Nuevas rutas:
  - `PATCH /api/users/me/password`
  - `DELETE /api/users/me`
  - `POST /api/auth/logout`
  - `GET /api/wallet/stats`
- Ajustes en enrutamiento para separar vistas de juegos.
- Corrección y estabilización de dependencias en `package.json`.
- Script `copy:assets` para incluir archivos estáticos en el build.

---

## Requisitos

- Node.js 18 o superior
- MongoDB Atlas o instancia local
- Opcional:
  - Google OAuth
  - Cloudinary

---

## Instalación

```bash
npm install
.env
```

Editar `.env` con los valores correspondientes.

---

## Variables de entorno

Las variables principales son:

| Variable | Descripción |
|----------|-------------|
| PORT | Puerto del servidor |
| NODE_ENV | Entorno de ejecución |
| APP_URL | URL pública |
| MONGO_URI | Conexión a MongoDB |
| JWT_SECRET | Secreto JWT |
| SESSION_SECRET | Secreto de sesión |
| GOOGLE_CLIENT_ID / SECRET | OAuth Google |
| CLOUDINARY_* | Credenciales Cloudinary |
| EXCHANGE_RATE_API_URL | API de tipo de cambio |

---

## Ejecución

Modo desarrollo:

```bash
npm run dev
```

Producción:

```bash
npm run build
npm start
```

Servidor disponible en:

http://localhost:3000

---

## Vistas disponibles

| Ruta | Descripción |
|------|-------------|
| `/` | Página principal |
| `/login` | Inicio de sesión |
| `/register` | Registro |
| `/perfil` | Perfil de usuario |
| `/mesas` | Lobbies |
| `/blackjack` | Mesa Blackjack |
| `/ruleta` | Mesa Ruleta |

---

## Endpoints principales

### Autenticación

- Registro, login, sesión, logout y Google OAuth.

### Usuarios

- Consulta, edición, cambio de contraseña, eliminación y avatar.

### Amigos

- Solicitudes, aceptación, rechazo y eliminación.

### Billetera

- Balance, depósitos, retiros, apuestas, ganancias, historial y estadísticas.

### Lobbies

- Creación, listado, unión y salida.

### Tipo de cambio

- Consulta y conversión de divisas.

---

## Arquitectura

src/
  index.ts
  config/
  middleware/
  models/
  controllers/
  routes/
  utils/
  views/
  public/

El build genera `dist/` listo para producción, incluyendo backend y recursos estáticos.

---

## Notas finales

El desarrollo de este proyecto fue realizado de manera conjunta, manteniendo coherencia con prácticas previas del curso y priorizando la correcta integración de todos los módulos. Se enfocó en garantizar consistencia en la arquitectura, funcionamiento estable del backend y correcta comunicación con el frontend.

---

## Sockets en tiempo real (Socket.io)

Se integro Socket.io sobre el mismo servidor HTTP de Express para notificar
en tiempo real cuando un jugador se une o sale de una mesa (lobby). No se
implementa logica de juego: solo eventos de presencia.

### Nuevas dependencias

- `socket.io` (servidor, ya incluye sus tipos TypeScript).
- `socket.io-client` se carga en el navegador desde CDN
  (`https://cdn.socket.io/4.7.5/socket.io.min.js`), no requiere instalacion.

### Estructura agregada

```
src/sockets/
  index.ts          # Inicializa io sobre el servidor HTTP
  lobby.socket.ts   # Eventos joinLobby / leaveLobby / playerJoined / playerLeft
src/views/
  socket-client.js  # Cliente que se conecta y muestra alertas
```

### Eventos

Cliente -> Servidor:

- `joinLobby`  `{ lobbyId, userId, username }`
- `leaveLobby` `{ lobbyId, userId, username }`

Servidor -> Sala (`lobby:<lobbyId>`):

- `playerJoined` `{ lobbyId, userId, username }`
- `playerLeft`   `{ lobbyId, userId, username }`

### Ejecutar el proyecto con sockets

```bash
npm install
npm run dev          # desarrollo (ts-node + nodemon)
# o
npm run build && npm start
```

Al abrir una mesa de Blackjack o Ruleta (`/blackjack?mesa=<id>` o
`/ruleta?mesa=<id>`), el navegador se conecta automaticamente al socket
y mostrara una alerta cuando otro jugador entre o salga de esa misma mesa.
