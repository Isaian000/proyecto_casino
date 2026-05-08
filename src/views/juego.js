document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }
    initNavbar(); initLogout();

    const path   = window.location.pathname;
    const apiGame = path.includes('ruleta') ? 'roulette' : 'blackjack';
    const lobbyId = new URLSearchParams(window.location.search).get('mesa') || localStorage.getItem('mesaActiva');

    const $ = (id) => document.getElementById(id);
    let apuesta = 0;
    let apuestaConfirmada = 0;   // apuesta bloqueada al pulsar REPARTIR

    function actualizarDisplays(saldo) {
        if (saldo !== undefined) {
            if ($('saldo-display')) $('saldo-display').textContent = '$' + Number(saldo).toLocaleString();
            if ($('saldo-mesa'))   $('saldo-mesa').textContent   = '€' + Number(saldo).toLocaleString();
            localStorage.setItem('saldo', String(saldo));
        }
        if ($('apuesta-total')) $('apuesta-total').textContent = '€' + apuesta.toLocaleString();
    }

    // Fichas
    document.querySelectorAll('.chip--item').forEach(chip => {
        chip.addEventListener('click', () => {
            if (apiGame === 'blackjack' && BJ.rondaActiva) return;  // no cambiar apuesta durante ronda
            apuesta += parseInt(chip.dataset.valor || chip.textContent);
            actualizarDisplays();
        });
    });

    $('btn-borrar')?.addEventListener('click', () => {
        if (apiGame === 'blackjack' && BJ.rondaActiva) return;
        apuesta = 0;
        actualizarDisplays();
    });

    // ---- REPARTIR ----
    $('btn-repartir')?.addEventListener('click', async () => {
        if (apuesta <= 0) return showToast('Selecciona una apuesta', 'warn');

        if (apiGame === 'blackjack') {
            if (BJ.rondaActiva) return showToast('La ronda ya está en curso', 'warn');
            if (BJ.enEspera)    return showToast('Estás en espera. Entrarás a la próxima ronda.', 'warn');
        }

        // Descontar la apuesta del saldo vía API
        const res = await apiFetch('/api/wallet/bet', {
            method: 'POST',
            body: JSON.stringify({ amount: apuesta, game: apiGame, lobbyId }),
        });

        if (res && res.ok) {
            const data = await res.json();
            apuestaConfirmada = apuesta;
            apuesta = 0;
            actualizarDisplays(data.balance ?? data.bank);

            if (apiGame === 'blackjack') {
                BJ.iniciarRonda();
            } else {
                // Ruleta: placeholder hasta implementar RuletaEngine
                const msg = document.querySelector('.status-msg');
                if (msg) msg.innerText = 'Girando... (lógica de ruleta próximamente)';
                showToast('Apuesta registrada. Lógica de ruleta próximamente.', 'info');
            }
        } else {
            showToast('Saldo insuficiente', 'error');
        }
    });

    // ---- PEDIR (btn-doblar) ----
    $('btn-doblar')?.addEventListener('click', () => {
        if (apiGame !== 'blackjack') return showToast('Acción no disponible en Ruleta', 'warn');
        BJ.pedirCarta();
    });

    // ---- PLANTARSE (btn-atras) ----
    $('btn-atras')?.addEventListener('click', () => {
        if (apiGame !== 'blackjack') return showToast('Acción no disponible en Ruleta', 'warn');
        BJ.plantarse();
    });

    // ---- Resultado final (llamado por blackjack.js vía window._onBJFinRonda) ----
    window._onBJFinRonda = async (data) => {
        // data.resultados = { [socketId]: 'ganaste'|'perdiste'|'empate' }
        const socketId = BJ.socketId;
        const miResultado = data.resultados[socketId];
        if (!miResultado) return;   // jugador estaba en espera

        const msg = document.querySelector('.status-msg');
        const pD  = data.puntosDealer;

        if (miResultado === 'ganaste') {
            const ganancia = apuestaConfirmada * 2;
            if (msg) msg.innerText = '¡GANASTE!';
            const res = await apiFetch('/api/wallet/win', {
                method: 'POST',
                body: JSON.stringify({ amount: ganancia, game: apiGame, lobbyId }),
            });
            if (res?.ok) {
                const d = await res.json();
                actualizarDisplays(d.balance ?? d.bank);
                showToast(`¡Ganaste €${ganancia}!`, 'success');
            }
        } else if (miResultado === 'empate') {
            if (msg) msg.innerText = 'EMPATE';
            const res = await apiFetch('/api/wallet/win', {
                method: 'POST',
                body: JSON.stringify({ amount: apuestaConfirmada, game: apiGame, lobbyId }),
            });
            if (res?.ok) {
                const d = await res.json();
                actualizarDisplays(d.balance ?? d.bank);
                showToast('Empate: Apuesta devuelta', 'info');
            }
        } else {
            if (msg) msg.innerText = 'PERDISTE';
            showToast('Suerte para la próxima', 'warn');
        }

        apuestaConfirmada = 0;
        apuesta = 0;
        actualizarDisplays();
    };

    // ---- Salir de mesa ----
    $('btn-salir-confirmar')?.addEventListener('click', async () => {
        await salirDeMesaActiva();
        window.location.href = '/mesas';
    });

    // Timer de sesión
    let sec = 0;
    setInterval(() => {
        sec++;
        if ($('session-timer')) {
            const m = String(Math.floor(sec / 60)).padStart(2, '0');
            const s = String(sec % 60).padStart(2, '0');
            $('session-timer').textContent = `${m}:${s}`;
        }
    }, 1000);
});
