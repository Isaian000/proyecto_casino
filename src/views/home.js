// home.js - Pagina principal.
document.addEventListener('DOMContentLoaded', () => {
    initNavbar((user) => {
        const heroCta = document.getElementById('hero-cta');
        if (heroCta) {
            heroCta.textContent = 'Jugar ahora';
            heroCta.href = '/mesas';
        }
    });
    initLogout();
});
