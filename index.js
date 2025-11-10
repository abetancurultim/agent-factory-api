import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importador de Rutas
import projectRoutes from './src/routes/projectRoutes.js';
import toolsRoutes from './src/routes/toolsRoutes.js';

// --- Configuración Inicial ---
dotenv.config();
const app = express();
const port = process.env.PORT || 8091;

// --- Middlewares Básicos ---
app.use(cors());
app.use(express.json());

// --- Rutas de la API ---
// Todo lo que empiece con /api/projects será manejado por 'projectRoutes'
app.use('/api/projects', projectRoutes);

// Rutas de tools
app.use('/api', toolsRoutes);

// (Se pueden agregar más rutas aquí)
// app.use('/api/agents', agentRoutes);
// app.use('/api/chatbots', chatbotRoutes);

// Endpoint de prueba
app.get('/api/health', (req, res) => {
  res.send('Agent Factory API is running!');
});

// --- Iniciar el Servidor ---
app.listen(port, () => {
  console.log(`🚀 API Server running on http://localhost:${port}`);
});