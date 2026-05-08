import { Server as IOServer, Socket } from 'socket.io';

/**
 * Estado compartido de una partida de Blackjack por mesa.
 * El dealer y el mazo son COMPARTIDOS por todos los jugadores de la misma
 * mesa. Cada jugador tiene su propia mano.
 *
 * Sala de espera: si una ronda ya está activa cuando un jugador llega,
 * se registra en `jugadoresEnEspera` y entra a la siguiente ronda.
 */

interface Carta {
    valor: string;
    palo: string;
}

interface EstadoJugador {
    userId: string;
    username: string;
    socketId: string;
    mano: Carta[];
    puntos: number;
    terminado: boolean;
    enEspera: boolean;  // true = esperando próxima ronda
}

interface EstadoPartida {
    lobbyId: string;
    mazo: Carta[];
    manoDealer: Carta[];
    puntosDealer: number;
    dealerTerminado: boolean;
    jugadores: Map<string, EstadoJugador>;   // socketId -> estado
    rondaActiva: boolean;
    turnoActual: string | null;              // socketId del jugador con turno
    ordenTurnos: string[];                   // socketIds en orden
}

// Mapa global: lobbyId -> estado de partida activa
const partidas = new Map<string, EstadoPartida>();

// ---------- Helpers de mazo ----------

function crearMazo(): Carta[] {
    const palos = ['♠', '♥', '♦', '♣'];
    const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const mazo: Carta[] = [];
    for (const p of palos) {
        for (const v of valores) {
            mazo.push({ valor: v, palo: p });
        }
    }
    for (let i = mazo.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
    }
    return mazo;
}

function evaluarMano(mano: Carta[]): number {
    let puntos = 0;
    let ases = 0;
    for (const carta of mano) {
        if (carta.valor === 'A') { ases++; puntos += 11; }
        else if (['J', 'Q', 'K'].includes(carta.valor)) { puntos += 10; }
        else { puntos += parseInt(carta.valor); }
    }
    while (puntos > 21 && ases > 0) { puntos -= 10; ases--; }
    return puntos;
}

function pedirCarta(estado: EstadoPartida): Carta {
    if (estado.mazo.length < 10) {
        estado.mazo = crearMazo();
    }
    return estado.mazo.pop()!;
}

function obtenerOCrearPartida(lobbyId: string): EstadoPartida {
    if (!partidas.has(lobbyId)) {
        partidas.set(lobbyId, {
            lobbyId,
            mazo: crearMazo(),
            manoDealer: [],
            puntosDealer: 0,
            dealerTerminado: false,
            jugadores: new Map(),
            rondaActiva: false,
            turnoActual: null,
            ordenTurnos: [],
        });
    }
    return partidas.get(lobbyId)!;
}

function estadoPublico(estado: EstadoPartida, mostrarDealerCompleto = false) {
    return {
        lobbyId: estado.lobbyId,
        manoDealer: mostrarDealerCompleto
            ? estado.manoDealer
            : estado.manoDealer.length > 0
                ? [estado.manoDealer[0], { valor: '?', palo: '' }]
                : [],
        puntosDealer: mostrarDealerCompleto ? estado.puntosDealer : null,
        dealerTerminado: estado.dealerTerminado,
        rondaActiva: estado.rondaActiva,
        turnoActual: estado.turnoActual,
        jugadores: Array.from(estado.jugadores.values()).map(j => ({
            userId: j.userId,
            username: j.username,
            socketId: j.socketId,
            mano: j.enEspera ? [] : j.mano,
            puntos: j.enEspera ? 0 : j.puntos,
            terminado: j.terminado,
            enEspera: j.enEspera,
        })),
    };
}

// Avanza al siguiente turno en el orden establecido
function avanzarTurno(io: IOServer, estado: EstadoPartida, room: string): void {
    const jugadoresActivos = estado.ordenTurnos.filter(sid => {
        const j = estado.jugadores.get(sid);
        return j && !j.terminado && !j.enEspera;
    });

    if (jugadoresActivos.length === 0) {
        // No hay más jugadores activos, el dealer juega
        verificarFinRonda(io, estado, room);
        return;
    }

    // Encontrar el siguiente en el orden
    const idxActual = estado.turnoActual
        ? jugadoresActivos.indexOf(estado.turnoActual)
        : -1;

    const siguiente = jugadoresActivos[idxActual + 1] ?? null;

    if (siguiente) {
        estado.turnoActual = siguiente;
        io.to(room).emit('bj:estadoActualizado', estadoPublico(estado, false));
        // Notificar al jugador que es su turno
        io.to(siguiente).emit('bj:tuTurno');
    } else {
        // Se acabaron los turnos: dealer juega
        verificarFinRonda(io, estado, room);
    }
}

// ---------- Registro de eventos ----------

