// mesas.js - Listado de lobbies (mesas) consumiendo /api/lobbies del backend LOVABLE.
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }
    initNavbar(); initLogout();

    let juegoActivo = 'blackjack';

    function cargarMesas(juego) {
        const grid = document.getElementById('mesas-grid');
        grid.innerHTML = '<p style="color:rgba(255,255,255,0.3); text-align:center; padding:40px;">Cargando mesas...</p>';

        // El backend usa "blackjack" y "roulette". El frontend de IA usa "ruleta".
        const apiGame = juego === 'ruleta' ? 'roulette' : juego;
        const slugGame = juego;

        apiFetch(`/api/lobbies?game=${apiGame}`)
            .then(r => r ? r.json() : null)
            .then(payload => {
                if (!payload) return;
                const lobbies = Array.isArray(payload) ? payload : (payload.lobbies || payload.items || []);
                grid.innerHTML = '';
                if (!lobbies.length) {
                    grid.innerHTML = '<p style="color:rgba(255,255,255,0.4); text-align:center; padding:40px;">No hay mesas disponibles para este juego.</p>';
                    return;
                }
                lobbies.forEach(mesa => {
                    const id = mesa._id || mesa.id;
                    const code = mesa.code || ('MESA-' + String(id).slice(-4).toUpperCase());
                    const max = mesa.maxPlayers || 4;
                    const players = Array.isArray(mesa.players) ? mesa.players.length : 0;
                    const llena = players >= max;
                    const card = document.createElement('div');
                    card.className = `mesa-card ${llena ? 'mesa-llena' : 'mesa-libre'}`;
                    card.innerHTML = `
                        <div class="mesa-id">${code.replace(/-/g, ' ').toUpperCase()}</div>
                        <div class="mesa-estado-badge ${llena ? 'badge-llena' : 'badge-libre'}">
                            ${llena ? 'Llena' : 'Disponible'}
                        </div>
                        <div class="mesa-rango">Apuesta $${mesa.minBet || 10} - $${mesa.maxBet || 1000}</div>
                        <div class="mesa-jugadores">
                            <span>${players}/${max} jugadores</span>
                        </div>
                        ${!llena
                            ? `<button class="btn-entrar" data-id="${id}" data-juego="${slugGame}">Entrar</button>`
                            : '<span class="mesa-llena-txt">Mesa llena</span>'}
                    `;
                    grid.appendChild(card);
                });

                document.querySelectorAll('.btn-entrar').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const lobbyId = btn.dataset.id;
                        const juegoSlug = btn.dataset.juego;
                        const res = await apiFetch(`/api/lobbies/${lobbyId}/join`, { method: 'POST' });
                        if (!res) return;
                        const data = await res.json();
                        if (!res.ok) return showToast(data.message || 'No fue posible unirse a la mesa', 'error');
                        localStorage.setItem('mesaActiva', lobbyId);
                        window.location.href = `/${juegoSlug}?mesa=${lobbyId}`;
                    });
                });
            })
            .catch(() => showToast('Error cargando mesas', 'error'));
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            juegoActivo = btn.dataset.juego;
            cargarMesas(juegoActivo);
        });
    });

    cargarMesas(juegoActivo);
});
