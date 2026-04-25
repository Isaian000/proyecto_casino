import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthPayload {
    userId: string;
    email?: string;
    iat?: number;
    exp?: number;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            auth?: AuthPayload;
        }
    }
}

/**
 * Extrae el token desde el header Authorization (Bearer), desde una cookie
 * llamada "token" o desde la sesion de Passport (req.user).
 */
function extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        return header.substring('Bearer '.length).trim();
    }
    const cookieToken = (req as any).cookies?.token;
    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
        return cookieToken;
    }
    return null;
}

export const isLoggedIn = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Si el usuario ya viene autenticado por Passport (sesion), aceptamos.
    const sessionUser = (req as any).user;
    if (sessionUser && sessionUser._id) {
        req.auth = { userId: String(sessionUser._id), email: sessionUser.email };
        return next();
    }

    const token = extractToken(req);
    if (!token) {
        res.status(401).json({ message: 'Acceso no autorizado. Token requerido.' });
        return;
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
        req.auth = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalido o expirado.' });
    }
};

export default isLoggedIn;
