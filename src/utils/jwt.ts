import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
    userId: string;
    email?: string;
}

export function signToken(payload: TokenPayload): string {
    const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
    return jwt.sign(payload, env.JWT_SECRET, options);
}
