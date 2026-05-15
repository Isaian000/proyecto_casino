import { Server as IOServer, Socket } from 'socket.io';

/**
 * ruleta.socket.ts — Lógica completa de Ruleta Americana en el servidor.
 *
 * Flujo de una ronda (igual a una ruleta real de casino):
 *
 *   1.  Un jugador emite  ruleta:abrirApuestas  al unirse a la mesa.
 *   2.  El servidor abre una ventana de apuestas de APUESTAS_DURACION_MS ms.
 *       → emite  ruleta:estadoMesa  con fase='apostando' y cuenta regresiva.
 *   3.  Cualquier jugador en la mesa puede emitir  ruleta:apostar  mientras
 *       la fase sea 'apostando'. Las apuestas se acumulan por socketId.
 *   4.  Al expirar el contador el servidor:
 *       → emite  ruleta:cierreApuestas  (no más apuestas)
 *       → espera GIRO_DURACION_MS (animación)
 *       → genera el número ganador
 *       → emite  ruleta:resultado  a toda la sala con ganador y premios
 *   5.  Tras PAUSA_ENTRE_RONDAS_MS abre una nueva ronda automáticamente.
 *
 * Eventos escuchados del cliente:
 *   ruleta:unirse    { lobbyId, userId, username }
 *   ruleta:apostar   { lobbyId, apuestas: { [casillaId]: monto } }
 *
 * Eventos emitidos al cliente:
 *   ruleta:estadoMesa      { fase, segundosRestantes, jugadores[] }
 *   ruleta:cierreApuestas  {}
 *   ruleta:girando         {}
 *   ruleta:resultado       { ganador, premios: { [socketId]: number } }
 *   ruleta:error           { msg }
 */

// ─── Constantes de timing ───────────────────────────────────────────────────
const APUESTAS_DURACION_MS   = 15_000;   // ventana para apostar (15 s)
const GIRO_DURACION_MS       =  3_000;   // animación de giro    (3 s)
const PAUSA_ENTRE_RONDAS_MS  =  5_000;   // pausa tras resultado (5 s)

// ─── Números rojos de la ruleta americana ───────────────────────────────────
const ROJOS = new Set([1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35]);

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Fase = 'apostando' | 'girando' | 'resultado';

interface ApuestaJugador {
    socketId: string;
    userId: string;
    username: string;
    apuestas: Record<string, number>;   // { casillaId: monto }
    total: number;
}

interface EstadoMesa {
    lobbyId: string;
    fase: Fase;
    aperturaMs: number;            // timestamp en que se abrió la ronda
    apuestas: Map<string, ApuestaJugador>;   // socketId → apuestas
    timerApertura: ReturnType<typeof setTimeout> | null;
    timerCountdown: ReturnType<typeof setInterval> | null;
}

// Mapa global: lobbyId → estado
const mesas = new Map<string, EstadoMesa>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function girarRuleta(): string {
    const casillas = ['0', '00', ...Array.from({ length: 36 }, (_, i) => String(i + 1))];
    return casillas[Math.floor(Math.random() * casillas.length)];
}

function calcularPremio(casillaId: string, ganador: string, monto: number): number {
    const n      = parseInt(ganador);
    const esRojo  = ROJOS.has(n);
    const esNegro = !esRojo && ganador !== '0' && ganador !== '00';

    // Pleno (número exacto) — paga 35:1 → devuelve 36×
    if (casillaId === `item-${ganador}` || casillaId === ganador) return monto * 36;
    // Color
    if (casillaId === 'rojo'  && esRojo)  return monto * 2;
    if (casillaId === 'negro' && esNegro) return monto * 2;
    // Par / Impar
    if (casillaId === 'EVEN' && !isNaN(n) && n !== 0 && n % 2 === 0) return monto * 2;
    if (casillaId === 'ODD'  && !isNaN(n) && n !== 0 && n % 2 !== 0) return monto * 2;
    // Mitades
    if (casillaId === '1 to 18'  && n >= 1  && n <= 18) return monto * 2;
    if (casillaId === '19 to 36' && n >= 19 && n <= 36) return monto * 2;
    // Docenas — paga 2:1 → devuelve 3×
    if (casillaId === '1st 12' && n >= 1  && n <= 12) return monto * 3;
    if (casillaId === '2nd 12' && n >= 13 && n <= 24) return monto * 3;
    if (casillaId === '3rd 12' && n >= 25 && n <= 36) return monto * 3;

    return 0;
}

function obtenerOCrearMesa(lobbyId: string): EstadoMesa {
    if (!mesas.has(lobbyId)) {
        mesas.set(lobbyId, {
            lobbyId,
            fase: 'apostando',
            aperturaMs: Date.now(),
            apuestas: new Map(),
            timerApertura: null,
            timerCountdown: null,
        });
    }
    return mesas.get(lobbyId)!;
}

function segundosRestantes(mesa: EstadoMesa): number {
    if (mesa.fase !== 'apostando') return 0;
    const elapsed = Date.now() - mesa.aperturaMs;
    return Math.max(0, Math.ceil((APUESTAS_DURACION_MS - elapsed) / 1000));
}

function jugadoresEnMesa(io: IOServer, room: string): string[] {
    const sala = io.sockets.adapter.rooms.get(room);
    return sala ? [...sala] : [];
}

// ─── Ciclo de ronda ───────────────────────────────────────────────────────────

