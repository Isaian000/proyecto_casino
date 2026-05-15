import { Server as IOServer, Socket } from 'socket.io';

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
    enEspera: boolean;
    participando: boolean;
}

interface EstadoPartida {
    lobbyId: string;

    mazo: Carta[];

    manoDealer: Carta[];
    puntosDealer: number;
    dealerTerminado: boolean;

    jugadores: Map<string, EstadoJugador>;

    rondaActiva: boolean;

    turnoActual: string | null;
    ordenTurnos: string[];

    contador: number;
    timer: NodeJS.Timeout | null;
}

const partidas = new Map<string, EstadoPartida>();

// ======================================================
// Helpers
// ======================================================

function crearMazo(): Carta[] {
    const palos = ['♠', '♥', '♦', '♣'];
    const valores = [
        'A', '2', '3', '4', '5',
        '6', '7', '8', '9', '10',
        'J', 'Q', 'K'
    ];

    const mazo: Carta[] = [];

    for (const palo of palos) {
        for (const valor of valores) {
            mazo.push({ valor, palo });
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

        if (carta.valor === 'A') {
            ases++;
            puntos += 11;
        }

        else if (['J', 'Q', 'K'].includes(carta.valor)) {
            puntos += 10;
        }

        else {
            puntos += parseInt(carta.valor);
        }
    }

    while (puntos > 21 && ases > 0) {
        puntos -= 10;
        ases--;
    }

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

            contador: 0,
            timer: null,
        });
    }

    return partidas.get(lobbyId)!;
}

function estadoPublico(
    estado: EstadoPartida,
    mostrarDealerCompleto = false
) {

    return {

        lobbyId: estado.lobbyId,

        manoDealer: mostrarDealerCompleto
            ? estado.manoDealer
            : estado.manoDealer.length > 0
                ? [estado.manoDealer[0], { valor: '?', palo: '' }]
                : [],

        puntosDealer: mostrarDealerCompleto
            ? estado.puntosDealer
            : null,

        dealerTerminado: estado.dealerTerminado,

        rondaActiva: estado.rondaActiva,

        turnoActual: estado.turnoActual,

        contador: estado.contador,

        jugadores: Array.from(
            estado.jugadores.values()
        ).map(j => ({

            userId: j.userId,
            username: j.username,
            socketId: j.socketId,

            mano:
                (!j.participando || j.enEspera)
                    ? []
                    : j.mano,

            puntos:
                (!j.participando || j.enEspera)
                    ? 0
                    : j.puntos,

            terminado: j.terminado,
            enEspera: j.enEspera,
            participando: j.participando,
        })),
    };
}

// ======================================================
// Turnos
// ======================================================

function avanzarTurno(
    io: IOServer,
    estado: EstadoPartida,
    room: string
): void {

    const jugadoresActivos = estado.ordenTurnos.filter(sid => {

        const j = estado.jugadores.get(sid);

        return (
            j &&
            j.participando &&
            !j.terminado &&
            !j.enEspera
        );
    });

    if (jugadoresActivos.length === 0) {
        verificarFinRonda(io, estado, room);
        return;
    }

    const idxActual = estado.turnoActual
        ? jugadoresActivos.indexOf(estado.turnoActual)
        : -1;

    const siguiente = jugadoresActivos[idxActual + 1] ?? null;

    if (siguiente) {

        estado.turnoActual = siguiente;

        io.to(room).emit(
            'bj:estadoActualizado',
            estadoPublico(estado, false)
        );

        io.to(siguiente).emit('bj:tuTurno');

    } else {

        verificarFinRonda(io, estado, room);
    }
}

// ======================================================
// Iniciar ronda
// ======================================================

function iniciarRonda(
    io: IOServer,
    estado: EstadoPartida
): void {

    const room = `blackjack:${estado.lobbyId}`;

    estado.manoDealer = [];
    estado.puntosDealer = 0;
    estado.dealerTerminado = false;

    estado.rondaActiva = true;

    estado.turnoActual = null;
    estado.ordenTurnos = [];

    // Reiniciar jugadores
    for (const [sid, jugador] of estado.jugadores.entries()) {

        jugador.enEspera = false;

        jugador.mano = [];
        jugador.puntos = 0;

        jugador.terminado = false;

        if (
            jugador.participando &&
            !jugador.enEspera
        ) {
            estado.ordenTurnos.push(sid);
        }
    }

    // Si nadie apostó
    if (estado.ordenTurnos.length === 0) {

        estado.rondaActiva = false;

        io.to(room).emit(
            'bj:estadoActualizado',
            estadoPublico(estado, false)
        );

        return;
    }

    // Dealer
    estado.manoDealer.push(
        pedirCarta(estado),
        pedirCarta(estado)
    );

    estado.puntosDealer = evaluarMano(
        estado.manoDealer
    );

    // Jugadores
    for (const jugador of estado.jugadores.values()) {

        if (
            !jugador.participando ||
            jugador.enEspera
        ) {
            continue;
        }

        jugador.mano.push(
            pedirCarta(estado),
            pedirCarta(estado)
        );

        jugador.puntos = evaluarMano(
            jugador.mano
        );
    }

    // Primer turno
    estado.turnoActual =
        estado.ordenTurnos[0] ?? null;

    io.to(room).emit(
        'bj:estadoActualizado',
        estadoPublico(estado, false)
    );

    if (estado.turnoActual) {
        io.to(estado.turnoActual)
            .emit('bj:tuTurno');
    }

    console.log(
        `[bj] Ronda iniciada en ${estado.lobbyId}`
    );
}

