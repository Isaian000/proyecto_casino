// socket-client.js - Cliente Socket.io para alertas de lobby en tiempo real.
// Se carga en las vistas de juego (blackjack, ruleta) e informa al usuario
// cuando otros jugadores entran o salen de la misma mesa.
//
// Eventos emitidos al servidor:
//   joinLobby  { lobbyId, userId, username }
//   leaveLobby { lobbyId, userId, username }
//
// Eventos escuchados del servidor:
//   playerJoined { lobbyId, userId, username }
//   playerLeft   { lobbyId, userId, username }

(function () {
    if (typeof io === 'undefined') {
        console.warn('[socket] libreria socket.io-client no encontrada');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const lobbyId = params.get('mesa') || localStorage.getItem('mesaActiva');
    if (!lobbyId) return;

    // Datos minimos del usuario (los guarda login.js / registro.js).
    let userId = localStorage.getItem('userId') || 'anon';
    let username = localStorage.getItem('username') || localStorage.getItem('userName') || 'Jugador';

    const socket = io({ transports: ['websocket', 'polling'] });

    function notify(msg) {
        if (typeof showToast === 'function') {
            showToast(msg, 'info');
        } else {
            alert(msg);
        }
    }

    socket.on('connect', () => {
        socket.emit('joinLobby', { lobbyId, userId, username });
        // Notificar a otros scripts (ej. ruleta.js) que el socket ya está listo
        window.casinoSocket = socket;
        window.dispatchEvent(new Event('casinoSocketReady'));
    });

    socket.on('playerJoined', (data) => {
        if (!data || data.userId === userId) return;
        notify('Jugador ' + (data.username || 'desconocido') + ' se unio a la mesa');
    });

    socket.on('playerLeft', (data) => {
        if (!data || data.userId === userId) return;
        notify('Jugador ' + (data.username || 'desconocido') + ' salio de la mesa');
    });

    window.addEventListener('beforeunload', () => {
        try {
            socket.emit('leaveLobby', { lobbyId, userId, username });
            socket.disconnect();
        } catch (_) { /* noop */ }
    });

    // Expone el socket por si otras vistas quieren usarlo.
    window.casinoSocket = socket;
})();
