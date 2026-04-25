import { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { registerLobbySocket } from './lobby.socket';

let io: IOServer | null = null;

/**
 * Inicializa Socket.io sobre el servidor HTTP de Express.
 * Registra los handlers de cada feature (por ahora: lobby).
 */
export function initSocket(httpServer: HTTPServer): IOServer {
    io = new IOServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket: Socket) => {
        console.log(`[socket] conectado: ${socket.id}`);

        registerLobbySocket(io as IOServer, socket);

        socket.on('disconnect', (reason) => {
            console.log(`[socket] desconectado: ${socket.id} (${reason})`);
        });
    });

    console.log('Socket.io inicializado');
    return io;
}

export function getIO(): IOServer {
    if (!io) {
        throw new Error('Socket.io no ha sido inicializado todavia');
    }
    return io;
}
