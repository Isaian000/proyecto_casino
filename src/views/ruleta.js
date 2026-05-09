document.addEventListener('DOMContentLoaded', () => {
    let valorFichaSeleccionada = 5;
    const apuestasPorCasilla = new Map();

    // Sincronizar saldo inicial
    if (typeof window.actualizarDisplaysGlobal === 'function') {
        window.actualizarDisplaysGlobal();
    }

    document.querySelectorAll('.chip--item').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip--item').forEach(c => c.style.transform = 'scale(1)');
            chip.style.transform = 'scale(1.2)';
            valorFichaSeleccionada = parseInt(chip.dataset.valor);
        });
    });

    const todasLasCasillas = document.querySelectorAll('.section--item, .column-item, .bet-item, .casilla-0, .casilla-00');
    todasLasCasillas.forEach(casilla => {
        casilla.addEventListener('click', () => {
            const id = casilla.id || casilla.innerText.trim();
            const montoActual = apuestasPorCasilla.get(id) || 0;
            apuestasPorCasilla.set(id, montoActual + valorFichaSeleccionada);
            
            window.apuestaTotalGlobal += valorFichaSeleccionada;
            
            actualizarGraficoApuesta(casilla, apuestasPorCasilla.get(id));
            window.actualizarDisplaysGlobal();
        });
    });

    function actualizarGraficoApuesta(elemento, monto) {
        let badge = elemento.querySelector('.chip-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'chip-badge';
            badge.style = "position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:gold; color:black; border-radius:50%; width:22px; height:22px; font-size:10px; font-weight:bold; display:flex; align-items:center; justify-content:center; border:1px solid black; z-index:10;";
            elemento.style.position = 'relative';
            elemento.appendChild(badge);
        }
        badge.innerText = monto >= 1000 ? (monto/1000).toFixed(1) + 'k' : monto;
    }

    const btnJugar = document.getElementById('btn-doblar');
    if (btnJugar) {
        btnJugar.addEventListener('click', async () => {
            if (window.apuestaTotalGlobal <= 0) return;

            const lobbyId = new URLSearchParams(window.location.search).get('mesa') || localStorage.getItem('mesaActiva');

            // 1. COBRAR LA APUESTA AL SERVER
            const resBet = await apiFetch('/api/wallet/bet', {
                method: 'POST',
                body: JSON.stringify({ amount: window.apuestaTotalGlobal, game: 'roulette', lobbyId }),
            });

            if (!resBet || !resBet.ok) {
                alert("Saldo insuficiente o error en el servidor");
                return;
            }

            const dataBet = await resBet.json();
            window.actualizarDisplaysGlobal(dataBet.balance ?? dataBet.bank);

            const statusMsg = document.querySelector('.status-msg');
            statusMsg.innerText = "¡Girando!";

            // 2. GENERAR RESULTADO
            const opciones = ["0", "00", ...Array.from({length: 36}, (_, i) => (i + 1).toString())];
            const ganador = opciones[Math.floor(Math.random() * opciones.length)];

            setTimeout(async () => {
                statusMsg.innerText = `Cayó en: ${ganador}`;
                
                let premioTotal = 0;
                apuestasPorCasilla.forEach((monto, idCasilla) => {
                    premioTotal += calcularPremio(idCasilla, ganador, monto);
                });

                // 3. PAGAR PREMIO SI GANÓ
                if (premioTotal > 0) {
                    const resWin = await apiFetch('/api/wallet/win', {
                        method: 'POST',
                        body: JSON.stringify({ amount: premioTotal, game: 'roulette', lobbyId }),
                    });
                    if (resWin?.ok) {
                        const d = await resWin.json();
                        window.actualizarDisplaysGlobal(d.balance ?? d.bank);
                        alert(`¡Ganaste €${premioTotal}!`);
                    }
                } else {
                    alert("Suerte para la próxima");
                }
                
                setTimeout(limpiarMesa, 3000);
            }, 2000);
        });
    }

    function calcularPremio(apuestaId, numGanador, monto) {
        const n = parseInt(numGanador);
        const rojos = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        
        // CORRECCIÓN LÓGICA NEGRO: Si no es rojo, ni 0, ni 00, es negro.
        const esRojo = rojos.includes(n);
        const esNegro = !esRojo && numGanador !== "0" && numGanador !== "00";

        if (apuestaId === `item-${numGanador}` || apuestaId === numGanador) return monto * 36;
        if (apuestaId === 'rojo' && esRojo) return monto * 2;
        if (apuestaId === 'negro' && esNegro) return monto * 2;
        if (apuestaId === 'EVEN' && !isNaN(n) && n !== 0 && n % 2 === 0) return monto * 2;
        if (apuestaId === 'ODD' && !isNaN(n) && n !== 0 && n % 2 !== 0) return monto * 2;
        if (apuestaId === '1st 12' && n >= 1 && n <= 12) return monto * 3;
        if (apuestaId === '2nd 12' && n >= 13 && n <= 24) return monto * 3;
        if (apuestaId === '3rd 12' && n >= 25 && n <= 36) return monto * 3;

        return 0;
    }

    function limpiarMesa() {
        apuestasPorCasilla.clear();
        window.apuestaTotalGlobal = 0;
        document.querySelectorAll('.chip-badge').forEach(b => b.remove());
        const statusMsg = document.querySelector('.status-msg');
        if (statusMsg) statusMsg.innerText = "Haga sus apuestas, por favor";
        window.actualizarDisplaysGlobal();
    }
});