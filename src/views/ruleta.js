/**
 * ruleta.js — Cliente de Ruleta vía Socket.io
 *
 * Lógica real de casino:
 *  - Las fichas solo SELECCIONAN el valor; la apuesta se coloca al hacer click en una casilla.
 *  - Todos los jugadores de la mesa comparten la misma ronda.
 *  - El servidor controla el contador de apuestas (15 s), el giro y el resultado.
 *  - Durante el giro no se pueden colocar apuestas.
 *  - Si hay saldo insuficiente se ofrece ir a recargar.
 *
 * Flujo:
 *   1. Al conectar → emite ruleta:unirse
 *   2. Servidor → ruleta:estadoMesa  (fase + segundos)  → muestra countdown
 *   3. Click en casilla → acumula apuesta VISUAL (no se envía aún al servidor)
 *   4. Al cerrar apuestas (ruleta:cierreApuestas):
 *        - Si el jugador tiene apuestas pendientes → cobra via REST y envía ruleta:apostar
 *        - Bloquea el tablero
 *   5. ruleta:girando  → animación
 *   6. ruleta:resultado → muestra ganador, cobra premio via REST
 *   7. Nueva ronda automática
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── Estado local ────────────────────────────────────────────────────────
    let valorFichaSeleccionada = 5;
    const apuestasPorCasilla = new Map();   // { casillaId → monto }
    let apuestasEnviadas = false;           // true cuando ya se enviaron al servidor
    let _fase = 'apostando';               // 'apostando' | 'girando' | 'resultado'
    let _countdownInterval = null;

    const lobbyId  = new URLSearchParams(window.location.search).get('mesa') || localStorage.getItem('mesaActiva');
    const userId   = localStorage.getItem('userId')   || 'anon';
    const username = localStorage.getItem('username') || localStorage.getItem('userName') || 'Jugador';

    // ── Refs DOM ─────────────────────────────────────────────────────────────
    const statusMsg  = document.querySelector('.status-msg');
    const btnJugar   = document.getElementById('btn-doblar');
    const btnBorrar  = document.getElementById('btn-borrar');

    function setStatus(txt) { if (statusMsg) statusMsg.innerText = txt; }

    // ── Sincronizar saldo inicial ─────────────────────────────────────────
    if (typeof window.actualizarDisplaysGlobal === 'function') {
        window.actualizarDisplaysGlobal();
    }

    // ── Selección de ficha (solo selecciona, NO suma apuesta) ─────────────
    document.querySelectorAll('.chip--item').forEach(chip => {

    chip.addEventListener('click', () => {

        document.querySelectorAll('.chip--item').forEach(c => {
            c.classList.remove('chip-selected');
        });

        chip.classList.add('chip-selected');

        valorFichaSeleccionada = parseInt(chip.dataset.valor);
    });

});

    // ── Colocar apuesta al hacer click en casilla ─────────────────────────
    const todasLasCasillas = document.querySelectorAll(
        '.section--item, .column-item, .bet-item, .casilla-0, .casilla-00'
    );

    todasLasCasillas.forEach(casilla => {
        casilla.addEventListener('click', () => {
            if (_fase !== 'apostando') return;   // bloqueado fuera de fase de apuestas
            if (apuestasEnviadas) return;         // ya se enviaron en esta ronda

            const id = casilla.id || casilla.innerText.trim();
            const anterior = apuestasPorCasilla.get(id) || 0;
            apuestasPorCasilla.set(id, anterior + valorFichaSeleccionada);

            window.apuestaTotalGlobal = (window.apuestaTotalGlobal || 0) + valorFichaSeleccionada;
            actualizarBadge(casilla, apuestasPorCasilla.get(id));
            window.actualizarDisplaysGlobal();
        });
    });

    // ── Botón Borrar ──────────────────────────────────────────────────────
    if (btnBorrar) {
        btnBorrar.addEventListener('click', () => {
            if (_fase !== 'apostando' || apuestasEnviadas) return;
            limpiarApuestasVisuales();
        });
    }

    // ── Botón Jugar (confirmar apuesta manualmente antes de que cierre) ───
    if (btnJugar) {
        btnJugar.addEventListener('click', async () => {
            if (_fase !== 'apostando') return;
            if (apuestasEnviadas) {
                setStatus('Ya confirmaste tu apuesta, espera el giro');
                return;
            }
            await confirmarApuesta();
        });
    }

    // ── Confirmar y enviar apuesta al servidor ────────────────────────────
    async function confirmarApuesta() {
        const totalApostar = window.apuestaTotalGlobal || 0;
        if (totalApostar <= 0) {
            showToast('Coloca una apuesta antes de girar', 'warn');
            return;
        }

        // Cobrar a la wallet
        const resBet = await apiFetch('/api/wallet/bet', {
            method: 'POST',
            body: JSON.stringify({ amount: totalApostar, game: 'roulette', lobbyId }),
        });

        if (!resBet) return;   // apiFetch ya redirige si 401

        if (!resBet.ok) {
            const saldo = parseFloat(localStorage.getItem('saldo') || '0');
            if (saldo < totalApostar) {
                // Sugerir recargar saldo (igual que blackjack)
                const ir = confirm(
                    `Saldo insuficiente.\n\nTu saldo: $${saldo.toLocaleString()}\nApuesta: $${totalApostar.toLocaleString()}\n\n¿Quieres ir a recargar saldo?`
                );
                if (ir) window.location.href = '/perfil';
            } else {
                showToast('Error al procesar la apuesta', 'error');
            }
            return;
        }

        const dataBet = await resBet.json();
        window.actualizarDisplaysGlobal(dataBet.balance ?? dataBet.bank);

        // Construir objeto de apuestas y enviar al servidor
        const apuestasObj = {};
        apuestasPorCasilla.forEach((monto, id) => { apuestasObj[id] = monto; });

        if (window.casinoSocket) {
            window.casinoSocket.emit('ruleta:apostar', {
                lobbyId,
                userId,
                username,
                apuestas: apuestasObj,
            });
        }

        apuestasEnviadas = true;
        setStatus('¡Apuesta confirmada! Esperando el giro...');
        showToast('Apuesta registrada', 'success');
    }

    // ── Helpers de UI ─────────────────────────────────────────────────────
    function actualizarBadge(elemento, monto) {
        let badge = elemento.querySelector('.chip-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'chip-badge';
            badge.style.cssText = [
                'position:absolute','top:50%','left:50%',
                'transform:translate(-50%,-50%)',
                'background:gold','color:black','border-radius:50%',
                'width:22px','height:22px','font-size:10px',
                'font-weight:bold','display:flex','align-items:center',
                'justify-content:center','border:1px solid black','z-index:10',
                'pointer-events:none',
            ].join(';');
            elemento.style.position = 'relative';
            elemento.appendChild(badge);
        }
        badge.innerText = monto >= 1000 ? (monto / 1000).toFixed(1) + 'k' : monto;
    }

    function limpiarApuestasVisuales() {
        apuestasPorCasilla.clear();
        window.apuestaTotalGlobal = 0;
        document.querySelectorAll('.chip-badge').forEach(b => b.remove());
        window.actualizarDisplaysGlobal();
    }

    function bloquearTablero(bloquear) {
        todasLasCasillas.forEach(c => {
            c.style.pointerEvents = bloquear ? 'none' : '';
            c.style.opacity       = bloquear ? '0.6' : '';
        });
        if (btnJugar)  btnJugar.disabled  = bloquear;
        if (btnBorrar) btnBorrar.disabled = bloquear;
    }

    function resaltarGanador(ganador) {
        // Quitar resaltados anteriores
        document.querySelectorAll('.casilla-ganadora').forEach(el => {
            el.classList.remove('casilla-ganadora');
            el.style.outline = '';
        });

        const el = document.getElementById('item-' + ganador)
            || (ganador === '0'  ? document.querySelector('.casilla-0')  : null)
            || (ganador === '00' ? document.querySelector('.casilla-00') : null);

        if (el) {
            el.style.outline = '3px solid gold';
            el.classList.add('casilla-ganadora');
            setTimeout(() => {
                el.style.outline = '';
                el.classList.remove('casilla-ganadora');
            }, 4500);
        }
    }

    // ── Contador visual ───────────────────────────────────────────────────
function iniciarContador(segundos) {
    if (_countdownInterval) clearInterval(_countdownInterval);

    const overlay = document.getElementById('ruleta-countdown-overlay');
    const numero  = document.getElementById('ruleta-countdown-num');

    let seg = segundos;

    overlay.classList.remove('oculto');
    numero.textContent = seg;

    _countdownInterval = setInterval(() => {
        seg--;

        numero.textContent = seg;

        // efecto punch
        numero.style.animation = 'none';
        numero.offsetHeight;
        numero.style.animation = 'countdownPulse 0.5s ease';

        if (seg <= 0) {
            clearInterval(_countdownInterval);
            _countdownInterval = null;

            overlay.classList.add('oculto');
        }
    }, 1000);
}

function actualizarContadorDOM(seg) {
    const overlay = document.getElementById('ruleta-countdown-overlay');
    const numero  = document.getElementById('ruleta-countdown-num');

    if (!overlay || !numero) return;

    if (seg > 0) {
        overlay.classList.remove('oculto');
        numero.textContent = seg;
    } else {
        overlay.classList.add('oculto');
    }
}

    // ── Conexión de eventos de socket ─────────────────────────────────────
    function conectarEventosSocket() {
        const socket = window.casinoSocket;
        if (!socket) return;

        // Unirse a la mesa de ruleta para sincronizar estado
        socket.emit('ruleta:unirse', { lobbyId, userId, username });

        // Estado de la mesa (fase + segundos restantes)
        socket.on('ruleta:estadoMesa', (data) => {
            _fase = data.fase;

            if (data.fase === 'apostando') {
                bloquearTablero(false);
                iniciarContador(data.segundosRestantes);
                if (!apuestasEnviadas) {
                    setStatus('Haga sus apuestas, por favor');
                }
            }
        });

        // Cierre de apuestas — intentar enviar automáticamente si hay apuestas pendientes
        socket.on('ruleta:cierreApuestas', async () => {
            _fase = 'girando';
            bloquearTablero(true);
            if (_countdownInterval) { clearInterval(_countdownInterval); _countdownInterval = null; }
            actualizarContadorDOM(0);

            // Si el jugador tiene apuestas sin confirmar, confirmarlas ahora
            if (!apuestasEnviadas && (window.apuestaTotalGlobal || 0) > 0) {
                await confirmarApuesta();
            }
        });

        // Ruleta girando
        socket.on('ruleta:girando', () => {
            _fase = 'girando';
            bloquearTablero(true);
            setStatus('🎡 ¡Girando!');
        });

        // Resultado
        socket.on('ruleta:resultado', async (data) => {
            _fase = 'resultado';
            const ganador    = data.ganador;
            const premioTotal = (data.premios && data.premios[socket.id]) || 0;

            resaltarGanador(ganador);
            setStatus('Cayó en: ' + ganador);

            if (apuestasEnviadas && premioTotal > 0) {
                const resWin = await apiFetch('/api/wallet/win', {
                    method: 'POST',
                    body: JSON.stringify({ amount: premioTotal, game: 'roulette', lobbyId }),
                });
                if (resWin && resWin.ok) {
                    const d = await resWin.json();
                    window.actualizarDisplaysGlobal(d.balance ?? d.bank);
                    showToast('¡Ganaste $' + premioTotal.toLocaleString() + '!', 'success');
                }
            } else if (apuestasEnviadas) {
                showToast('Suerte para la próxima', 'info');
            }

            // Limpiar para la siguiente ronda
            limpiarApuestasVisuales();
            apuestasEnviadas = false;
        });

        // Error del servidor
        socket.on('ruleta:error', (data) => {
            showToast((data && data.msg) || 'Error en el servidor', 'error');
        });
    }

    // El socket puede no estar listo aún (socket-client.js carga asíncrono)
    if (window.casinoSocket) {
        conectarEventosSocket();
    } else {
        window.addEventListener('casinoSocketReady', conectarEventosSocket, { once: true });
    }

    // Exponer limpieza para juego.js (btn-borrar global)
    window.limpiarApuestasVisuales = limpiarApuestasVisuales;
});

