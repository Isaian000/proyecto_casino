import { Router, Request, Response } from 'express';
import multer from 'multer';
import { isLoggedIn } from '../middleware/isLoggedIn';
import { uploadAvatar } from '../controllers/avatar.controller';
import { changePassword, deleteAccount } from '../controllers/user.controller';
import User from '../models/user';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten imagenes'));
        }
        cb(null, true);
    },
});

/**
 * GET /api/users/me
 */
router.get('/me', isLoggedIn, async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.auth!.userId).select('-password');
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }
        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * PATCH /api/users/me
 * Body: { name?, last_name?, phone_number? }
 */
router.patch('/me', isLoggedIn, async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, last_name, phone_number } = req.body as {
            name?: string;
            last_name?: string;
            phone_number?: string;
        };
        const updates: Record<string, unknown> = {};
        if (typeof name === 'string' && name.trim()) updates.name = name.trim();
        if (typeof last_name === 'string' && last_name.trim()) updates.last_name = last_name.trim();
        if (typeof phone_number === 'string' && phone_number.trim()) updates.phone_number = phone_number.trim();

        const user = await User.findByIdAndUpdate(req.auth!.userId, updates, {
            new: true,
            runValidators: true,
        }).select('-password');

        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }
        res.status(200).json({ message: 'Perfil actualizado', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.patch('/me/password', isLoggedIn, changePassword);
router.delete('/me', isLoggedIn, deleteAccount);
router.post('/me/avatar', isLoggedIn, upload.single('avatar'), uploadAvatar);

export default router;
