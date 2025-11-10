import supabase from '../services/supabase.js';
import { validateToolConfig, validateEmail } from '../utils/toolValidation.js';
import axios from 'axios';

/**
 * GET /api/tools
 * Obtener catálogo completo de tools disponibles
 */
const getAllTools = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_tools')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching admin_tools:', error);
      return res.status(500).json({ error: 'Failed to fetch tools' });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error in getAllTools:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Función auxiliar para validar ownership del agente
 */
const validateAgentOwnership = async (agentId, userId) => {
  const { data: agent, error } = await supabase
    .from('agents')
    .select('project_id, projects!inner(user_id)')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    throw new Error('Agent not found');
  }

  if (agent.projects.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  return agent;
};

/**
 * GET /api/projects/:projectId/agents/:agentId/tools
 * Obtener todas las tools conectadas a un agente específico
 */
const getAgentTools = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.uid;

    // Validar ownership
    await validateAgentOwnership(agentId, userId);

    // Obtener tools del agente con JOIN a admin_tools
    const { data, error } = await supabase
      .from('agent_tools')
      .select(`
        id,
        tool_id,
        config,
        position,
        is_enabled,
        created_at,
        admin_tools!inner(
          name,
          description,
          deployment_url,
          schema_template
        )
      `)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching agent_tools:', error);
      return res.status(500).json({ error: 'Failed to fetch agent tools' });
    }

    // Formatear respuesta
    const formattedData = (data || []).map(item => ({
      id: item.id,
      tool_id: item.tool_id,
      tool_name: item.admin_tools.name,
      tool_description: item.admin_tools.description,
      deployment_url: item.admin_tools.deployment_url,
      schema_template: item.admin_tools.schema_template,
      config: item.config,
      position: item.position,
      is_enabled: item.is_enabled,
      created_at: item.created_at
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error in getAgentTools:', error);
    if (error.message === 'Agent not found') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/projects/:projectId/agents/:agentId/tools
 * Conectar una tool a un agente
 */
const connectToolToAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { tool_id, position } = req.body;
    const userId = req.user.uid;

    // Validaciones
    if (!tool_id) {
      return res.status(400).json({ error: 'tool_id is required' });
    }

    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      return res.status(400).json({ error: 'position must be an object with x and y numeric values' });
    }

    // Validar ownership
    await validateAgentOwnership(agentId, userId);

    // Validar que tool_id existe
    const { data: tool, error: toolError } = await supabase
      .from('admin_tools')
      .select('id')
      .eq('id', tool_id)
      .single();

    if (toolError || !tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Verificar que no exista ya la conexión
    const { data: existing } = await supabase
      .from('agent_tools')
      .select('id')
      .eq('agent_id', agentId)
      .eq('tool_id', tool_id)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Tool already connected to this agent' });
    }

    // Crear conexión
    const { data: newConnection, error: insertError } = await supabase
      .from('agent_tools')
      .insert({
        agent_id: agentId,
        tool_id: tool_id,
        config: {},
        position: position,
        is_enabled: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating agent_tool connection:', insertError);
      return res.status(500).json({ error: 'Failed to connect tool to agent' });
    }

    res.status(201).json(newConnection);
  } catch (error) {
    console.error('Error in connectToolToAgent:', error);
    if (error.message === 'Agent not found') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId
 * Actualizar configuración de una tool conectada
 */
const updateToolConfig = async (req, res) => {
  try {
    const { agentId, toolConnectionId } = req.params;
    const { config, position } = req.body;
    const userId = req.user.uid;

    // Validaciones
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config must be an object' });
    }

    // Validar ownership
    await validateAgentOwnership(agentId, userId);

    // Obtener la tool connection con su schema
    const { data: toolConnection, error: fetchError } = await supabase
      .from('agent_tools')
      .select(`
        id,
        tool_id,
        admin_tools!inner(
          schema_template
        )
      `)
      .eq('id', toolConnectionId)
      .eq('agent_id', agentId)
      .single();

    if (fetchError || !toolConnection) {
      return res.status(404).json({ error: 'Tool connection not found' });
    }

    // Validar configuración contra schema
    try {
      validateToolConfig(toolConnection.admin_tools.schema_template, config);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    // Validar formato de emails en la configuración
    const emailFields = Object.keys(config).filter(key => key.includes('email'));
    for (const field of emailFields) {
      if (config[field] && !validateEmail(config[field])) {
        return res.status(400).json({ error: `Invalid email format in field: ${field}` });
      }
    }

    // Actualizar la tool connection
    const updateData = {
      config: config,
      is_enabled: true,
      updated_at: new Date().toISOString()
    };

    if (position) {
      updateData.position = position;
    }

    const { data: updatedConnection, error: updateError } = await supabase
      .from('agent_tools')
      .update(updateData)
      .eq('id', toolConnectionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating agent_tool:', updateError);
      return res.status(500).json({ error: 'Failed to update tool configuration' });
    }

    res.json(updatedConnection);
  } catch (error) {
    console.error('Error in updateToolConfig:', error);
    if (error.message === 'Agent not found') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId
 * Eliminar una tool del agente
 */
const deleteToolConnection = async (req, res) => {
  try {
    const { agentId, toolConnectionId } = req.params;
    const userId = req.user.uid;

    // Validar ownership
    await validateAgentOwnership(agentId, userId);

    // Eliminar conexión
    const { error } = await supabase
      .from('agent_tools')
      .delete()
      .eq('id', toolConnectionId)
      .eq('agent_id', agentId);

    if (error) {
      console.error('Error deleting agent_tool:', error);
      return res.status(500).json({ error: 'Failed to delete tool connection' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error in deleteToolConnection:', error);
    if (error.message === 'Agent not found') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/toggle
 * Habilitar/deshabilitar una tool sin eliminarla
 */
const toggleToolEnabled = async (req, res) => {
  try {
    const { agentId, toolConnectionId } = req.params;
    const { is_enabled } = req.body;
    const userId = req.user.uid;

    // Validaciones
    if (typeof is_enabled !== 'boolean') {
      return res.status(400).json({ error: 'is_enabled must be a boolean' });
    }

    // Validar ownership
    await validateAgentOwnership(agentId, userId);

    // Actualizar is_enabled
    const { data: updatedConnection, error } = await supabase
      .from('agent_tools')
      .update({ is_enabled: is_enabled })
      .eq('id', toolConnectionId)
      .eq('agent_id', agentId)
      .select('id, is_enabled')
      .single();

    if (error) {
      console.error('Error toggling agent_tool:', error);
      return res.status(500).json({ error: 'Failed to toggle tool' });
    }

    if (!updatedConnection) {
      return res.status(404).json({ error: 'Tool connection not found' });
    }

    res.json(updatedConnection);
  } catch (error) {
    console.error('Error in toggleToolEnabled:', error);
    if (error.message === 'Agent not found') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/test
 * Probar una tool enviando datos de prueba al microservicio
 */
const testTool = async (req, res) => {
  try {
    const { agentId, toolConnectionId } = req.params;
    const { test_data } = req.body;
    const userId = req.user.uid;

    // Validaciones
    if (!test_data || typeof test_data !== 'object') {
      return res.status(400).json({ error: 'test_data must be an object' });
    }

    // Validar ownership
    await validateAgentOwnership(agentId, userId);

    // Obtener la tool connection con config y deployment_url
    const { data: toolConnection, error: fetchError } = await supabase
      .from('agent_tools')
      .select(`
        id,
        config,
        admin_tools!inner(
          deployment_url
        )
      `)
      .eq('id', toolConnectionId)
      .eq('agent_id', agentId)
      .single();

    if (fetchError || !toolConnection) {
      return res.status(404).json({ error: 'Tool connection not found' });
    }

    // Verificar que la tool esté configurada
    if (!toolConnection.config || Object.keys(toolConnection.config).length === 0) {
      return res.status(400).json({ error: 'Tool is not configured yet' });
    }

    // Mergear config + test_data
    const payload = {
      ...toolConnection.config,
      ...test_data
    };

    // Hacer POST al microservicio
    try {
      const response = await axios.post(
        toolConnection.admin_tools.deployment_url,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000  // 10 segundos
        }
      );

      res.json({
        success: true,
        message: 'Test executed successfully',
        response: response.data
      });
    } catch (axiosError) {
      console.error('Error calling microservice:', axiosError);
      
      // Manejar errores del microservicio
      const errorMessage = axiosError.response?.data?.error || 
                          axiosError.message || 
                          'Unknown error';
      
      res.json({
        success: false,
        error: `Failed to execute tool: ${errorMessage}`
      });
    }
  } catch (error) {
    console.error('Error in testTool:', error);
    if (error.message === 'Agent not found') {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export {
  getAllTools,
  getAgentTools,
  connectToolToAgent,
  updateToolConfig,
  deleteToolConnection,
  toggleToolEnabled,
  testTool
};
