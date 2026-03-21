import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect("mongodb+srv://admin:admin123@myapp.zw6q3rt.mongodb.net/ProyectoCasino");
        console.log("MongoDB conectado");
    } catch (error) {
        console.error("Error conectando MongoDB:", error);
        process.exit(1);
    }
};

export default connectDB;