import express from 'express';
import { 
    getProjects,
    createProject, 
    getProjectById,
    getProjectAgent
} from '../controllers/projectController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import agentRoutes from './agentRoutes.js';

const router = express.Router();

// Aplicamos el middleware de autenticación a todas las rutas de este archivo
router.use(authMiddleware);

// Definimos las rutas
router.get('/', getProjects);       // GET /api/projects
router.post('/', createProject);      // POST /api/projects
router.get('/:projectId', getProjectById);  // GET /api/projects/:projectId
router.use('/:projectId/agents', agentRoutes); // Rutas de agentes bajo /api/projects/:projectId/agents
// GET /api/projects/:projectId/agent 
router.get('/:projectId/agent', getProjectAgent);

export default router;