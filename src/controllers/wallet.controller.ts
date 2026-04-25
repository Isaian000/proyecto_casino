import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/user';
import Transaction, { TransactionType } from '../models/transactions';

/**
 * Operacion atomica de actualizacion de saldo.
 *
 * Estrategia:
 * 1. Para apuestas/retiros (delta < 0) usamos findOneAndUpdate con un filtro
 *    que exige bank >= |delta|. Si el saldo no alcanza, la actualizacion
 *    no aplica y retornamos null. Mongoose ejecuta esto como un unico
 *    documento atomicamente.
 * 2. Para depositos/ganancias (delta >= 0) basta un $inc.
 * 3. Tras actualizar el saldo, registramos la transaccion. Si la base de
 *    datos soporta sesiones (replica set / Atlas), envolvemos ambos pasos
 *    en una transaccion para garantizar consistencia.
 */
async function updateBalanceAtomic(
    userId: string,
    delta: number,
    type: TransactionType,
    extra: { game?: string; lobbyId?: string; metadata?: Record<string, unknown> } = {}
): Promise<{ ok: boolean; balance?: number; reason?: string }> {
    const session = await mongoose.startSession();
    try {
        let balance: number | undefined;

        await session.withTransaction(async () => {
            const filter: any = { _id: userId };
            if (delta < 0) {
                filter.bank = { $gte: -delta };
            }

            const updated = await User.findOneAndUpdate(
                filter,
                { $inc: { bank: delta } },
                { new: true, session }
            );

            if (!updated) {
                throw new Error('INSUFFICIENT_FUNDS_OR_USER_NOT_FOUND');
            }

            balance = updated.bank;

            await Transaction.create(
                [
                    {
                        user: userId,
                        type,
                        amount: delta,
                        balanceAfter: updated.bank,
                        game: extra.game,
                        lobbyId: extra.lobbyId,
                        metadata: extra.metadata,
                        status: 'completed',
                    },
                ],
                { session }
            );
        });

        return { ok: true, balance };
    } catch (error: any) {
        // Fallback si el cluster no soporta transacciones (standalone local).
        const message = String(error?.message ?? '');
        const isTxnNotSupported =
            message.includes('Transaction numbers') ||
            message.includes('replica set') ||
            message.includes('not supported');

        if (isTxnNotSupported) {
            const filter: any = { _id: userId };
            if (delta < 0) filter.bank = { $gte: -delta };
            const updated = await User.findOneAndUpdate(
                filter,
                { $inc: { bank: delta } },
                { new: true }
            );
            if (!updated) {
                return { ok: false, reason: 'INSUFFICIENT_FUNDS_OR_USER_NOT_FOUND' };
            }
            await Transaction.create({
                user: userId,
                type,
                amount: delta,
                balanceAfter: updated.bank,
                game: extra.game,
                lobbyId: extra.lobbyId,
                metadata: extra.metadata,
                status: 'completed',
            });
            return { ok: true, balance: updated.bank };
        }

        if (message.includes('INSUFFICIENT_FUNDS_OR_USER_NOT_FOUND')) {
            return { ok: false, reason: 'INSUFFICIENT_FUNDS_OR_USER_NOT_FOUND' };
        }
        throw error;
    } finally {
        session.endSession();
    }
}

/**
 * GET /api/wallet/balance
 */
export const getBalance = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.auth!.userId).select('bank');
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }
        res.status(200).json({ balance: user.bank });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * POST /api/wallet/deposit  Body: { amount: number }
 */
export const deposit = async (req: Request, res: Response): Promise<void> => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ message: 'amount debe ser un numero positivo' });
        return;
    }
    const result = await updateBalanceAtomic(req.auth!.userId, amount, 'deposit');
    if (!result.ok) {
        res.status(400).json({ message: 'No se pudo procesar el deposito' });
        return;
    }
    res.status(200).json({ message: 'Deposito realizado', balance: result.balance });
};

/**
 * POST /api/wallet/withdraw  Body: { amount: number }
 */
export const withdraw = async (req: Request, res: Response): Promise<void> => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ message: 'amount debe ser un numero positivo' });
        return;
    }
    const result = await updateBalanceAtomic(req.auth!.userId, -amount, 'withdrawal');
    if (!result.ok) {
        res.status(400).json({ message: 'Saldo insuficiente' });
        return;
    }
    res.status(200).json({ message: 'Retiro realizado', balance: result.balance });
};

/**
 * POST /api/wallet/bet  Body: { amount: number, game?: string, lobbyId?: string }
 * Descuenta saldo de forma segura (no permite saldo negativo).
 */
export const placeBet = async (req: Request, res: Response): Promise<void> => {
    const amount = Number(req.body?.amount);
    const { game, lobbyId } = req.body ?? {};
    if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ message: 'amount debe ser un numero positivo' });
        return;
    }
    const result = await updateBalanceAtomic(
        req.auth!.userId,
        -amount,
        'bet',
        { game, lobbyId }
    );
    if (!result.ok) {
        res.status(400).json({ message: 'Saldo insuficiente para apostar' });
        return;
    }
    res.status(200).json({
        message: 'Apuesta registrada',
        balance: result.balance,
    });
};

/**
 * POST /api/wallet/win  Body: { amount: number, game?: string, lobbyId?: string }
 */
export const registerWin = async (req: Request, res: Response): Promise<void> => {
    const amount = Number(req.body?.amount);
    const { game, lobbyId } = req.body ?? {};
    if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ message: 'amount debe ser un numero positivo' });
        return;
    }
    const result = await updateBalanceAtomic(
        req.auth!.userId,
        amount,
        'win',
        { game, lobbyId }
    );
    if (!result.ok) {
        res.status(400).json({ message: 'No se pudo registrar la ganancia' });
        return;
    }
    res.status(200).json({ message: 'Ganancia acreditada', balance: result.balance });
};

/**
 * GET /api/wallet/transactions?limit=20
 */
export const listTransactions = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const txs = await Transaction.find({ user: req.auth!.userId })
            .sort({ createdAt: -1 })
            .limit(limit);
        res.status(200).json({ count: txs.length, transactions: txs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

export const _internal = { updateBalanceAtomic };
