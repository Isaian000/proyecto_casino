import { Router } from 'express';
import passport from 'passport';
import { registerUser, loginUser, getCurrentUser } from '../controllers/auth.controller';
import { isLoggedIn } from '../middleware/isLoggedIn';
import { signToken } from '../utils/jwt';
import { isGoogleOAuthConfigured } from '../config/env';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', isLoggedIn, getCurrentUser);

/**
 * POST /api/auth/logout
 * Limpia la cookie httpOnly del JWT y la sesion de Passport (si aplica).
 */
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    if (typeof (req as any).logout === 'function') {
        (req as any).logout(() => res.status(200).json({ message: 'Sesion cerrada' }));
        return;
    }
    res.status(200).json({ message: 'Sesion cerrada' });
});

// ---- Google OAuth ----------------------------------------------------------
router.get('/google', (req, res, next) => {
    if (!isGoogleOAuthConfigured()) {
        res.status(503).json({
            message:
                'Google OAuth no esta configurado. Define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env',
        });
        return;
    }
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
    })(req, res, next);
});

router.get(
    '/google/callback',
    (req, res, next) => {
        if (!isGoogleOAuthConfigured()) {
            res.status(503).json({ message: 'Google OAuth no esta configurado' });
            return;
        }
        passport.authenticate('google', { session: false, failureRedirect: '/login' })(
            req,
            res,
            next
        );
    },
    (req, res) => {
        const user: any = req.user;
        if (!user) {
            res.status(401).json({ message: 'Autenticacion con Google fallida' });
            return;
        }
        const token = signToken({ userId: String(user._id), email: user.email });
        // Devuelve el token via cookie y JSON. El frontend puede leer la cookie
        // o redirigir al usuario tras inspeccionar la respuesta.
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(200).json({
            message: 'Login con Google exitoso',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                bank: user.bank,
            },
        });
    }
);

export default router;
