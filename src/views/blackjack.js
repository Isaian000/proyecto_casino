const BlackjackEngine = {
    mazo: [],
    manoJugador: [],
    manoDealer: [],
    juegoTerminado: false,

    crearMazo() {
        const palos = ['♠', '♥', '♦', '♣'];
        const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        this.mazo = [];
        for (let p of palos) {
            for (let v of valores) {
                this.mazo.push({ valor: v, palo: p });
            }
        }
        for (let i = this.mazo.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.mazo[i], this.mazo[j]] = [this.mazo[j], this.mazo[i]];
        }
    },

    pedirCarta() {
        if (this.mazo.length < 10) this.crearMazo();
        return this.mazo.pop();
    },

    evaluarMano(mano) {
        let puntos = 0;
        let ases = 0;
        for (let carta of mano) {
            if (carta.valor === 'A') { ases++; puntos += 11; }
            else if (['J', 'Q', 'K'].includes(carta.valor)) { puntos += 10; }
            else { puntos += parseInt(carta.valor); }
        }
        while (puntos > 21 && ases > 0) { puntos -= 10; ases--; }
        return puntos;
    },

    renderizarEstado() {
        const pJ = document.getElementById('puntos-jugador');
        const sJ = document.getElementById('secuencia-jugador');
        const pD = document.getElementById('puntos-dealer');
        const sD = document.getElementById('secuencia-dealer');

        pJ.innerText = this.evaluarMano(this.manoJugador);
        sJ.innerText = this.manoJugador.map(c => `${c.valor}${c.palo}`).join(', ');

        if (this.juegoTerminado) {
            pD.innerText = this.evaluarMano(this.manoDealer);
            sD.innerText = this.manoDealer.map(c => `${c.valor}${c.palo}`).join(', ');
        } else {
            pD.innerText = '?';
            sD.innerText = this.manoDealer.length > 0 ? `${this.manoDealer[0].valor}${this.manoDealer[0].palo}, [?]` : '...';
        }
    },

    async ejecutarTurnoDealer() {
        this.juegoTerminado = true;
        while (this.evaluarMano(this.manoDealer) < 17) {
            await new Promise(r => setTimeout(r, 600));
            this.manoDealer.push(this.pedirCarta());
            this.renderizarEstado();
        }
    },

    reset() {
        this.manoJugador = [];
        this.manoDealer = [];
        this.juegoTerminado = false;
        this.crearMazo();
    }
};

// Funciones globales para los botones
async function iniciarManoBJ() {
    BlackjackEngine.reset();
    BlackjackEngine.manoJugador.push(BlackjackEngine.pedirCarta(), BlackjackEngine.pedirCarta());
    BlackjackEngine.manoDealer.push(BlackjackEngine.pedirCarta(), BlackjackEngine.pedirCarta());
    BlackjackEngine.renderizarEstado();
    if (BlackjackEngine.evaluarMano(BlackjackEngine.manoJugador) === 21) validarResultado();
}

function pedirCartaJugador() {
    if (BlackjackEngine.juegoTerminado) return;
    BlackjackEngine.manoJugador.push(BlackjackEngine.pedirCarta());
    BlackjackEngine.renderizarEstado();
    if (BlackjackEngine.evaluarMano(BlackjackEngine.manoJugador) > 21) validarResultado();
}

async function plantarseJugador() {
    if (BlackjackEngine.juegoTerminado) return;
    await BlackjackEngine.ejecutarTurnoDealer();
    validarResultado();
}