import { Router, Request, Response } from 'express';
import { isLoggedIn } from '../middleware/isLoggedIn';
import {
    getBalance,
    deposit,
    withdraw,
    placeBet,
    registerWin,
    listTransactions,
} from '../controllers/wallet.controller';
import Transaction from '../models/transactions';

const router = Router();

router.use(isLoggedIn);

router.get('/balance', getBalance);
router.post('/deposit', deposit);
router.post('/withdraw', withdraw);
router.post('/bet', placeBet);
router.post('/win', registerWin);
router.get('/transactions', listTransactions);

/**
 * GET /api/wallet/stats
 * Estadisticas agregadas del usuario autenticado.
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.auth!.userId;
        const txs = await Transaction.find({ user: userId });

        let partidasJugadas = 0;
        let victorias = 0;
        let derrotas = 0;
        let totalGanado = 0;
        let totalApostado = 0;

        for (const tx of txs) {
            const amount = Number(tx.amount || 0);
            if (tx.type === 'bet') {
                partidasJugadas += 1;
                derrotas += 1; // se ajusta abajo si hubo win en la misma partida
                totalApostado += Math.abs(amount);
            } else if (tx.type === 'win') {
                victorias += 1;
                derrotas = Math.max(0, derrotas - 1);
                totalGanado += Math.abs(amount);
            }
        }

        const porcentajeVictorias = partidasJugadas
            ? Math.round((victorias / partidasJugadas) * 100)
            : 0;
        const netoPnL = totalGanado - totalApostado;

        res.status(200).json({
            partidasJugadas,
            victorias,
            derrotas,
            porcentajeVictorias,
            totalGanado,
            totalApostado,
            netoPnL,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

export default router;
