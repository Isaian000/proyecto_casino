/**
 * blackjack.js  — Motor CLIENT-SIDE de Blackjack via Socket.io
 *
 * Toda la lógica vive en el servidor.
 * Este archivo:
 *   1. Se conecta al socket global (window.casinoSocket)
 *   2. Emite eventos bj:*
 *   3. Recibe estado del servidor
 *   4. Actualiza el DOM
 *   5. Maneja turnos y participación
 *
 * API pública:
 *   BJ.iniciarRonda()
 *   BJ.pedirCarta()
 *   BJ.plantarse()
 *   BJ.participar()
 *   BJ.esMiTurno
 *   BJ.rondaActiva
 */

window.BJ = (function () {

    let _socket = null;

    let _lobbyId = null;
    let _userId = null;
    let _username = null;

    let _socketId = null;

    let _esMiTurno = false;
    let _rondaActiva = false;

    let _enEspera = false;
    let _participando = false;

    // =========================================================
    // HELPERS
    // =========================================================

    const $ = (id) => document.getElementById(id);

    function evaluarManoLocal(mano) {

        let puntos = 0;
        let ases = 0;

        for (const c of mano) {

            if (c.valor === 'A') {
                ases++;
                puntos += 11;
            }
            else if (['J', 'Q', 'K'].includes(c.valor)) {
                puntos += 10;
            }
            else {
                puntos += parseInt(c.valor);
            }
        }

        while (puntos > 21 && ases > 0) {
            puntos -= 10;
            ases--;
        }

        return puntos;
    }

    function mostrarStatusMsg(texto) {

        const msg = document.querySelector('.status-msg');

        if (msg) {
            msg.innerText = texto;
        }
    }

    function renderizarMano(
        mano,
        puntosElem,
        secElem,
        ocultarSegunda = false
    ) {

        if (!puntosElem || !secElem) return;

        if (!mano || mano.length === 0) {

            puntosElem.innerText = '0';
            secElem.innerText = 'Esperando...';
            return;
        }

        if (ocultarSegunda && mano.length >= 2) {

            puntosElem.innerText = '?';

            secElem.innerText =
                `${mano[0].valor}${mano[0].palo}, [?]`;

            return;
        }

        const pts = evaluarManoLocal(mano);

        puntosElem.innerText = pts;

        secElem.innerText =
            mano.map(c => `${c.valor}${c.palo}`).join(', ');
    }

    // =========================================================
    // BOTONES
    // =========================================================

    function actualizarBotones() {

        const btnRepartir = $('btn-repartir');
        const btnDoblar = $('btn-doblar');
        const btnAtras = $('btn-atras');

        if (!btnRepartir) return;

        if (_enEspera) {

            btnRepartir.disabled = true;

            if (btnDoblar) {
                btnDoblar.disabled = true;
            }

            if (btnAtras) {
                btnAtras.disabled = true;
            }

            return;
        }

        if (!_rondaActiva) {

            btnRepartir.disabled = false;

            if (btnDoblar) {
                btnDoblar.disabled = true;
            }

            if (btnAtras) {
                btnAtras.disabled = true;
            }

            return;
        }

        btnRepartir.disabled = true;

        const puedeJugar =
            _participando &&
            _esMiTurno;

        if (btnDoblar) {
            btnDoblar.disabled = !puedeJugar;
        }

        if (btnAtras) {
            btnAtras.disabled = !puedeJugar;
        }
    }

    // =========================================================
    // PANEL DE JUGADORES
    // =========================================================

    function actualizarPanelJugadores(jugadores) {

        const panel = $('panel-jugadores');

        if (!panel) return;

        panel.innerHTML = '';

        for (const j of jugadores) {

            const div = document.createElement('div');

            let clases = 'jugador-fila';

            if (j.socketId === _socketId) {
                clases += ' yo';
            }

            if (j.enEspera) {
                clases += ' en-espera';
            }

            if (j.participando) {
                clases += ' participando';
            }

            div.className = clases;

            let manoStr = '...';

            if (j.enEspera) {
                manoStr = '(en espera)';
            }
            else if (!j.participando) {
                manoStr = '(sin apostar)';
            }
            else if (j.mano?.length > 0) {
                manoStr =
                    j.mano
                        .map(c => `${c.valor}${c.palo}`)
                        .join(', ');
            }

            const puntos =
                (!j.participando || j.enEspera)
                    ? '-'
                    : j.puntos;

            div.innerHTML = `
                <span class="j-nombre">
                    ${j.username}
                    ${j.enEspera ? ' ⏳' : ''}
                </span>
                <span class="j-mano">
                    ${manoStr}
                </span>
                <span class="j-pts">
                    ${puntos}
                </span>
            `;

            panel.appendChild(div);
        }
    }

    // =========================================================
    // ESTADO DESDE EL SERVIDOR
    // =========================================================

    function onEstadoActualizado(estado) {

        _rondaActiva = estado.rondaActiva;

        _socketId =
            _socket
                ? _socket.id
                : _socketId;

        _esMiTurno =
            estado.turnoActual === _socketId;

        const yo =
            estado.jugadores.find(
                j => j.socketId === _socketId
            );

        if (yo) {
            _enEspera = yo.enEspera;
            _participando = yo.participando;
        }

        const ocultarDealer =
            _rondaActiva &&
            !estado.dealerTerminado;

        renderizarMano(
            estado.manoDealer,
            $('puntos-dealer'),
            $('secuencia-dealer'),
            ocultarDealer
        );

        if (yo && yo.participando && !yo.enEspera) {

            renderizarMano(
                yo.mano,
                $('puntos-jugador'),
                $('secuencia-jugador'),
                false
            );
        }
        else {

            renderizarMano(
                [],
                $('puntos-jugador'),
                $('secuencia-jugador'),
                false
            );
        }

        actualizarPanelJugadores(estado.jugadores);
        actualizarBotones();

        if (_enEspera) {
            mostrarStatusMsg('Ronda en curso. Entrarás a la siguiente.');
            return;
        }

        if (!_participando && !_rondaActiva) {
            mostrarStatusMsg('Haz click en REPARTIR para participar');
            return;
        }

        if (!_rondaActiva) {
            mostrarStatusMsg('Esperando nueva ronda...');
            return;
        }

        if (_esMiTurno) {
            mostrarStatusMsg('¡Es tu turno!');
            return;
        }

        const turnoJ =
            estado.jugadores.find(
                j => j.socketId === estado.turnoActual
            );

        mostrarStatusMsg(
            turnoJ
                ? `Turno de ${turnoJ.username}...`
                : 'Esperando...'
        );
    }

    // =========================================================
    // SOCKET EVENTS
    // =========================================================

    function bindSocketEvents() {

        _socket.on('bj:estadoActualizado', onEstadoActualizado);

        _socket.on('bj:tuTurno', () => {

            _esMiTurno = true;
            actualizarBotones();
            mostrarStatusMsg('¡Es tu turno!');

            if (typeof showToast === 'function') {
                showToast('¡Tu turno!', 'success');
            }
        });

        _socket.on('bj:noEsTuTurno', () => {

            if (typeof showToast === 'function') {
                showToast('No es tu turno', 'warn');
            }
        });

        _socket.on('bj:enEspera', (data) => {

            _enEspera = true;
            actualizarBotones();
            mostrarStatusMsg(data.mensaje || 'Esperando próxima ronda...');

            if (typeof showToast === 'function') {
                showToast(data.mensaje || 'En espera', 'info');
            }
        });

        _socket.on('bj:reconectado', (data) => {

            _enEspera = data.enEspera;
            actualizarBotones();
        });

        _socket.on('bj:resultadoJugador', (data) => {

            if (data.resultado === 'perdiste') {
                mostrarStatusMsg(`¡Te pasaste! (${data.puntos})`);
            }
        });

        _socket.on('bj:finRonda', (data) => {

            _rondaActiva = false;
            _esMiTurno = false;
            _participando = false;
            actualizarBotones();

            // Asegurar socketId actualizado
            if (_socket && _socket.id) _socketId = _socket.id;

            // Notificar a juego.js (maneja cobro/pago)
            if (window._onBJFinRonda) {
                window._onBJFinRonda(data);
            }

            // Mostrar resultado visual
            if (!data.resultados) return;

            const miResultado = data.resultados[_socketId];
            if (!miResultado) return;

            mostrarResultadoCentro(
                miResultado === 'ganaste' ? '¡GANASTE!' :
                miResultado === 'perdiste' ? 'PERDISTE' :
                'EMPATE'
            );

            const overlay = document.getElementById('resultado-overlay');
            const msg = document.getElementById('resultado-msg');

            if (overlay && msg) {
                msg.className = '';
                msg.innerText =
                    miResultado === 'ganaste' ? '¡GANASTE!' :
                    miResultado === 'perdiste' ? 'PERDISTE' :
                    'EMPATE';
                msg.classList.add(miResultado);
                overlay.classList.remove('oculto');
                setTimeout(() => overlay.classList.add('oculto'), 3000);
            }
        });

        _socket.on('bj:contador', (data) => {

            mostrarStatusMsg(`La ronda inicia en ${data.segundos}s`);

            const contadorEl = document.getElementById('bj-contador');
            const numeroEl = document.getElementById('bj-contador-numero');

            if (!contadorEl || !numeroEl) return;

            numeroEl.innerText = data.segundos;

            if (data.segundos > 0) {
                contadorEl.style.display = 'flex';
            }

            if (data.segundos <= 5) {
                contadorEl.classList.add('critico');
            } else {
                contadorEl.classList.remove('critico');
            }

            if (data.segundos <= 0) {
                contadorEl.style.display = 'none';
                mostrarResultadoCentro('REPARTIENDO...');
            }
        });
    }

    // =========================================================
    // INIT
    // =========================================================

    function init() {

        const params = new URLSearchParams(window.location.search);

        _lobbyId =
            params.get('mesa') ||
            localStorage.getItem('mesaActiva');

        _userId =
            localStorage.getItem('userId') ||
            'anon';

        _username =
            localStorage.getItem('username') ||
            localStorage.getItem('userName') ||
            'Jugador';

        const tryConnect = setInterval(() => {

            if (!window.casinoSocket) return;

            clearInterval(tryConnect);

            _socket = window.casinoSocket;
            _socketId = _socket.id;

            bindSocketEvents();

            _socket.emit('bj:unirse', {
                lobbyId: _lobbyId,
                userId: _userId,
                username: _username
            });

        }, 100);
    }

    // =========================================================
    // API PUBLICA
    // =========================================================

    return {

        get rondaActiva() { return _rondaActiva; },
        get esMiTurno()   { return _esMiTurno;   },
        get enEspera()    { return _enEspera;     },
        get socketId()    { return _socketId;     },

        init,

        iniciarRonda() {

            if (!_socket) return;

            if (_enEspera) {
                if (typeof showToast === 'function') {
                    showToast('Estás en espera', 'warn');
                }
                return;
            }

            _participando = true;

            _socket.emit('bj:apostar', { cantidad: 100 });
            _socket.emit('bj:abrirApuestas');
        },

        pedirCarta() {

            if (!_socket) return;

            if (!_esMiTurno) {
                if (typeof showToast === 'function') {
                    showToast('No es tu turno', 'warn');
                }
                return;
            }

            _socket.emit('bj:pedirCarta');
        },

        plantarse() {

            if (!_socket) return;

            if (!_esMiTurno) {
                if (typeof showToast === 'function') {
                    showToast('No es tu turno', 'warn');
                }
                return;
            }

            _socket.emit('bj:plantarse');
        },
    };

})();

// =========================================================
// MOSTRAR RESULTADO CENTRO
// =========================================================

function mostrarResultadoCentro(texto) {

    const contadorEl = document.getElementById('bj-contador');
    const numeroEl = document.getElementById('bj-contador-numero');
    const labelEl = document.querySelector('.bj-contador-label');

    if (!contadorEl || !numeroEl || !labelEl) return;

    numeroEl.style.display = 'none';
    labelEl.innerText = texto;
    labelEl.style.fontSize = '22px';
    contadorEl.classList.remove('critico');
    contadorEl.style.display = 'flex';

    setTimeout(() => {
        contadorEl.style.display = 'none';
        numeroEl.style.display = 'block';
        labelEl.innerText = 'apuestas';
        labelEl.style.fontSize = '15px';
    }, 1800);
}

// =========================================================
// AUTO INIT
// =========================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BJ.init());
} else {
    BJ.init();
}