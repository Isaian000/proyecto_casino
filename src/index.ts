import express from 'express';
import path from 'path';
import connectDB from './config/db';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))) // rutas para los estilos e imagenes dentro de 'public/styles'
app.use(express.static(path.join(__dirname, 'views'))) // rutas para servir archivos '.html' dentro de 'views'

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'sigin.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost: ${PORT}`);
});