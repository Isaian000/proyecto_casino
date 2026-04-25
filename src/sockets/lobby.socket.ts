import { Server as IOServer, Socket } from 'socket.io';

/**
 * Payloads basicos de los eventos de lobby.
 * Se mantienen simples a proposito: solo identificacion de jugador y sala.
 */
export interface JoinLeavePayload {
    lobbyId: string;
    userId: string;
    username: string;
}

export interface PlayerEventPayload {
    lobbyId: string;
    userId: string;
    username: string;
}

/**
 * Registra los eventos de lobby para un socket recien conectado.
 * No implementa logica de juego: solo unirse/salir de salas y notificar.
 */
export function registerLobbySocket(io: IOServer, socket: Socket): void {
    socket.on('joinLobby', (payload: JoinLeavePayload) => {
        if (!payload || !payload.lobbyId || !payload.userId) return;

        const room = `lobby:${payload.lobbyId}`;
        socket.join(room);

        // Guardamos datos minimos en el socket para poder notificar al desconectarse.
        (socket.data as Record<string, unknown>).lobbyId = payload.lobbyId;
        (socket.data as Record<string, unknown>).userId = payload.userId;
        (socket.data as Record<string, unknown>).username = payload.username;

        const out: PlayerEventPayload = {
            lobbyId: payload.lobbyId,
            userId: payload.userId,
            username: payload.username,
        };

        io.to(room).emit('playerJoined', out);
        console.log(`[lobby] ${payload.username} se unio a ${room}`);
    });

    socket.on('leaveLobby', (payload: JoinLeavePayload) => {
        if (!payload || !payload.lobbyId) return;
        const room = `lobby:${payload.lobbyId}`;

        const out: PlayerEventPayload = {
            lobbyId: payload.lobbyId,
            userId: payload.userId,
            username: payload.username,
        };

        io.to(room).emit('playerLeft', out);
        socket.leave(room);
        console.log(`[lobby] ${payload.username} salio de ${room}`);
    });

    socket.on('disconnect', () => {
        const data = socket.data as Record<string, string | undefined>;
        if (data.lobbyId && data.userId) {
            const room = `lobby:${data.lobbyId}`;
            const out: PlayerEventPayload = {
                lobbyId: data.lobbyId,
                userId: data.userId,
                username: data.username || 'Jugador',
            };
            io.to(room).emit('playerLeft', out);
        }
    });
}
