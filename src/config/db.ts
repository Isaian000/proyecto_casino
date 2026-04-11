import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
    try {
      //  await mongoose.connect("mongodb://127.0.0.1:27017/casino_database");
      await mongoose.connect("mongodb+srv://admin:admin123@myapp.zw6q3rt.mongodb.net/ProyectoCasino");  
      console.log(`Conexion exitosa a MongoDB`);
    } catch (error) {
        console.error("Error conectando a MongoDB:", error);
        process.exit(1);
    }
};

export default connectDB;