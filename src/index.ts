import express from 'express';
import path from 'path';
import connectDB from './config/db';
import authRoutes from './routes/auth.routes'

const app = express();
const PORT = process.env.PORT || 3000

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))) // rutas para los estilos e imagenes dentro de 'public/styles'
app.use(express.static(path.join(__dirname, 'views'))) // rutas para servir archivos '.html' dentro de 'views'

app.use('/api/auth', authRoutes)

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