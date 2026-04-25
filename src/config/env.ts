import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name: string, fallback?: string): string {
    const value = process.env[name] ?? fallback;
    if (value === undefined || value === '') {
        throw new Error(`Variable de entorno requerida no definida: ${name}`);
    }
    return value;
}

function optional(name: string, fallback = ''): string {
    return process.env[name] ?? fallback;
}

export const env = {
    PORT: Number(process.env.PORT ?? 3000),
    NODE_ENV: optional('NODE_ENV', 'development'),
    APP_URL: optional('APP_URL', 'http://localhost:3000'),

    MONGO_URI: required(
        'MONGO_URI',
        'mongodb+srv://admin:admin123@myapp.zw6q3rt.mongodb.net/ProyectoCasino'
    ),

    JWT_SECRET: optional('JWT_SECRET', 'dev_jwt_secret_change_me'),
    JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),

    SESSION_SECRET: optional('SESSION_SECRET', 'dev_session_secret_change_me'),

    GOOGLE_CLIENT_ID: optional('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET'),
    GOOGLE_CALLBACK_URL: optional(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3000/api/auth/google/callback'
    ),

    CLOUDINARY_CLOUD_NAME: optional('CLOUDINARY_CLOUD_NAME'),
    CLOUDINARY_API_KEY: optional('CLOUDINARY_API_KEY'),
    CLOUDINARY_API_SECRET: optional('CLOUDINARY_API_SECRET'),

    EXCHANGE_RATE_API_URL: optional(
        'EXCHANGE_RATE_API_URL',
        'https://open.er-api.com/v6/latest/USD'
    ),
};

export const isGoogleOAuthConfigured = (): boolean =>
    Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const isCloudinaryConfigured = (): boolean =>
    Boolean(
        env.CLOUDINARY_CLOUD_NAME &&
            env.CLOUDINARY_API_KEY &&
            env.CLOUDINARY_API_SECRET
    );
