// 
const user = JSON.parse(localStorage.getItem('user'));

// mostrar boton si hay o no una sesion iniciada
if (user) {
    document.getElementById('deleteAccountBtn').style.display = 'inline-block';
}

// confirmacion de eliminacion de la cuenta
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    const password = document.getElementById('deletePassword').value.trim();
    const errorDiv = document.getElementById('deleteError');

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    if (!password) {
        errorDiv.textContent = 'Por favor ingresa tu contraseña.';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const res = await fetch('/api/auth/delete-account', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.removeItem('user');
            alert('Tu cuenta ha sido eliminada correctamente.');
            window.location.href = '/';
        } else {
            errorDiv.textContent = data.message || 'Error al eliminar la cuenta.';
            errorDiv.style.display = 'block';
        }
    } catch (err) {
        errorDiv.textContent = 'Error de conexión. Intenta de nuevo.';
        errorDiv.style.display = 'block';
    }
});