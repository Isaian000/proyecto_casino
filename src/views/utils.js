// utils.js - Helpers compartidos por todas las paginas.
// Adaptado para consumir el backend de LOVABLE (endpoints /api/auth, /api/wallet, /api/lobbies).

// ---------- Token JWT ----------
function getToken() { return localStorage.getItem('token'); }
function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
}

// ---------- Fetch autenticado ----------
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) },
        credentials: 'include',
    });
    if (res.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return null;
    }
    return res;
}

// ---------- Toast ----------
function showToast(msg, tipo = 'info') {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'toast-wrap';
        wrap.style.cssText = `
            position: fixed; top: 88px; left: 50%; transform: translateX(-50%);
            display: flex; flex-direction: column; align-items: center; gap: 10px;
            z-index: 9999; pointer-events: none; width: max-content; max-width: 90vw;
        `;
        document.body.appendChild(wrap);
    }
    const colores = { success: '#2ecc71', error: '#e74c3c', info: '#3498db', warn: '#f39c12' };
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #1e1e1e; border: 1px solid ${colores[tipo]};
        border-top: 3px solid ${colores[tipo]};
        color: white; padding: 12px 20px; border-radius: 10px;
        font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 600;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        animation: toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1); pointer-events: auto;
        display: flex; align-items: center; gap: 10px;
    `;
    toast.textContent = msg;
    if (!document.getElementById('toast-style')) {
        const s = document.createElement('style');
        s.id = 'toast-style';
        s.textContent = `
            @keyframes toastIn  { from{opacity:0;transform:translateY(-16px) scale(0.92)} to{opacity:1;transform:translateY(0) scale(1)} }
            @keyframes toastOut { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(-10px) scale(0.95)} }
        `;
        document.head.appendChild(s);
    }
    wrap.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ---------- Mapeo de usuario LOVABLE -> formato esperado por la UI ----------
// El backend devuelve: { id, name, last_name, email, bank, phone_number, birthdate, avatarUrl }
// La UI original esperaba: { _id|userId, nombres, apellidos, email, telefono, fechaNacimiento, saldo, avatarUrl }
function mapUser(u) {
    if (!u) return null;
    return {
        userId: u.id || u._id,
        nombres: u.name,
        apellidos: u.last_name,
        email: u.email,
        telefono: u.phone_number,
        fechaNacimiento: u.birthdate,
        saldo: typeof u.bank === 'number' ? u.bank : 0,
        avatarUrl: u.avatarUrl || null,
    };
}

// ---------- Navbar ----------
function initNavbar(onLoaded) {
    const userId    = localStorage.getItem('userId');
    const logInBtn  = document.getElementById('log-in-bttn');
    const signInBtn = document.getElementById('sign-in-bttn');
    const userZone  = document.getElementById('user-zone');
    const avatar    = document.getElementById('user-avatar');
    const saldoDisp = document.getElementById('saldo-display');

    if (!userId || !getToken()) {
        if (logInBtn)  logInBtn.style.display  = '';
        if (signInBtn) signInBtn.style.display = '';
        if (userZone)  userZone.style.display  = 'none';
        return;
    }

    if (logInBtn)  logInBtn.style.display  = 'none';
    if (signInBtn) signInBtn.style.display = 'none';
    if (userZone)  userZone.style.display  = 'flex';

    apiFetch('/api/auth/me')
        .then(r => r ? r.json() : null)
        .then(payload => {
            if (!payload) return;
            const u = mapUser(payload.user || payload);
            if (!u) return;
            if (avatar) {
                if (u.avatarUrl) {
                    avatar.style.backgroundImage = `url('${u.avatarUrl}')`;
                    avatar.style.backgroundSize = 'cover';
                    avatar.style.backgroundPosition = 'center';
                    avatar.textContent = '';
                } else {
                    avatar.textContent = (u.apellidos || 'U').charAt(0).toUpperCase();
                }
            }
            if (saldoDisp) saldoDisp.textContent = '$' + Number(u.saldo).toLocaleString();
            localStorage.setItem('saldo', String(u.saldo));
            if (onLoaded) onLoaded(u);
        })
        .catch(() => {
            if (saldoDisp) saldoDisp.textContent = '$' + Number(localStorage.getItem('saldo') || 0).toLocaleString();
        });
}

// ---------- Logout ----------
function initLogout() {
    const btn = document.getElementById('confirm-logout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        await salirDeMesaActiva();
        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
        localStorage.clear();
        window.location.href = '/';
    });
}

// ---------- Salir de mesa activa (lobby) ----------
async function salirDeMesaActiva() {
    const mesaId = localStorage.getItem('mesaActiva');
    if (!mesaId) return;
    try {
        await apiFetch(`/api/lobbies/${mesaId}/leave`, { method: 'POST' });
    } catch (e) { /* silencioso */ }
    localStorage.removeItem('mesaActiva');
}

// ---------- Verificacion automatica de mesa al cargar ----------
(async function verificarMesaAlCargar() {
    const mesaId = localStorage.getItem('mesaActiva');
    if (!mesaId || !getToken()) return;
    const enJuego = window.location.pathname === '/blackjack' || window.location.pathname === '/ruleta';
    if (!enJuego) {
        try {
            await apiFetch(`/api/lobbies/${mesaId}/leave`, { method: 'POST' });
        } catch (e) { /* silencioso */ }
        localStorage.removeItem('mesaActiva');
    }
})();
