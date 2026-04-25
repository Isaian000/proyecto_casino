// login.js - Inicio de sesion contra /api/auth/login (LOVABLE).
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        window.location.href = '/';
        return;
    }

    const form = document.getElementById('logForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                email: document.getElementById('email_input').value.trim().toLowerCase(),
                password: document.getElementById('password_input').value,
            };
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    credentials: 'include',
                });
                const data = await res.json();
                if (!res.ok) {
                    showToast(data.message || 'Credenciales invalidas', 'error');
                    return;
                }
                localStorage.setItem('token', data.token);
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('username', data.user.name || data.user.email || 'Jugador');
                localStorage.setItem('saldo', String(data.user.bank ?? 0));
                window.location.href = '/';
            } catch (err) {
                showToast('Error de conexion con el servidor', 'error');
            }
        });
    }

    const googleBtn = document.getElementById('google_login');
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            window.location.href = '/api/auth/google';
        });
    }
});
