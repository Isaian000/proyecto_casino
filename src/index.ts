import express from 'express';
import connectDB from './config/db';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Servidor Casino funcionando');
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost: ${PORT}`);
  });
});