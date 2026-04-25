import { Schema, model, Document, Types } from 'mongoose';

export type AuthProvider = 'local' | 'google';

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    last_name: string;
    email: string;
    birthdate: Date;
    phone_number: string;
    password: string;
    bank: number;
    avatarUrl?: string;
    avatarPublicId?: string;
    googleId?: string;
    authProvider: AuthProvider;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        last_name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        birthdate: { type: Date, required: true },
        phone_number: { type: String, required: true, trim: true },
        password: { type: String, required: true, minlength: 6 },
        bank: { type: Number, default: 0, min: 0 },
        avatarUrl: { type: String },
        avatarPublicId: { type: String },
        googleId: { type: String, index: true, sparse: true, unique: true },
        authProvider: {
            type: String,
            enum: ['local', 'google'],
            default: 'local',
        },
    },
    { timestamps: true }
);

export default model<IUser>('User', userSchema);