export function registerBlackjackSocket(io: IOServer, socket: Socket): void {
    const room = () => `blackjack:${socket.data.lobbyId}`;

    /**
     * bj:unirse
     * Payload: { lobbyId, userId, username }
     * El jugador se une a la mesa. Si hay ronda activa, va a sala de espera.
     * Si no hay ronda activa, se registra para la próxima.
     */
    socket.on('bj:unirse', (payload: { lobbyId: string; userId: string; username: string }) => {
        if (!payload?.lobbyId || !payload?.userId) return;

        socket.data.lobbyId = payload.lobbyId;
        socket.data.userId = payload.userId;
        socket.data.username = payload.username;

        socket.join(`blackjack:${payload.lobbyId}`);

        const estado = obtenerOCrearPartida(payload.lobbyId);
        const enEspera = estado.rondaActiva;

        // Registrar jugador (o actualizar si reconectó)
        const jugadorExistente = Array.from(estado.jugadores.values())
            .find(j => j.userId === payload.userId);

        if (jugadorExistente) {
            // Reconexión: actualizar socketId
            const socketIdViejo = jugadorExistente.socketId;
            estado.jugadores.delete(socketIdViejo);
            const idx = estado.ordenTurnos.indexOf(socketIdViejo);
            if (idx !== -1) estado.ordenTurnos[idx] = socket.id;
            if (estado.turnoActual === socketIdViejo) estado.turnoActual = socket.id;
            jugadorExistente.socketId = socket.id;
            estado.jugadores.set(socket.id, jugadorExistente);
            socket.emit('bj:reconectado', { enEspera: jugadorExistente.enEspera });
        } else {
            estado.jugadores.set(socket.id, {
                userId: payload.userId,
                username: payload.username,
                socketId: socket.id,
                mano: [],
                puntos: 0,
                terminado: false,
                enEspera,
            });
        }

        if (enEspera) {
            socket.emit('bj:enEspera', {
                mensaje: 'Ronda en curso. Entrarás a la siguiente ronda.',
            });
        }

        console.log(`[bj] ${payload.username} se unió al lobby ${payload.lobbyId}${enEspera ? ' (en espera)' : ''}`);

        // Avisar a todos el estado actual
        io.to(`blackjack:${payload.lobbyId}`).emit('bj:estadoActualizado', estadoPublico(estado, false));
    });

    /**
     * bj:iniciarRonda
     * Payload: { lobbyId, userId, username }
     * El primer jugador disponible (no en espera) que emite esto inicia la ronda.
     * Si ya hay ronda activa, se ignora.
     */
    socket.on('bj:iniciarRonda', (payload: { lobbyId: string; userId: string; username: string }) => {
        if (!payload?.lobbyId || !payload?.userId) return;

        // Si no se unió antes, hacerlo ahora
        if (!socket.data.lobbyId) {
            socket.data.lobbyId = payload.lobbyId;
            socket.data.userId = payload.userId;
            socket.data.username = payload.username;
            socket.join(`blackjack:${payload.lobbyId}`);
        }

        const estado = obtenerOCrearPartida(payload.lobbyId);

        if (estado.rondaActiva) {
            socket.emit('bj:enEspera', {
                mensaje: 'Ronda en curso. Espera a que termine para unirte.',
            });
            return;
        }

        // Asegurarse de que el jugador está registrado
        if (!estado.jugadores.has(socket.id)) {
            estado.jugadores.set(socket.id, {
                userId: payload.userId,
                username: payload.username,
                socketId: socket.id,
                mano: [],
                puntos: 0,
                terminado: false,
                enEspera: false,
            });
        }

        // Sacar a los jugadores en espera de la sala de espera
        for (const jugador of estado.jugadores.values()) {
            jugador.enEspera = false;
        }

        // Nueva ronda
        estado.manoDealer = [];
        estado.puntosDealer = 0;
        estado.dealerTerminado = false;
        estado.rondaActiva = true;
        estado.turnoActual = null;
        estado.ordenTurnos = [];

        // Reiniciar manos de jugadores y establecer orden de turnos
        for (const [sid, jugador] of estado.jugadores.entries()) {
            jugador.mano = [];
            jugador.puntos = 0;
            jugador.terminado = false;
            estado.ordenTurnos.push(sid);
        }

        // Repartir 2 cartas al dealer
        estado.manoDealer.push(pedirCarta(estado), pedirCarta(estado));
        estado.puntosDealer = evaluarMano(estado.manoDealer);

        // Repartir 2 cartas a cada jugador
        for (const jugador of estado.jugadores.values()) {
            jugador.mano.push(pedirCarta(estado), pedirCarta(estado));
            jugador.puntos = evaluarMano(jugador.mano);
        }

        // Primer turno = primer jugador del orden
        estado.turnoActual = estado.ordenTurnos[0] ?? null;

        console.log(`[bj] Ronda iniciada en lobby ${payload.lobbyId} con ${estado.jugadores.size} jugador(es). Turno: ${estado.turnoActual}`);

        io.to(`blackjack:${payload.lobbyId}`).emit('bj:estadoActualizado', estadoPublico(estado, false));

        // Notificar al primer jugador que es su turno
        if (estado.turnoActual) {
            io.to(estado.turnoActual).emit('bj:tuTurno');
        }
    });

    /**
     * bj:pedirCarta
     * Solo válido si es el turno del socket que emite.
     */
    socket.on('bj:pedirCarta', () => {
        const lobbyId = socket.data.lobbyId as string | undefined;
        if (!lobbyId) return;

        const estado = partidas.get(lobbyId);
        if (!estado || !estado.rondaActiva) return;
        if (estado.turnoActual !== socket.id) {
            socket.emit('bj:noEsTuTurno');
            return;
        }

        const jugador = estado.jugadores.get(socket.id);
        if (!jugador || jugador.terminado || jugador.enEspera) return;

        jugador.mano.push(pedirCarta(estado));
        jugador.puntos = evaluarMano(jugador.mano);

        if (jugador.puntos > 21) {
            jugador.terminado = true;
            socket.emit('bj:resultadoJugador', { resultado: 'perdiste', puntos: jugador.puntos });
            io.to(room()).emit('bj:estadoActualizado', estadoPublico(estado, false));
            avanzarTurno(io, estado, room());
        } else {
            io.to(room()).emit('bj:estadoActualizado', estadoPublico(estado, false));
        }
    });

    /**
     * bj:plantarse
     * Solo válido si es el turno del socket que emite.
     */
    socket.on('bj:plantarse', () => {
        const lobbyId = socket.data.lobbyId as string | undefined;
        if (!lobbyId) return;

        const estado = partidas.get(lobbyId);
        if (!estado || !estado.rondaActiva) return;
        if (estado.turnoActual !== socket.id) {
            socket.emit('bj:noEsTuTurno');
            return;
        }

        const jugador = estado.jugadores.get(socket.id);
        if (!jugador || jugador.terminado || jugador.enEspera) return;

        jugador.terminado = true;
        io.to(room()).emit('bj:estadoActualizado', estadoPublico(estado, false));
        avanzarTurno(io, estado, room());
    });

    socket.on('disconnect', () => {
        const lobbyId = socket.data.lobbyId as string | undefined;
        if (!lobbyId) return;
        const estado = partidas.get(lobbyId);
        if (!estado) return;

        const jugador = estado.jugadores.get(socket.id);
        if (jugador) {
            console.log(`[bj] ${jugador.username} se desconectó del lobby ${lobbyId}`);
        }

        estado.jugadores.delete(socket.id);
        const idx = estado.ordenTurnos.indexOf(socket.id);
        if (idx !== -1) estado.ordenTurnos.splice(idx, 1);

        // Si era su turno, avanzar al siguiente
        if (estado.turnoActual === socket.id && estado.rondaActiva) {
            avanzarTurno(io, estado, room());
        }

        if (estado.jugadores.size === 0) {
            partidas.delete(lobbyId);
        } else {
            io.to(room()).emit('bj:estadoActualizado', estadoPublico(estado, false));
        }
    });
}

