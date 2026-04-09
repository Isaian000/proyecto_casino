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