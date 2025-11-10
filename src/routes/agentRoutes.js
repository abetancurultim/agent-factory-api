import express from 'express';
import { 
    getAgentsByProject, 
    createAgent,
    updateAgent,
    deployAgent, 
    getProjectAgent,
    deployBridge
} from '../controllers/agentController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

// { mergeParams: true } es VITAL
// Permite que este router acceda a los parámetros de la ruta padre (ej. :projectId)
const router = express.Router({ mergeParams: true });

// Aplicamos el middleware de autenticación a todas las rutas de agentes
router.use(authMiddleware);

// --- Definición de Rutas de Agentes ---

// GET /api/projects/:projectId/agents
router.get('/', getAgentsByProject);

// POST /api/projects/:projectId/agents
router.post('/', createAgent);

// Obtener el agente único de un proyecto
// GET /api/projects/:projectId/agents/agent
router.get('/agent', getProjectAgent);

// Actualizar configuración del agente (sin desplegar)
// PUT /api/projects/:projectId/agents/:agentId
router.put('/:agentId', updateAgent);

// Desplegar agente en ElevenLabs
// POST /api/projects/:projectId/agents/:agentId/deploy
router.post('/:agentId/deploy', deployAgent);

// POST: Endpoint para desplegar el puente en DO
router.post('/:agentId/deploy-bridge', deployBridge);

export default router;