import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/user';
import { signToken } from '../utils/jwt';

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, last_name, email, day, month, year, phone_number, password } =
            req.body;

        if (
            !name ||
            !last_name ||
            !email ||
            !day ||
            !month ||
            !year ||
            !phone_number ||
            !password
        ) {
            res.status(400).json({ message: 'Todos los campos son obligatorios' });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(409).json({ message: 'El correo ya esta registrado' });
            return;
        }

        const birthdate = new Date(Number(year), Number(month) - 1, Number(day));
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            last_name,
            email,
            birthdate,
            phone_number,
            password: hashedPassword,
            authProvider: 'local',
        });

        const token = signToken({ userId: String(user._id), email: user.email });

        res.status(201).json({
            message: 'Usuario registrado correctamente',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                bank: user.bank,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// POST /api/auth/login
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ message: 'Email y contrasena son obligatorios' });
            return;
        }

        const user = await User.findOne({ email });
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Contrasena incorrecta' });
            return;
        }

        const token = signToken({ userId: String(user._id), email: user.email });

        res.status(200).json({
            message: 'Login exitoso',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                bank: user.bank,
                avatarUrl: user.avatarUrl,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// GET /api/auth/me
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.auth) {
            res.status(401).json({ message: 'No autenticado' });
            return;
        }
        const user = await User.findById(req.auth.userId).select('-password');
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }
        res.status(200).json({ user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
