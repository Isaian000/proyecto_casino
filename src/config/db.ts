import mongoose from 'mongoose';
import { env } from './env';

const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect(env.MONGO_URI);
        console.log('Conexion exitosa a MongoDB');
    } catch (error) {
        console.error('Error conectando a MongoDB:', error);
        process.exit(1);
    }
};

export default connectDB;