import express from 'express';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';

import { env } from './config/env';
import connectDB from './config/db';
import passport, { configurePassport } from './config/passport';
import { initLobbies } from './controllers/lobby.controller';
import { initSocket } from './sockets';

import authRoutes from './routes/auth.routes';
import friendRoutes from './routes/friend.routes';
import walletRoutes from './routes/wallet.routes';
import lobbyRoutes from './routes/lobby.routes';
import userRoutes from './routes/user.routes';
import exchangeRoutes from './routes/exchange.routes';
import docsRoutes from './routes/docs.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa la BD y, una vez conectada, asegura las mesas (lobbies) base.
connectDB().then(() => {
    initLobbies().catch((e) => console.error('Error inicializando lobbies:', e));
});
configurePassport();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('trust proxy', 1);
app.use(
    session({
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        
        cookie: { secure: env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
);
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));
// Alias para que las rutas tipo /views/utils.js usadas en los HTML resuelvan
// correctamente y los scripts del frontend se carguen en el navegador.
app.use('/views', express.static(path.join(__dirname, 'views')));

// API
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exchange', exchangeRoutes);

// Documentación Swagger UI — accesible en /api/docs
app.use('/api/docs', docsRoutes);

// Vistas
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
app.get('/login', (_req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});
app.get('/register', (_req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'sigin.html'));
});
app.get('/perfil', (_req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'perfil.html'));
});
app.get('/mesas', (_req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'mesas.html'));
});
app.get('/blackjack', (_req, res) => {
    // Estructura preparada; logica del juego en el siguiente sprint.
    res.sendFile(path.join(__dirname, 'views', 'blackjack.html'));
});
app.get('/ruleta', (_req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'ruleta.html'));
});

// 404 para API
app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

// 404 para vistas
app.use((_req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
    const url = process.env.APP_URL || `http://localhost:${PORT}`;
    console.log(`Servidor corriendo en: ${url}`);
    console.log(`Swagger UI disponible en: ${url}/api/docs`);
});
//