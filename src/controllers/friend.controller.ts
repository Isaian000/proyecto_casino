import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Friendship from '../models/friendship';
import User from '../models/user';

/**
 * POST /api/friends/requests
 * Body: { recipientId } o { email }
 * Crea una solicitud de amistad pendiente.
 */
export const sendFriendRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        const requesterId = req.auth!.userId;
        const { recipientId, email } = req.body as {
            recipientId?: string;
            email?: string;
        };

        let recipient = null;
        if (recipientId && Types.ObjectId.isValid(recipientId)) {
            recipient = await User.findById(recipientId);
        } else if (email) {
            recipient = await User.findOne({ email: String(email).toLowerCase() });
        }

        if (!recipient) {
            res.status(404).json({ message: 'Destinatario no encontrado' });
            return;
        }
        if (String(recipient._id) === requesterId) {
            res.status(400).json({ message: 'No puedes enviarte una solicitud a ti mismo' });
            return;
        }

        const existing = await Friendship.findOne({
            $or: [
                { requester: requesterId, recipient: recipient._id },
                { requester: recipient._id, recipient: requesterId },
            ],
        });
        if (existing) {
            res.status(409).json({
                message: 'Ya existe una relacion con este usuario',
                friendship: existing,
            });
            return;
        }

        const friendship = await Friendship.create({
            requester: requesterId,
            recipient: recipient._id,
            status: 'pending',
        });

        res.status(201).json({ message: 'Solicitud enviada', friendship });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * GET /api/friends
 * Lista amistades aceptadas del usuario autenticado.
 */
export const listFriends = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.auth!.userId;
        const friendships = await Friendship.find({
            status: 'accepted',
            $or: [{ requester: userId }, { recipient: userId }],
        })
            .populate('requester', 'name last_name email avatarUrl')
            .populate('recipient', 'name last_name email avatarUrl')
            .sort({ updatedAt: -1 });

        const friends = friendships.map((f) => {
            const requester: any = f.requester;
            const recipient: any = f.recipient;
            const friend =
                String(requester._id) === userId ? recipient : requester;
            return {
                friendshipId: f._id,
                since: f.updatedAt,
                user: friend,
            };
        });

        res.status(200).json({ count: friends.length, friends });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * GET /api/friends/requests
 * Solicitudes pendientes recibidas por el usuario.
 */
export const listPendingRequests = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userId = req.auth!.userId;
        const pending = await Friendship.find({
            recipient: userId,
            status: 'pending',
        }).populate('requester', 'name last_name email avatarUrl');
        res.status(200).json({ count: pending.length, requests: pending });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * PATCH /api/friends/requests/:id
 * Body: { action: 'accept' | 'reject' | 'block' }
 */
export const respondFriendRequest = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userId = req.auth!.userId;
        const id = String(req.params.id);
        const { action } = req.body as {
            action?: 'accept' | 'reject' | 'block';
        };

        if (!action || !['accept', 'reject', 'block'].includes(action)) {
            res.status(400).json({ message: 'Accion invalida' });
            return;
        }
        if (!Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Id invalido' });
            return;
        }

        const friendship = await Friendship.findById(id);
        if (!friendship) {
            res.status(404).json({ message: 'Solicitud no encontrada' });
            return;
        }
        if (String(friendship.recipient) !== userId) {
            res.status(403).json({ message: 'No autorizado' });
            return;
        }

        if (action === 'accept') {
            friendship.status = 'accepted';
            await friendship.save();
            res.status(200).json({ message: 'Solicitud aceptada', friendship });
            return;
        }
        if (action === 'block') {
            friendship.status = 'blocked';
            await friendship.save();
            res.status(200).json({ message: 'Usuario bloqueado', friendship });
            return;
        }
        await friendship.deleteOne();
        res.status(200).json({ message: 'Solicitud rechazada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * DELETE /api/friends/:id
 * Elimina una amistad existente. :id es el id del OTRO usuario.
 */
export const removeFriend = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.auth!.userId;
        const otherUserId = String(req.params.id);

        if (!Types.ObjectId.isValid(otherUserId)) {
            res.status(400).json({ message: 'Id invalido' });
            return;
        }

        const result = await Friendship.findOneAndDelete({
            $or: [
                { requester: userId, recipient: otherUserId },
                { requester: otherUserId, recipient: userId },
            ],
        });

        if (!result) {
            res.status(404).json({ message: 'Amistad no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Amigo eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
