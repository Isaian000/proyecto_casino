// registro.js - Registro contra /api/auth/register (LOVABLE).
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        window.location.href = '/';
        return;
    }

    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const year  = parseInt(document.getElementById('year_select').value, 10);
        const month = parseInt(document.getElementById('month_select').value, 10);
        const day   = parseInt(document.getElementById('day_select').value, 10);

        if (!year || !month || !day) {
            showToast('Selecciona tu fecha de nacimiento completa', 'error');
            return;
        }

        // Validacion de mayoria de edad en frontend
        const fechaNac = new Date(year, month - 1, day);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNac.getFullYear();
        const mesDiff = hoy.getMonth() - (month - 1);
        if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < day)) edad--;
        if (edad < 18) {
            showToast('Debes ser mayor de 18 anos para registrarte', 'error');
            return;
        }

        const body = {
            name: document.getElementById('name_input').value.trim(),
            last_name: document.getElementById('second_name_input').value.trim(),
            email: document.getElementById('email_input').value.trim().toLowerCase(),
            day, month, year,
            phone_number: document.getElementById('phone_input').value.trim(),
            password: document.getElementById('password_input').value,
        };

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.message || 'No fue posible registrar la cuenta', 'error');
                return;
            }
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.user.id);
                localStorage.setItem('username', data.user.name || data.user.email || 'Jugador');
            localStorage.setItem('saldo', String(data.user.bank ?? 0));
            showToast('Registro exitoso. Bienvenido', 'success');
            setTimeout(() => { window.location.href = '/'; }, 1000);
        } catch (err) {
            showToast('Error de conexion con el servidor', 'error');
        }
    });
});