function iniciarRonda(io: IOServer, lobbyId: string): void {
    const mesa = obtenerOCrearMesa(lobbyId);
    const room = `lobby:${lobbyId}`;

    // Limpiar timers previos
    if (mesa.timerApertura)  clearTimeout(mesa.timerApertura);
    if (mesa.timerCountdown) clearInterval(mesa.timerCountdown);

    mesa.fase      = 'apostando';
    mesa.aperturaMs = Date.now();
    mesa.apuestas.clear();

    // Emitir estado inicial
    io.to(room).emit('ruleta:estadoMesa', {
        fase: 'apostando',
        segundosRestantes: Math.ceil(APUESTAS_DURACION_MS / 1000),
    });

    // Countdown cada segundo
    mesa.timerCountdown = setInterval(() => {
        const seg = segundosRestantes(mesa);
        io.to(room).emit('ruleta:estadoMesa', {
            fase: 'apostando',
            segundosRestantes: seg,
        });
        if (seg <= 0 && mesa.timerCountdown) {
            clearInterval(mesa.timerCountdown);
            mesa.timerCountdown = null;
        }
    }, 1000);

    // Al cerrar apuestas
    mesa.timerApertura = setTimeout(() => {
        cerrarApuestasYGirar(io, lobbyId);
    }, APUESTAS_DURACION_MS);

    console.log(`[ruleta] Mesa ${lobbyId}: ronda abierta (${Math.ceil(APUESTAS_DURACION_MS/1000)}s)`);
}

function cerrarApuestasYGirar(io: IOServer, lobbyId: string): void {
    const mesa = obtenerOCrearMesa(lobbyId);
    const room = `lobby:${lobbyId}`;

    if (mesa.timerCountdown) { clearInterval(mesa.timerCountdown); mesa.timerCountdown = null; }

    mesa.fase = 'girando';
    io.to(room).emit('ruleta:cierreApuestas', {});
    io.to(room).emit('ruleta:girando', {});

    console.log(`[ruleta] Mesa ${lobbyId}: girando...`);

    setTimeout(() => {
        const ganador = girarRuleta();

        // Calcular premios por socket
        const premios: Record<string, number> = {};
        mesa.apuestas.forEach((ap, sId) => {
            let total = 0;
            for (const [cId, monto] of Object.entries(ap.apuestas)) {
                if (monto > 0) total += calcularPremio(cId, ganador, monto);
            }
            premios[sId] = total;
        });

        mesa.fase = 'resultado';
        io.to(room).emit('ruleta:resultado', { ganador, premios });

        console.log(`[ruleta] Mesa ${lobbyId}: ganador=${ganador} premios=${JSON.stringify(premios)}`);

        // Nueva ronda automática tras pausa
        setTimeout(() => {
            const sala = io.sockets.adapter.rooms.get(room);
            if (sala && sala.size > 0) {
                iniciarRonda(io, lobbyId);
            } else {
                // Nadie en la sala, limpiar
                mesas.delete(lobbyId);
            }
        }, PAUSA_ENTRE_RONDAS_MS);

    }, GIRO_DURACION_MS);
}

// ─── Registro de eventos por socket ──────────────────────────────────────────

export function registerRuletaSocket(io: IOServer, socket: Socket): void {

    socket.on('ruleta:unirse', (payload: { lobbyId: string; userId: string; username: string }) => {
        if (!payload?.lobbyId) return;
        const { lobbyId } = payload;
        const room = `lobby:${lobbyId}`;

        // socket-client.js ya hace el joinLobby (join a la sala),
        // así que solo necesitamos sincronizar el estado actual al recién llegado.
        const mesa = obtenerOCrearMesa(lobbyId);

        // Si no hay ronda activa todavía, iniciar
        if (mesa.fase !== 'apostando' && mesa.fase !== 'girando') {
            iniciarRonda(io, lobbyId);
            return;
        }

        // Si ya hay ronda en curso, enviar estado actual al recién llegado
        socket.emit('ruleta:estadoMesa', {
            fase: mesa.fase,
            segundosRestantes: segundosRestantes(mesa),
        });

        // Si no había temporizador corriendo (mesa recién creada), iniciar
        if (!mesa.timerApertura) {
            iniciarRonda(io, lobbyId);
        }

        console.log(`[ruleta] ${payload.username} se unió a mesa ${lobbyId} (fase=${mesa.fase})`);
    });

    socket.on('ruleta:apostar', (payload: {
        lobbyId: string;
        userId: string;
        username: string;
        apuestas: Record<string, number>;
    }) => {
        if (!payload?.lobbyId || !payload?.apuestas) {
            socket.emit('ruleta:error', { msg: 'Payload inválido' });
            return;
        }

        const { lobbyId, userId, username, apuestas } = payload;
        const mesa = mesas.get(lobbyId);

        if (!mesa || mesa.fase !== 'apostando') {
            socket.emit('ruleta:error', { msg: 'Las apuestas ya están cerradas' });
            return;
        }

        const total = Object.values(apuestas).reduce((s, v) => s + (v > 0 ? v : 0), 0);
        if (total <= 0) {
            socket.emit('ruleta:error', { msg: 'Apuesta inválida' });
            return;
        }

        mesa.apuestas.set(socket.id, { socketId: socket.id, userId, username, apuestas, total });
        console.log(`[ruleta] ${username} apostó $${total} en mesa ${lobbyId}`);
    });

    socket.on('disconnect', () => {
        // Si el socket era el único en alguna sala de ruleta, limpiar timers
        // (el cleanup real pasa en la siguiente comprobación de iniciarRonda)
    });
}
