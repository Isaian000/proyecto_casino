// perfil.js - Pagina de perfil contra backend LOVABLE.
// Endpoints utilizados:
//   GET    /api/auth/me                       -> usuario actual
//   PATCH  /api/users/me                      -> editar nombres/apellidos/telefono
//   PATCH  /api/users/me/password             -> cambiar contrasena
//   DELETE /api/users/me                      -> eliminar cuenta
//   POST   /api/users/me/avatar               -> subir avatar (Cloudinary)
//   POST   /api/wallet/deposit                -> recargar saldo
//   GET    /api/wallet/transactions?limit=5   -> historial
//   GET    /api/wallet/stats                  -> estadisticas (extension)

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('token')) { window.location.href = '/login'; return; }

    initNavbar();
    initLogout();

    // ---------- Cargar perfil ----------
    apiFetch('/api/auth/me')
        .then(r => r ? r.json() : null)
        .then(payload => {
            if (!payload) return;
            const u = mapUser(payload.user || payload);
            window.__user = u;

            const inicial = (u.apellidos || 'U').charAt(0).toUpperCase();
            const avatarSmall = document.getElementById('user-avatar');
            const avatarBig   = document.getElementById('perfil-avatar-big');
            if (u.avatarUrl) {
                if (avatarSmall) {
                    avatarSmall.style.backgroundImage = `url('${u.avatarUrl}')`;
                    avatarSmall.style.backgroundSize = 'cover';
                    avatarSmall.style.backgroundPosition = 'center';
                    avatarSmall.textContent = '';
                }
                if (avatarBig) {
                    avatarBig.style.backgroundImage = `url('${u.avatarUrl}')`;
                    avatarBig.style.backgroundSize = 'cover';
                    avatarBig.style.backgroundPosition = 'center';
                    avatarBig.textContent = '';
                }
            } else {
                if (avatarSmall) avatarSmall.textContent = inicial;
                if (avatarBig)   avatarBig.textContent   = inicial;
            }

            document.getElementById('perfil-nombre-completo').textContent = `${u.nombres} ${u.apellidos}`;
            document.getElementById('perfil-email-sub').textContent = u.email || '';
            document.getElementById('p-nombres').textContent   = u.nombres   || '-';
            document.getElementById('p-apellidos').textContent = u.apellidos || '-';
            document.getElementById('p-email').textContent     = u.email     || '-';
            document.getElementById('p-telefono').textContent  = u.telefono  || '-';
            document.getElementById('edit-nombres').value      = u.nombres   || '';
            document.getElementById('edit-apellidos').value    = u.apellidos || '';
            document.getElementById('edit-telefono').value     = u.telefono  || '';

            if (u.fechaNacimiento) {
                const f = new Date(u.fechaNacimiento);
                document.getElementById('p-fecha').textContent =
                    f.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
            }

            const sd = document.getElementById('saldo-display');
            const ps = document.getElementById('p-saldo');
            if (sd) sd.textContent = '$' + Number(u.saldo).toLocaleString();
            if (ps) ps.textContent = '$' + Number(u.saldo).toLocaleString();
            localStorage.setItem('saldo', String(u.saldo));
        })
        .catch(console.error);

    // ---------- Estadisticas ----------
    apiFetch('/api/wallet/stats')
        .then(r => r ? r.json() : null)
        .then(s => {
            if (!s) return;
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            set('stat-partidas',  s.partidasJugadas || 0);
            set('stat-victorias', s.victorias || 0);
            set('stat-derrotas',  s.derrotas || 0);
            set('stat-pct',       (s.porcentajeVictorias || 0) + '%');
            set('stat-ganado',    '$' + (s.totalGanado   || 0).toLocaleString());
            set('stat-apostado',  '$' + (s.totalApostado || 0).toLocaleString());
            const pnl = s.netoPnL || 0;
            const pnlEl = document.getElementById('stat-pnl');
            if (pnlEl) {
                pnlEl.textContent = (pnl >= 0 ? '+' : '') + '$' + pnl.toLocaleString();
                pnlEl.style.color = pnl >= 0 ? '#2ecc71' : '#e74c3c';
            }
        })
        .catch(() => {});

    // ---------- Historial ----------
    apiFetch('/api/wallet/transactions?limit=5')
        .then(r => r ? r.json() : null)
        .then(payload => {
            const txs = Array.isArray(payload) ? payload : (payload?.transactions || payload?.items || []);
            if (!txs.length) return;
            const lista = document.getElementById('historial-lista');
            const vacio = document.getElementById('historial-vacio');
            if (vacio) vacio.remove();
            txs.forEach(tx => {
                const monto  = Number(tx.amount || 0);
                const tipo   = tx.type || 'op';
                const juego  = tx.game ? tx.game.charAt(0).toUpperCase() + tx.game.slice(1) :
                               (tipo === 'deposit' ? 'Recarga' :
                                tipo === 'withdrawal' ? 'Retiro' :
                                tipo === 'bet' ? 'Apuesta' :
                                tipo === 'win' ? 'Ganancia' : 'Transaccion');
                const signo = (tipo === 'win' || tipo === 'deposit') ? 1 : -1;
                const fecha = new Date(tx.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
                const row = document.createElement('div');
                row.className = 'historial-row';
                row.innerHTML = `
                    <span class="hist-juego">${juego}</span>
                    <span class="hist-monto ${signo >= 0 ? 'ganancia' : 'perdida'}">
                        ${signo >= 0 ? '+' : '-'}$${Math.abs(monto).toLocaleString()}
                    </span>
                    <span class="hist-fecha">${fecha}</span>`;
                lista.appendChild(row);
            });
        })
        .catch(() => {});

    // ---------- CRUD: abrir/cerrar secciones ----------
    const botonesAccion = document.querySelectorAll('.btn-accion[data-target]');
    function cerrarTodas() {
        document.querySelectorAll('.seccion-crud').forEach(s => {
            s.classList.add('oculto');
            s.style.maxHeight = '0';
        });
        botonesAccion.forEach(b => b.classList.remove('btn-accion-active'));
    }
    botonesAccion.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const seccion  = document.getElementById(targetId);
            if (!seccion) return;
            const yaAbierta = !seccion.classList.contains('oculto');
            cerrarTodas();
            if (!yaAbierta) {
                seccion.classList.remove('oculto');
                seccion.style.maxHeight = seccion.scrollHeight + 'px';
                btn.classList.add('btn-accion-active');
                setTimeout(() => seccion.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
            }
        });
    });
    document.querySelectorAll('.btn-cerrar-crud').forEach(btn => {
        btn.addEventListener('click', () => cerrarTodas());
    });

    // ---------- Validacion en tiempo real ----------
    function validarInput(input, condicion) {
        if (!input) return;
        input.addEventListener('input', () => {
            const ok = condicion(input.value);
            input.classList.toggle('input-valid', ok);
            input.classList.toggle('input-invalid', !ok && input.value.length > 0);
        });
    }
    validarInput(document.getElementById('edit-nombres'),   v => v.trim().length >= 2);
    validarInput(document.getElementById('edit-apellidos'), v => v.trim().length >= 2);
    validarInput(document.getElementById('edit-telefono'),  v => v.trim().length >= 7);
    validarInput(document.getElementById('pass-nueva'),     v => v.length >= 6);
    validarInput(document.getElementById('pass-confirma'),  v => v === (document.getElementById('pass-nueva')?.value || '') && v.length >= 6);

    // ---------- Mostrar/ocultar contrasena ----------
    document.querySelectorAll('.toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.input);
            if (!input) return;
            const esPass = input.type === 'password';
            input.type = esPass ? 'text' : 'password';
            btn.innerHTML = esPass ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
    });

    // ---------- Recarga rapida ----------
    document.querySelectorAll('.btn-recarga').forEach(btn => {
        btn.addEventListener('click', () => recargar(parseInt(btn.dataset.monto, 10)));
    });
    const btnCustom = document.getElementById('btn-recarga-custom');
    if (btnCustom) {
        btnCustom.addEventListener('click', () => {
            const input = document.getElementById('recarga-input');
            const val = parseInt(input.value, 10);
            if (!val || val <= 0) return showToast('Ingresa una cantidad valida', 'error');
            if (val > 99999) return showToast('Maximo $99,999 por recarga', 'warn');
            recargar(val);
            input.value = '';
        });
    }
    async function recargar(cantidad) {
        const res = await apiFetch('/api/wallet/deposit', {
            method: 'POST',
            body: JSON.stringify({ amount: cantidad }),
        });
        if (!res) return;
        const data = await res.json();
        if (!res.ok) return showToast(data.message || 'No fue posible recargar', 'error');
        const saldo = data.balance ?? data.bank ?? data.saldo;
        const sd = document.getElementById('saldo-display');
        const ps = document.getElementById('p-saldo');
        if (sd) sd.textContent = '$' + Number(saldo).toLocaleString();
        if (ps) ps.textContent = '$' + Number(saldo).toLocaleString();
        localStorage.setItem('saldo', String(saldo));
        showToast(`+$${cantidad.toLocaleString()} agregados`, 'success');
    }

    // ---------- Editar perfil ----------
    document.getElementById('form-editar')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            name: document.getElementById('edit-nombres').value.trim(),
            last_name: document.getElementById('edit-apellidos').value.trim(),
            phone_number: document.getElementById('edit-telefono').value.trim(),
        };
        const res = await apiFetch('/api/users/me', {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
        if (!res) return;
        const data = await res.json();
        if (!res.ok) return showToast(data.message || 'No fue posible actualizar', 'error');

        document.getElementById('p-nombres').textContent   = body.name;
        document.getElementById('p-apellidos').textContent = body.last_name;
        document.getElementById('p-telefono').textContent  = body.phone_number;
        document.getElementById('perfil-nombre-completo').textContent = `${body.name} ${body.last_name}`;
        const inicial = body.last_name.charAt(0).toUpperCase();
        const avatarSmall = document.getElementById('user-avatar');
        const avatarBig   = document.getElementById('perfil-avatar-big');
        if (avatarSmall && !avatarSmall.style.backgroundImage) avatarSmall.textContent = inicial;
        if (avatarBig && !avatarBig.style.backgroundImage)     avatarBig.textContent   = inicial;
        cerrarTodas();
        showToast('Perfil actualizado', 'success');
    });

    // ---------- Cambiar contrasena ----------
    document.getElementById('form-password')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nueva    = document.getElementById('pass-nueva').value;
        const confirma = document.getElementById('pass-confirma').value;
        if (nueva !== confirma) return showToast('Las contrasenas no coinciden', 'error');
        const res = await apiFetch('/api/users/me/password', {
            method: 'PATCH',
            body: JSON.stringify({
                currentPassword: document.getElementById('pass-actual').value,
                newPassword: nueva,
            }),
        });
        if (!res) return;
        const data = await res.json();
        if (!res.ok) return showToast(data.message || 'No fue posible cambiar la contrasena', 'error');
        document.getElementById('form-password').reset();
        cerrarTodas();
        showToast('Contrasena actualizada', 'success');
    });

    // ---------- Eliminar cuenta ----------
    document.getElementById('form-eliminar')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await apiFetch('/api/users/me', {
            method: 'DELETE',
            body: JSON.stringify({ password: document.getElementById('delete-password').value }),
        });
        if (!res) return;
        const data = await res.json();
        if (!res.ok) return showToast(data.message || 'No fue posible eliminar la cuenta', 'error');
        showToast('Cuenta eliminada. Hasta pronto', 'info');
        setTimeout(() => { localStorage.clear(); window.location.href = '/'; }, 1500);
    });

    // ---------- Subir avatar (opcional, si existe input file en la pagina) ----------
    document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('avatar', file);
        const res = await fetch('/api/users/me/avatar', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + getToken() },
            body: fd,
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) return showToast(data.message || 'No fue posible subir el avatar', 'error');
        const url = data.avatarUrl || data.url;
        if (url) {
            ['user-avatar', 'perfil-avatar-big'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.backgroundImage = `url('${url}')`;
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                    el.textContent = '';
                }
            });
        }
        showToast('Avatar actualizado', 'success');
    });
});
