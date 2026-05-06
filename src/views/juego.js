// juego.js - Modo prueba para Blackjack y Ruleta.
// La logica completa del juego no esta implementada (requisito: solo dejar la estructura).
// Aqui se permite al usuario apostar (descuenta de wallet) y luego declarar el resultado
// para acreditar la ganancia o registrar la perdida. Todo funciona desde el backend:
//   POST /api/wallet/bet  { amount, game, lobbyId }
//   POST /api/wallet/win  { amount, game, lobbyId }

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }
    initNavbar(); initLogout();

    const path = window.location.pathname;
    const juego = path.includes('ruleta') ? 'ruleta' : 'blackjack';
    const apiGame = juego === 'ruleta' ? 'roulette' : 'blackjack';

    const params = new URLSearchParams(window.location.search);
    const lobbyId = params.get('mesa') || localStorage.getItem('mesaActiva') || null;

    const $ = (id) => document.getElementById(id);
    const fases = ['fase-cargando', 'fase-fichas', 'fase-confirmar', 'fase-resultado', 'fase-sin-fondos'];
    function mostrarFase(f) {
        fases.forEach(name => {
            const el = $(name);
            if (!el) return;
            if (name === f) el.classList.remove('oculto');
            else el.classList.add('oculto');
        });
    }

    let apuesta = 0;
    function actualizarApuesta() {
        const total = $('apuesta-total');
        if (total) total.textContent = '$' + apuesta.toLocaleString();
        const btn = $('btn-apostar');
        if (btn) btn.disabled = apuesta <= 0;
    }

    document.querySelectorAll('.ficha').forEach(f => {
        f.addEventListener('click', () => {
            apuesta += parseInt(f.dataset.valor, 10);
            actualizarApuesta();
        });
    });
    $('btn-limpiar')?.addEventListener('click', () => { apuesta = 0; actualizarApuesta(); });
    $('btn-apostar')?.addEventListener('click', () => {
        const m = $('apuesta-confirm-monto');
        if (m) m.textContent = '$' + apuesta.toLocaleString();
        mostrarFase('fase-confirmar');
    });
    $('btn-retirar')?.addEventListener('click', () => { mostrarFase('fase-fichas'); });

    $('btn-confirmar')?.addEventListener('click', async () => {
        if (apuesta <= 0) return;
        const res = await apiFetch('/api/wallet/bet', {
            method: 'POST',
            body: JSON.stringify({ amount: apuesta, game: apiGame, lobbyId }),
        });
        if (!res) return;
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 400 || res.status === 409) {
                mostrarFase('fase-sin-fondos');
                return;
            }
            return showToast(data.message || 'No fue posible apostar', 'error');
        }
        const saldo = data.balance ?? data.bank ?? 0;
        const sd = $('saldo-display');
        if (sd) sd.textContent = '$' + Number(saldo).toLocaleString();
        localStorage.setItem('saldo', String(saldo));
        const lbl = $('apuesta-en-juego-label');
        if (lbl) lbl.textContent = 'Apuesta en juego: $' + apuesta.toLocaleString();
        mostrarFase('fase-resultado');
    });

    $('btn-gane')?.addEventListener('click', async () => {
        const ganancia = apuesta * 2; // pago 2x la apuesta
        const res = await apiFetch('/api/wallet/win', {
            method: 'POST',
            body: JSON.stringify({ amount: ganancia, game: apiGame, lobbyId }),
        });
        if (!res) return;
        const data = await res.json();
        if (res.ok) {
            const saldo = data.balance ?? data.bank ?? 0;
            const sd = $('saldo-display');
            if (sd) sd.textContent = '$' + Number(saldo).toLocaleString();
            localStorage.setItem('saldo', String(saldo));
            showToast('Ganaste $' + ganancia.toLocaleString(), 'success');
        }
        apuesta = 0; actualizarApuesta();
        mostrarFase('fase-fichas');
    });
    $('btn-perdi')?.addEventListener('click', () => {
        showToast('Suerte para la proxima', 'warn');
        apuesta = 0; actualizarApuesta();
        mostrarFase('fase-fichas');
    });

    // Salir de mesa
    const modalSalir = $('modal-salir-mesa');
    $('btn-salir-mesa')?.addEventListener('click', () => modalSalir?.classList.remove('oculto'));
    $('btn-salir-cancelar')?.addEventListener('click', () => modalSalir?.classList.add('oculto'));
    $('btn-salir-confirmar')?.addEventListener('click', async () => {
        await salirDeMesaActiva();
        window.location.href = '/mesas';
    });

    // Timer
    const timerEl = $('session-timer');
    if (timerEl) {
        let sec = 0;
        setInterval(() => {
            sec++;
            const m = String(Math.floor(sec / 60)).padStart(2, '0');
            const s = String(sec % 60).padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
        }, 1000);
    }

    // Mostrar tag de mesa activa en el navbar si aplica
    const mesaTag = $('mesa-activa-tag');
    if (mesaTag && lobbyId) {
        mesaTag.style.display = '';
        mesaTag.textContent = 'Mesa: ' + String(lobbyId).slice(-6).toUpperCase();
    }

    setTimeout(() => mostrarFase('fase-fichas'), 600);
});
