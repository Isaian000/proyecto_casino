document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }
    initNavbar(); initLogout();

    const path = window.location.pathname;
    const apiGame = path.includes('ruleta') ? 'roulette' : 'blackjack';
    const lobbyId = new URLSearchParams(window.location.search).get('mesa') || localStorage.getItem('mesaActiva');

    const $ = (id) => document.getElementById(id);
    let apuesta = 0;

    function actualizarDisplays(saldo) {
        if (saldo !== undefined) {
            if ($('saldo-display')) $('saldo-display').textContent = '$' + Number(saldo).toLocaleString();
            if ($('saldo-mesa')) $('saldo-mesa').textContent = '€' + Number(saldo).toLocaleString();
            localStorage.setItem('saldo', String(saldo));
        }
        if ($('apuesta-total')) $('apuesta-total').textContent = '€' + apuesta.toLocaleString();
    }

    // Lógica de Fichas
    document.querySelectorAll('.chip--item').forEach(chip => {
        chip.addEventListener('click', () => {
            apuesta += parseInt(chip.dataset.valor || chip.textContent);
            actualizarDisplays();
        });
    });

    $('btn-borrar')?.addEventListener('click', () => {
        apuesta = 0;
        actualizarDisplays();
    });

    // Acción: REPARTIR (Llama a Bet API)
    $('btn-repartir')?.addEventListener('click', async () => {
        if (apuesta <= 0) return showToast('Selecciona una apuesta', 'warn');

        const res = await apiFetch('/api/wallet/bet', {
            method: 'POST',
            body: JSON.stringify({ amount: apuesta, game: apiGame, lobbyId }),
        });

        if (res && res.ok) {
            const data = await res.json();
            actualizarDisplays(data.balance ?? data.bank);
            iniciarManoBJ(); // Inicia motor en blackjack.js
        } else {
            showToast('Saldo insuficiente', 'error');
        }
    });

    $('btn-doblar')?.addEventListener('click', () => {
        if (BlackjackEngine.juegoTerminado) return;
        BlackjackEngine.manoJugador.push(BlackjackEngine.pedirCarta());
        BlackjackEngine.renderizarEstado();
        if (BlackjackEngine.evaluarMano(BlackjackEngine.manoJugador) > 21) window.finalizarJuego();
    });

    $('btn-atras')?.addEventListener('click', async () => {
        if (BlackjackEngine.juegoTerminado) return;
        await BlackjackEngine.ejecutarTurnoDealer();
        window.finalizarJuego();
    });

    // Lógica de Resultado y Win API
    window.finalizarJuego = async () => {
        BlackjackEngine.juegoTerminado = true;
        BlackjackEngine.renderizarEstado();
        
        const pJ = BlackjackEngine.evaluarMano(BlackjackEngine.manoJugador);
        const pD = BlackjackEngine.evaluarMano(BlackjackEngine.manoDealer);
        const msg = document.querySelector('.status-msg');

        if (pJ <= 21 && (pD > 21 || pJ > pD)) {
            const ganancia = apuesta * 2;
            msg.innerText = "¡GANASTE!";
            const res = await apiFetch('/api/wallet/win', {
                method: 'POST',
                body: JSON.stringify({ amount: ganancia, game: apiGame, lobbyId }),
            });
            if (res?.ok) {
                const data = await res.json();
                actualizarDisplays(data.balance ?? data.bank);
                showToast(`¡Ganaste €${ganancia}!`, 'success');
            }
        } else if (pJ === pD) {
            msg.innerText = "EMPATE ";
            // Devolvemos la apuesta original al saldo del usuario
            const res = await apiFetch('/api/wallet/win', { 
                method: 'POST', 
                body: JSON.stringify({ amount: apuesta, game: apiGame, lobbyId }) 
            });
    
            if (res?.ok) {
                const data = await res.json();
                actualizarDisplays(data.balance ?? data.bank);
                showToast('Empate: Apuesta devuelta', 'info');
            }
        } else {
            msg.innerText = "PERDISTE";
            showToast('Suerte para la próxima', 'warn');
        }
        apuesta = 0;
        actualizarDisplays();
    };

    // --- MANTENER TUS FUNCIONES DE MESA ---
    $('btn-salir-confirmar')?.addEventListener('click', async () => {
        await salirDeMesaActiva();
        window.location.href = '/mesas';
    });

    // Timer (Idéntico al tuyo)
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