// ======================================================
// Socket
// ======================================================

export function registerBlackjackSocket(
    io: IOServer,
    socket: Socket
): void {

    const room = () =>
        `blackjack:${socket.data.lobbyId}`;

    // ==================================================
    // UNIRSE
    // ==================================================

    socket.on(
        'bj:unirse',
        (payload: {
            lobbyId: string;
            userId: string;
            username: string;
        }) => {

            if (
                !payload?.lobbyId ||
                !payload?.userId
            ) return;

            socket.data.lobbyId = payload.lobbyId;
            socket.data.userId = payload.userId;
            socket.data.username = payload.username;

            socket.join(
                `blackjack:${payload.lobbyId}`
            );

            const estado =
                obtenerOCrearPartida(
                    payload.lobbyId
                );

            const enEspera =
                estado.rondaActiva;

            const jugadorExistente =
                Array.from(
                    estado.jugadores.values()
                ).find(
                    j => j.userId === payload.userId
                );

            if (jugadorExistente) {

                const socketViejo =
                    jugadorExistente.socketId;

                estado.jugadores.delete(
                    socketViejo
                );

                const idx =
                    estado.ordenTurnos.indexOf(
                        socketViejo
                    );

                if (idx !== -1) {
                    estado.ordenTurnos[idx] =
                        socket.id;
                }

                if (
                    estado.turnoActual === socketViejo
                ) {
                    estado.turnoActual =
                        socket.id;
                }

                jugadorExistente.socketId =
                    socket.id;

                estado.jugadores.set(
                    socket.id,
                    jugadorExistente
                );

                socket.emit(
                    'bj:reconectado',
                    {
                        enEspera:
                            jugadorExistente.enEspera
                    }
                );

            } else {

                estado.jugadores.set(socket.id, {

                    userId: payload.userId,
                    username: payload.username,
                    socketId: socket.id,

                    mano: [],
                    puntos: 0,

                    terminado: false,

                    enEspera,
                    participando: false,
                });
            }

            io.to(room()).emit(
                'bj:estadoActualizado',
                estadoPublico(estado, false)
            );
        }
    );

    // ==================================================
    // ABRIR APUESTAS
    // ==================================================

    socket.on('bj:abrirApuestas', () => {

        const lobbyId =
            socket.data.lobbyId as string;

        if (!lobbyId) return;

        const estado = partidas.get(lobbyId);

        if (!estado) return;

        if (estado.rondaActiva) return;

        if (estado.timer) return;

        estado.contador = 10;

        io.to(room()).emit(
            'bj:contador',
            {
                segundos: estado.contador
            }
        );

        estado.timer = setInterval(() => {

            estado.contador--;

            io.to(room()).emit(
                'bj:contador',
                {
                    segundos: estado.contador
                }
            );

            if (estado.contador <= 0) {

                clearInterval(estado.timer!);

                estado.timer = null;

                iniciarRonda(io, estado);
            }

        }, 1000);
    });

    // ==================================================
    // APOSTAR
    // ==================================================

    socket.on(
        'bj:apostar',
        (data: { cantidad: number }) => {

            const lobbyId =
                socket.data.lobbyId as
                    | string
                    | undefined;

            if (!lobbyId) return;

            const estado =
                partidas.get(lobbyId);

            if (!estado) return;

            if (estado.rondaActiva) return;

            const jugador =
                estado.jugadores.get(socket.id);

            if (!jugador) return;

            jugador.participando = true;

            io.to(room()).emit(
                'bj:estadoActualizado',
                estadoPublico(estado, false)
            );
        }
    );

    // ==================================================
    // PEDIR CARTA
    // ==================================================

    socket.on('bj:pedirCarta', () => {

        const lobbyId =
            socket.data.lobbyId as
                | string
                | undefined;

        if (!lobbyId) return;

        const estado =
            partidas.get(lobbyId);

        if (!estado) return;

        if (!estado.rondaActiva) return;

        if (
            estado.turnoActual !== socket.id
        ) {

            socket.emit(
                'bj:noEsTuTurno'
            );

            return;
        }

        const jugador =
            estado.jugadores.get(socket.id);

        if (
            !jugador ||
            jugador.terminado ||
            jugador.enEspera ||
            !jugador.participando
        ) return;

        jugador.mano.push(
            pedirCarta(estado)
        );

        jugador.puntos = evaluarMano(
            jugador.mano
        );

        if (jugador.puntos > 21) {

            jugador.terminado = true;

            socket.emit(
                'bj:resultadoJugador',
                {
                    resultado: 'perdiste',
                    puntos: jugador.puntos
                }
            );

            io.to(room()).emit(
                'bj:estadoActualizado',
                estadoPublico(estado, false)
            );

            avanzarTurno(
                io,
                estado,
                room()
            );

        } else {

            io.to(room()).emit(
                'bj:estadoActualizado',
                estadoPublico(estado, false)
            );
        }
    });

    // ==================================================
    // PLANTARSE
    // ==================================================

    socket.on('bj:plantarse', () => {

        const lobbyId =
            socket.data.lobbyId as
                | string
                | undefined;

        if (!lobbyId) return;

        const estado =
            partidas.get(lobbyId);

        if (!estado) return;

        if (!estado.rondaActiva) return;

        if (
            estado.turnoActual !== socket.id
        ) {

            socket.emit(
                'bj:noEsTuTurno'
            );

            return;
        }

        const jugador =
            estado.jugadores.get(socket.id);

        if (
            !jugador ||
            jugador.terminado ||
            jugador.enEspera ||
            !jugador.participando
        ) return;

        jugador.terminado = true;

        io.to(room()).emit(
            'bj:estadoActualizado',
            estadoPublico(estado, false)
        );

        avanzarTurno(
            io,
            estado,
            room()
        );
    });

    // ==================================================
    // DESCONECTAR
    // ==================================================

    socket.on('disconnect', () => {

        const lobbyId =
            socket.data.lobbyId as
                | string
                | undefined;

        if (!lobbyId) return;

        const estado =
            partidas.get(lobbyId);

        if (!estado) return;

        estado.jugadores.delete(socket.id);

        const idx =
            estado.ordenTurnos.indexOf(
                socket.id
            );

        if (idx !== -1) {
            estado.ordenTurnos.splice(idx, 1);
        }

        if (
            estado.turnoActual === socket.id &&
            estado.rondaActiva
        ) {

            avanzarTurno(
                io,
                estado,
                room()
            );
        }

        if (
            estado.jugadores.size === 0
        ) {

            if (estado.timer) {
                clearInterval(
                    estado.timer
                );
            }

            partidas.delete(lobbyId);

        } else {

            io.to(room()).emit(
                'bj:estadoActualizado',
                estadoPublico(estado, false)
            );
        }
    });
}

