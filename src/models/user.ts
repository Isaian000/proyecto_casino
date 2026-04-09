import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
    name: string;
    last_name: string;
    email: string;
    birthdate: Date;
    phone_number: string;
    password: string;
    bank: number;
    createAt: Date;
    updateAt: Date;
}

const userSchema =  new Schema(
    {
        name: { type: String, required: true, trim: true},
        last_name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim:true },
        birthdate: { type: Date, required: true },
        phone_number: { type: String, required: true, trim: true },
        password: { type: String, required: true, minLength: 6 },
        bank: { type: Number, default: 0, min: 0}
        
    },
    {timestamps: true}
);

export default model('User', userSchema)