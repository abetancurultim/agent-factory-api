import express from 'express';
import * as toolsController from '../controllers/toolsController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET /api/tools - Obtener catálogo completo de tools (no requiere auth de proyecto específico)
router.get('/tools', authMiddleware, toolsController.getAllTools);

// GET /api/projects/:projectId/agents/:agentId/tools - Obtener tools de un agente
router.get('/projects/:projectId/agents/:agentId/tools', authMiddleware, toolsController.getAgentTools);

// POST /api/projects/:projectId/agents/:agentId/tools - Conectar tool a agente
router.post('/projects/:projectId/agents/:agentId/tools', authMiddleware, toolsController.connectToolToAgent);

// PUT /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId - Actualizar config
router.put('/projects/:projectId/agents/:agentId/tools/:toolConnectionId', authMiddleware, toolsController.updateToolConfig);

// DELETE /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId - Eliminar tool
router.delete('/projects/:projectId/agents/:agentId/tools/:toolConnectionId', authMiddleware, toolsController.deleteToolConnection);

// PATCH /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/toggle - Habilitar/deshabilitar
router.patch('/projects/:projectId/agents/:agentId/tools/:toolConnectionId/toggle', authMiddleware, toolsController.toggleToolEnabled);

// POST /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/test - Probar tool
router.post('/projects/:projectId/agents/:agentId/tools/:toolConnectionId/test', authMiddleware, toolsController.testTool);

export default router;