// ======================================================
// FIN RONDA
// ======================================================




async function verificarFinRonda(
    io: IOServer,
    estado: EstadoPartida,
    room: string
): Promise<void> {

    const jugadoresActivos =
        Array.from(
            estado.jugadores.values()
        ).filter(
            j =>
                j.participando &&
                !j.enEspera
        );

    const todosTerminados =
        jugadoresActivos.every(
            j => j.terminado
        );

    if (!todosTerminados) return;

    // Dealer
    estado.dealerTerminado = false;

    while (
        evaluarMano(
            estado.manoDealer
        ) < 17
    ) {

        await new Promise(r =>
            setTimeout(r, 600)
        );

        estado.manoDealer.push(
            pedirCarta(estado)
        );
    }

    estado.puntosDealer =
        evaluarMano(
            estado.manoDealer
        );

    estado.dealerTerminado = true;

    estado.rondaActiva = false;

    estado.turnoActual = null;

    // Resultados
    const resultados:
        Record<string, string> = {};

    for (
        const [socketId, jugador]
        of estado.jugadores.entries()
    ) {

        if (
            jugador.enEspera ||
            !jugador.participando
        ) {
            continue;
        }

        const pJ = jugador.puntos;
        const pD = estado.puntosDealer;

        if (pJ > 21) {
            resultados[socketId] =
                'perdiste';
        }

        else if (
            pD > 21 ||
            pJ > pD
        ) {
            resultados[socketId] =
                'ganaste';
        }

        else if (pJ === pD) {
            resultados[socketId] =
                'empate';
        }

        else {
            resultados[socketId] =
                'perdiste';
        }
    }

    io.to(room).emit(
        'bj:estadoActualizado',
        estadoPublico(estado, true)
    );

    io.to(room).emit(
        'bj:finRonda',
        {
            resultados,
            puntosDealer:
                estado.puntosDealer
        }
    );

    console.log(
        `[bj] Ronda terminada en ${estado.lobbyId}`
    );

    // Reset para siguiente ronda
    for (
        const jugador
        of estado.jugadores.values()
    ) {

        jugador.enEspera = false;

        jugador.participando = false;
    }
}