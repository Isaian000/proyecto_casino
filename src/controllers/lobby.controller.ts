import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Lobby, { LobbyGame } from '../models/lobby';

function generateCode(juego: string, n: number): string {
    return `${juego.toUpperCase().slice(0, 2)}-${String(n).padStart(2, '0')}`;
}

/**
 * Inicializa las mesas base del casino: 5 de Blackjack y 5 de Ruleta.
 * Es idempotente: si ya existen, no las duplica.
 */
export const initLobbies = async (): Promise<void> => {
    const juegos: LobbyGame[] = ['blackjack', 'roulette'];
    for (const juego of juegos) {
        for (let i = 1; i <= 5; i++) {
            const code = generateCode(juego, i);
            const exists = await Lobby.findOne({ code });
            if (!exists) {
                await Lobby.create({
                    code,
                    game: juego,
                    minBet: juego === 'blackjack' ? 10 : 5,
                    maxBet: juego === 'blackjack' ? 1000 : 500,
                    maxPlayers: juego === 'blackjack' ? 4 : 6,
                });
                console.log(`Lobby creado: ${code}`);
            }
        }
    }
};

/**
 * POST /api/lobbies
 * Body: { game: 'blackjack' | 'roulette', minBet?, maxBet?, maxPlayers? }
 */
export const createLobby = async (req: Request, res: Response): Promise<void> => {
    try {
        const { game, minBet, maxBet, maxPlayers } = req.body as {
            game?: LobbyGame;
            minBet?: number;
            maxBet?: number;
            maxPlayers?: number;
        };
        if (!game || !['blackjack', 'roulette'].includes(game)) {
            res.status(400).json({ message: 'game debe ser blackjack o roulette' });
            return;
        }
        const count = await Lobby.countDocuments({ game });
        const lobby = await Lobby.create({
            code: generateCode(game, count + 1),
            game,
            host: req.auth!.userId,
            players: [req.auth!.userId],
            minBet: minBet ?? 10,
            maxBet: maxBet ?? 1000,
            maxPlayers: maxPlayers ?? 4,
        });
        res.status(201).json({ message: 'Lobby creado', lobby });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * GET /api/lobbies?game=blackjack
 */
export const listLobbies = async (req: Request, res: Response): Promise<void> => {
    try {
        const filter: Record<string, unknown> = { status: { $in: ['open', 'in_progress'] } };
        if (req.query.game) filter.game = req.query.game;
        const lobbies = await Lobby.find(filter)
            .populate('host', 'name last_name avatarUrl')
            .sort({ code: 1 });
        res.status(200).json({ count: lobbies.length, lobbies });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * POST /api/lobbies/:id/join
 */
export const joinLobby = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id);
        if (!Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Id invalido' });
            return;
        }
        const userId = new Types.ObjectId(req.auth!.userId);
        const lobby = await Lobby.findOneAndUpdate(
            {
                _id: id,
                status: { $in: ['open', 'in_progress'] },
                $expr: { $lt: [{ $size: '$players' }, '$maxPlayers'] },
            },
            { $addToSet: { players: userId } },
            { new: true }
        );
        if (!lobby) {
            res.status(400).json({ message: 'Lobby lleno o no disponible' });
            return;
        }
        res.status(200).json({ message: 'Te has unido al lobby', lobby });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * POST /api/lobbies/:id/leave
 */
export const leaveLobby = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id);
        if (!Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Id invalido' });
            return;
        }
        const lobby = await Lobby.findByIdAndUpdate(
            id,
            { $pull: { players: req.auth!.userId } },
            { new: true }
        );
        if (!lobby) {
            res.status(404).json({ message: 'Lobby no encontrado' });
            return;
        }
        res.status(200).json({ message: 'Has salido del lobby', lobby });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
