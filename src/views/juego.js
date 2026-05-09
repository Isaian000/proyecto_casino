document.addEventListener('DOMContentLoaded', () => {
    // Verificación de sesion del usuario
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }
    if (typeof initNavbar === 'function') initNavbar(); 
    if (typeof initLogout === 'function') initLogout();

    const path = window.location.pathname;
    const apiGame = path.includes('ruleta') ? 'roulette' : 'blackjack';
    const lobbyId = new URLSearchParams(window.location.search).get('mesa') || localStorage.getItem('mesaActiva');

    const $ = (id) => document.getElementById(id);
    
    // Variables globales para comunicacion entre archivos
    window.apuestaTotalGlobal = 0;
    let apuestaConfirmada = 0; // Para el flujo de Blackjack

    // --- Funcion de Actualizacion de Interfaz ---
    window.actualizarDisplaysGlobal = function(saldo) {
        if (saldo !== undefined) {
            // Actualizar en el navbar y en la mesa
            if ($('saldo-display')) $('saldo-display').textContent = '$' + Number(saldo).toLocaleString();
            if ($('saldo-mesa'))    $('saldo-mesa').textContent    = '€' + Number(saldo).toLocaleString();
            localStorage.setItem('saldo', String(saldo));
        }
        
        // Actualizar el monto de la apuesta actual
        if ($('apuesta-total')) {
            $('apuesta-total').textContent = '€' + window.apuestaTotalGlobal.toLocaleString();
        }
    };

    // --- Manejo de Fichas ---
    document.querySelectorAll('.chip--item').forEach(chip => {
        chip.addEventListener('click', () => {
            if (apiGame === 'blackjack' && window.BJ && window.BJ.rondaActiva) return;
            const valor = parseInt(chip.dataset.valor || chip.textContent);
            window.apuestaTotalGlobal += valor;
            window.actualizarDisplaysGlobal();
        });
    });

    // --- Botón Borrar ---
    $('btn-borrar')?.addEventListener('click', () => {
        if (apiGame === 'blackjack' && window.BJ && window.BJ.rondaActiva) return;
        
        window.apuestaTotalGlobal = 0;
        if (apiGame === 'roulette' && typeof window.limpiarApuestasVisuales === 'function') {
            window.limpiarApuestasVisuales();
        }
        window.actualizarDisplaysGlobal();
    });

    // --- Boton Principal (Repartir / Jugar) ---
    $('btn-repartir')?.addEventListener('click', async () => {
        if (window.apuestaTotalGlobal <= 0) return;

        if (apiGame === 'blackjack') {
            if (window.BJ?.rondaActiva) return;
            
            // Logica de cobro para Blackjack antes de iniciar ronda
            const res = await apiFetch('/api/wallet/bet', {
                method: 'POST',
                body: JSON.stringify({ amount: window.apuestaTotalGlobal, game: apiGame, lobbyId }),
            });

            if (res && res.ok) {
                const data = await res.json();
                apuestaConfirmada = window.apuestaTotalGlobal;
                window.apuestaTotalGlobal = 0;
                window.actualizarDisplaysGlobal(data.balance ?? data.bank);
                window.BJ.iniciarRonda();
            } else {
                if (typeof showToast === 'function') showToast('Saldo insuficiente', 'error');
            }
        }
    });

    // --- Logica de botones de blackjack ---
    $('btn-doblar')?.addEventListener('click', () => {
        if (apiGame === 'blackjack') {
            window.BJ?.pedirCarta();
        }
    });

    $('btn-atras')?.addEventListener('click', () => {
        if (apiGame === 'blackjack') {
            window.BJ?.plantarse();
        }
    });

    // --- Callback de Fin de Ronda para (Bj) ---
    window._onBJFinRonda = async (data) => {
        const socketId = window.BJ?.socketId;
        const miResultado = data.resultados[socketId];
        if (!miResultado) return;

        const msg = document.querySelector('.status-msg');
        
        if (miResultado === 'ganaste') {
            const ganancia = apuestaConfirmada * 2;
            if (msg) msg.innerText = '¡GANASTE!';
            const res = await apiFetch('/api/wallet/win', {
                method: 'POST',
                body: JSON.stringify({ amount: ganancia, game: apiGame, lobbyId }),
            });
            if (res?.ok) {
                const d = await res.json();
                window.actualizarDisplaysGlobal(d.balance ?? d.bank);
            }
        } else if (miResultado === 'empate') {
            if (msg) msg.innerText = 'EMPATE';
            const res = await apiFetch('/api/wallet/win', {
                method: 'POST',
                body: JSON.stringify({ amount: apuestaConfirmada, game: apiGame, lobbyId }),
            });
            if (res?.ok) {
                const d = await res.json();
                window.actualizarDisplaysGlobal(d.balance ?? d.bank);
            }
        } else {
            if (msg) msg.innerText = 'PERDISTE';
        }

        apuestaConfirmada = 0;
        window.apuestaTotalGlobal = 0;
        window.actualizarDisplaysGlobal();
    };

    // salir de la mesa
    $('btn-salir-confirmar')?.addEventListener('click', async () => {
        if (typeof salirDeMesaActiva === 'function') await salirDeMesaActiva();
        window.location.href = '/mesas';
    });

    // Timer de sesion
    let sec = 0;
    setInterval(() => {
        sec++;
        if ($('session-timer')) {
            const m = String(Math.floor(sec / 60)).padStart(2, '0');
            const s = String(sec % 60).padStart(2, '0');
            $('session-timer').textContent = `${m}:${s}`;
        }
    }, 1000);

    // Inicializar displays con saldo de localStorage
    window.actualizarDisplaysGlobal(localStorage.getItem('saldo'));
});