/**
 * El dealer ejecuta su turno y se emiten los resultados finales.
 */
async function verificarFinRonda(io: IOServer, estado: EstadoPartida, room: string): Promise<void> {
    const jugadoresActivos = Array.from(estado.jugadores.values()).filter(j => !j.enEspera);
    const todosTerminados = jugadoresActivos.every(j => j.terminado);
    if (!todosTerminados) return;

    // Turno del dealer
    estado.dealerTerminado = false;
    while (evaluarMano(estado.manoDealer) < 17) {
        await new Promise(r => setTimeout(r, 600));
        estado.manoDealer.push(pedirCarta(estado));
    }
    estado.puntosDealer = evaluarMano(estado.manoDealer);
    estado.dealerTerminado = true;
    estado.rondaActiva = false;
    estado.turnoActual = null;

    // Calcular resultados
    const resultados: Record<string, string> = {};
    for (const [socketId, jugador] of estado.jugadores.entries()) {
        if (jugador.enEspera) continue;
        const pJ = jugador.puntos;
        const pD = estado.puntosDealer;
        if (pJ > 21) {
            resultados[socketId] = 'perdiste';
        } else if (pD > 21 || pJ > pD) {
            resultados[socketId] = 'ganaste';
        } else if (pJ === pD) {
            resultados[socketId] = 'empate';
        } else {
            resultados[socketId] = 'perdiste';
        }
    }

    io.to(room).emit('bj:estadoActualizado', estadoPublico(estado, true));
    io.to(room).emit('bj:finRonda', { resultados, puntosDealer: estado.puntosDealer });

    console.log(`[bj] Ronda terminada en ${estado.lobbyId}. Dealer: ${estado.puntosDealer}`);

    // Los jugadores en espera ya están listos para la siguiente ronda
    for (const jugador of estado.jugadores.values()) {
        jugador.enEspera = false;
    }
}
