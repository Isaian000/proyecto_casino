/**
 * blackjack.js  — Motor CLIENT-SIDE de Blackjack via Socket.io
 *
 * Ya NO mantiene un estado propio de cartas. Toda la lógica vive en el
 * servidor (blackjack.socket.ts). Este archivo:
 *   1. Se conecta al socket ya iniciado por socket-client.js (window.casinoSocket)
 *   2. Emite eventos bj:* al servidor
 *   3. Recibe el estado actualizado y actualiza el DOM
 *   4. Gestiona la sala de espera y los turnos
 *
 * API pública (usada por juego.js):
 *   BJ.iniciarRonda()   -> emite bj:iniciarRonda
 *   BJ.pedirCarta()     -> emite bj:pedirCarta
 *   BJ.plantarse()      -> emite bj:plantarse
 *   BJ.esMiTurno()      -> boolean
 *   BJ.rondaActiva      -> boolean
 */

window.BJ = (function () {
    let _socket = null;
    let _lobbyId = null;
    let _userId = null;
    let _username = null;
    let _esMiTurno = false;
    let _rondaActiva = false;
    let _socketId = null;
    let _enEspera = false;

    // ---- helpers DOM ----
    const $ = (id) => document.getElementById(id);

    function renderizarMano(mano, puntosElem, secElem, ocultarSegunda = false) {
        if (!puntosElem || !secElem) return;
        if (!mano || mano.length === 0) {
            puntosElem.innerText = '0';
            secElem.innerText = 'Esperando...';
            return;
        }
        if (ocultarSegunda && mano.length >= 2) {
            puntosElem.innerText = '?';
            secElem.innerText = `${mano[0].valor}${mano[0].palo}, [?]`;
        } else {
            const pts = evaluarManoLocal(mano);
            puntosElem.innerText = pts;
            secElem.innerText = mano.map(c => `${c.valor}${c.palo}`).join(', ');
        }
    }

    // Evaluación local solo para mostrar puntos al jugador de su propia mano
    function evaluarManoLocal(mano) {
        let puntos = 0, ases = 0;
        for (const c of mano) {
            if (c.valor === 'A') { ases++; puntos += 11; }
            else if (['J', 'Q', 'K'].includes(c.valor)) puntos += 10;
            else puntos += parseInt(c.valor);
        }
        while (puntos > 21 && ases > 0) { puntos -= 10; ases--; }
        return puntos;
    }

    function actualizarBotones() {
        const btnRepartir = $('btn-repartir');
        const btnDoblar   = $('btn-doblar');
        const btnAtras    = $('btn-atras');

        if (!btnRepartir) return;

        if (_enEspera) {
            btnRepartir.disabled = true;
            if (btnDoblar)  btnDoblar.disabled = true;
            if (btnAtras)   btnAtras.disabled  = true;
            return;
        }

        if (!_rondaActiva) {
            // Entre rondas: solo REPARTIR disponible
            btnRepartir.disabled = false;
            if (btnDoblar)  btnDoblar.disabled  = true;
            if (btnAtras)   btnAtras.disabled   = true;
        } else {
            // Ronda activa: REPARTIR bloqueado, acciones solo si es mi turno
            btnRepartir.disabled = true;
            if (btnDoblar)  btnDoblar.disabled  = !_esMiTurno;
            if (btnAtras)   btnAtras.disabled   = !_esMiTurno;
        }
    }

    function mostrarStatusMsg(texto) {
        const msg = document.querySelector('.status-msg');
        if (msg) msg.innerText = texto;
    }

    function actualizarPanelJugadores(jugadores) {
        let panel = $('panel-jugadores');
        if (!panel) return;

        panel.innerHTML = '';
        for (const j of jugadores) {
            const div = document.createElement('div');
            div.className = 'jugador-fila' + (j.socketId === _socketId ? ' yo' : '') + (j.enEspera ? ' en-espera' : '');
            const manoStr = j.enEspera ? '(en espera)' : (j.mano.map(c => `${c.valor}${c.palo}`).join(', ') || '...');
            div.innerHTML = `<span class="j-nombre">${j.username}${j.enEspera ? ' ⏳' : ''}</span>
                             <span class="j-mano">${manoStr}</span>
                             <span class="j-pts">${j.enEspera ? '-' : j.puntos}</span>`;
            panel.appendChild(div);
        }
    }

    // ---- Manejo del estado recibido del servidor ----
    function onEstadoActualizado(estado) {
        _rondaActiva    = estado.rondaActiva;
        _socketId       = _socket ? _socket.id : _socketId;
        _esMiTurno      = estado.turnoActual === _socketId;

        // Buscar mi estado
        const yo = estado.jugadores.find(j => j.socketId === _socketId);
        _enEspera = yo ? yo.enEspera : false;

        // Dealer
        const ocultarDealer = _rondaActiva && !estado.dealerTerminado;
        renderizarMano(estado.manoDealer, $('puntos-dealer'), $('secuencia-dealer'), ocultarDealer);

        // Jugador propio
        if (yo && !yo.enEspera) {
            renderizarMano(yo.mano, $('puntos-jugador'), $('secuencia-jugador'), false);
        }

        // Panel de jugadores en mesa
        actualizarPanelJugadores(estado.jugadores);
        actualizarBotones();

        // Status message
        if (_enEspera) {
            mostrarStatusMsg('Ronda en curso. Entrarás a la siguiente.');
        } else if (!_rondaActiva) {
            mostrarStatusMsg('Haga sus apuestas, por favor');
        } else if (_esMiTurno) {
            mostrarStatusMsg('¡Es tu turno!');
        } else {
            const turnoJ = estado.jugadores.find(j => j.socketId === estado.turnoActual);
            mostrarStatusMsg(turnoJ ? `Turno de ${turnoJ.username}...` : 'Esperando...');
        }
    }

    function init() {
        const params  = new URLSearchParams(window.location.search);
        _lobbyId  = params.get('mesa') || localStorage.getItem('mesaActiva');
        _userId   = localStorage.getItem('userId') || 'anon';
        _username = localStorage.getItem('username') || localStorage.getItem('userName') || 'Jugador';

        // Esperar a que socket-client.js cree window.casinoSocket
        const tryConnect = setInterval(() => {
            if (window.casinoSocket) {
                clearInterval(tryConnect);
                _socket = window.casinoSocket;
                _socketId = _socket.id;
                bindSocketEvents();
                // Unirse a la sala de blackjack
                _socket.emit('bj:unirse', { lobbyId: _lobbyId, userId: _userId, username: _username });
            }
        }, 100);
    }

    function bindSocketEvents() {
        _socket.on('bj:estadoActualizado', onEstadoActualizado);

        _socket.on('bj:tuTurno', () => {
            _esMiTurno = true;
            actualizarBotones();
            mostrarStatusMsg('¡Es tu turno!');
            if (typeof showToast === 'function') showToast('¡Tu turno!', 'success');
        });

        _socket.on('bj:noEsTuTurno', () => {
            if (typeof showToast === 'function') showToast('Espera tu turno', 'warn');
        });

        _socket.on('bj:enEspera', (data) => {
            _enEspera = true;
            actualizarBotones();
            mostrarStatusMsg(data.mensaje || 'Esperando próxima ronda...');
            if (typeof showToast === 'function') showToast(data.mensaje || 'En espera', 'info');
        });

        _socket.on('bj:reconectado', (data) => {
            _enEspera = data.enEspera;
            actualizarBotones();
        });

        _socket.on('bj:resultadoJugador', (data) => {
            // Resultado parcial (solo cuando el jugador se pasó de 21 antes de que acabe la ronda)
            if (data.resultado === 'perdiste') {
                mostrarStatusMsg(`¡Te pasaste! (${data.puntos})`);
            }
        });

        _socket.on('bj:finRonda', (data) => {
            // El resultado final lo procesa juego.js a través de onFinRonda
            _rondaActiva = false;
            _esMiTurno   = false;
            actualizarBotones();
            if (window._onBJFinRonda) window._onBJFinRonda(data);
        });
    }

    // ---- API pública ----
    return {
        get rondaActiva()  { return _rondaActiva; },
        get esMiTurno()    { return _esMiTurno;   },
        get enEspera()     { return _enEspera;     },
        get socketId()     { return _socketId;     },

        init,

        iniciarRonda() {
            if (!_socket) return;
            if (_enEspera) {
                if (typeof showToast === 'function') showToast('Estás en espera, entrarás a la siguiente ronda', 'warn');
                return;
            }
            _socket.emit('bj:iniciarRonda', { lobbyId: _lobbyId, userId: _userId, username: _username });
        },

        pedirCarta() {
            if (!_socket || !_esMiTurno) {
                if (typeof showToast === 'function') showToast('No es tu turno', 'warn');
                return;
            }
            _socket.emit('bj:pedirCarta');
        },

        plantarse() {
            if (!_socket || !_esMiTurno) {
                if (typeof showToast === 'function') showToast('No es tu turno', 'warn');
                return;
            }
            _socket.emit('bj:plantarse');
        },
    };
})();

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BJ.init());
} else {
    BJ.init();
}
