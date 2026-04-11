import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/user';

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, last_name, email, day, month, year, phone_number, password } = req.body;

        if (!name || !last_name || !email || !day || !month || !year || !phone_number || !password) {
            res.status(400).json({ message: 'Todos los campos son obligatorios' });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(409).json({ message: 'El correo ya está registrado' });
            return;
        }

        const birthdate = new Date(Number(year), Number(month) - 1, Number(day));
        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            name,
            last_name,
            email,
            birthdate,
            phone_number,
            password: hashedPassword,
        });

        res.status(201).json({ message: 'Usuario registrado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// DELETE /api/auth/delete-account
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ message: 'Email y contraseña son obligatorios' });
            return;
        }

        const user = await User.findOne({ email });
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Contraseña incorrecta' });
            return;
        }

        await User.deleteOne({ _id: user._id });

        res.status(200).json({ message: 'Cuenta eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// POST /api/auth/login
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Validar campos
        if (!email || !password) {
            res.status(400).json({ message: 'Email y contraseña son obligatorios' });
            return;
        }

        // Buscar usuario
        const user = await User.findOne({ email });
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }

        // Comparar contraseña
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Contraseña incorrecta' });
            return;
        }

        // Login exitoso
        res.status(200).json({
            message: 'Login exitoso',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
