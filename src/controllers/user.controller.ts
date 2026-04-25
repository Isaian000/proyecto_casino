import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/user';
import Transaction from '../models/transactions';

/**
 * PATCH /api/users/me/password
 * Body: { currentPassword: string, newPassword: string }
 */
export const changePassword = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { currentPassword, newPassword } = req.body ?? {};
        if (!currentPassword || !newPassword) {
            res.status(400).json({
                message: 'currentPassword y newPassword son obligatorios',
            });
            return;
        }
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            res.status(400).json({
                message: 'La nueva contrasena debe tener al menos 6 caracteres',
            });
            return;
        }

        const user = await User.findById(req.auth!.userId);
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }

        if (user.authProvider !== 'local') {
            res.status(400).json({
                message:
                    'Esta cuenta usa autenticacion externa. No es posible cambiar la contrasena local.',
            });
            return;
        }

        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) {
            res.status(401).json({ message: 'La contrasena actual es incorrecta' });
            return;
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.status(200).json({ message: 'Contrasena actualizada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

/**
 * DELETE /api/users/me
 * Body: { password?: string } (requerido para cuentas locales)
 */
export const deleteAccount = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = await User.findById(req.auth!.userId);
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }

        if (user.authProvider === 'local') {
            const { password } = req.body ?? {};
            if (!password) {
                res.status(400).json({
                    message: 'Debes confirmar con tu contrasena para eliminar la cuenta',
                });
                return;
            }
            const ok = await bcrypt.compare(password, user.password);
            if (!ok) {
                res.status(401).json({ message: 'Contrasena incorrecta' });
                return;
            }
        }

        await Transaction.deleteMany({ user: user._id });
        await User.deleteOne({ _id: user._id });

        res.clearCookie('token');
        res.status(200).json({ message: 'Cuenta eliminada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
