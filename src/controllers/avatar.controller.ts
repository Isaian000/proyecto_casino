import { Request, Response } from 'express';
import streamifier from 'streamifier';
import cloudinary from '../config/cloudinary';
import { isCloudinaryConfigured } from '../config/env';
import User from '../models/user';

/**
 * POST /api/users/me/avatar
 * Multipart/form-data, field: "avatar"
 */
export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!isCloudinaryConfigured()) {
            res.status(503).json({
                message:
                    'Cloudinary no esta configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env',
            });
            return;
        }
        if (!req.file) {
            res.status(400).json({ message: 'Archivo "avatar" requerido' });
            return;
        }

        const userId = req.auth!.userId;

        const uploadFromBuffer = (): Promise<{ secure_url: string; public_id: string }> =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'casino/avatars',
                        public_id: `user_${userId}`,
                        overwrite: true,
                        resource_type: 'image',
                        transformation: [
                            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                        ],
                    },
                    (error, result) => {
                        if (error || !result) return reject(error);
                        resolve({
                            secure_url: result.secure_url,
                            public_id: result.public_id,
                        });
                    }
                );
                streamifier.createReadStream(req.file!.buffer).pipe(stream);
            });

        const { secure_url, public_id } = await uploadFromBuffer();

        const user = await User.findByIdAndUpdate(
            userId,
            { avatarUrl: secure_url, avatarPublicId: public_id },
            { new: true }
        ).select('-password');

        res.status(200).json({
            message: 'Avatar actualizado',
            avatarUrl: secure_url,
            user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error subiendo el avatar' });
    }
};
