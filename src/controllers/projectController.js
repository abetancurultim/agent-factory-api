import supabase from '../services/supabase.js'; // Importamos el cliente de Supabase

/**
 * Obtiene todos los proyectos para un usuario.
 */
export const getAllProjects = async (req, res) => {
  const userId = req.user.uid; // 'req.user' es inyectado por authMiddleware

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      agents:agents(count)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).send({ error: error.message });
  }

  // Transformar el conteo de agentes
  const projectsWithCount = data.map(project => ({
    ...project,
    agentCount: project.agents?.[0]?.count || 0,
    agents: undefined
  }));

  res.status(200).send(projectsWithCount);
};

/**
 * Obtiene todos los proyectos de un usuario con info del agente
 */
export const getProjects = async (req, res) => {
  const userId = req.user.uid;

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      agents (
        id,
        agent_name,
        status,
        elevenlabs_agent_id,
        deployed_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).send({ error: error.message });
  }

  // Normalizar respuesta para que cada proyecto tenga su agente
  const normalizedData = data.map(project => ({
    ...project,
    agent: project.agents?.[0] || null, // Tomar el primer (y único) agente
    agents: undefined // Eliminar el array agents
  }));

  res.status(200).send(normalizedData);
};

/**
 * Obtiene un proyecto específico por ID.
 */
export const getProjectById = async (req, res) => {
  const userId = req.user.uid;
  const { projectId } = req.params;

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      agents:agents(count)
    `)
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Supabase error:', error);
    if (error.code === 'PGRST116') {
      return res.status(404).send({ error: 'Project not found' });
    }
    return res.status(500).send({ error: error.message });
  }

  // Agregar el conteo de agentes
  const projectWithCount = {
    ...data,
    agentCount: data.agents?.[0]?.count || 0,
    agents: undefined
  };

  res.status(200).send(projectWithCount);
};

/**
 * Crea un nuevo proyecto para un usuario.
 */
export const createProject = async (req, res) => {
  const userId = req.user.uid;
  const { project_name, description } = req.body; // Agregar description opcional

  if (!project_name) {
    return res.status(400).send({ error: 'project_name is required' });
  }

  try {
    // 1. Crear el proyecto
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert([{ 
        user_id: userId, 
        project_name: project_name,
        description: description || null 
      }])
      .select()
      .single();

    if (projectError) throw projectError;

    // 2. Crear automáticamente el agente vacío asociado
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert([
        {
          project_id: project.id,
          agent_name: project_name, // Mismo nombre inicial que el proyecto
          system_prompt: '',
          voice_id: '',
          first_message: '',
          status: 'DRAFT',
          elevenlabs_agent_id: null, // NULL hasta que se haga deploy
          react_flow_data: { position: { x: 250, y: 200 } } // Posición centrada en el canvas
        },
      ])
      .select()
      .single();

    if (agentError) throw agentError;

    // 3. Retornar el proyecto con el agente incluido
    res.status(201).send({
      ...project,
      agent: agent
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).send({ error: error.message });
  }
};

/**
 * [GET] /api/projects/:projectId/agent
 * Obtiene el agente único asociado a un proyecto
 */
export const getProjectAgent = async (req, res) => {
  const userId = req.user.uid;
  const { projectId } = req.params;

  try {
    // Verificar que el proyecto pertenece al usuario
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return res.status(404).send({ error: 'Project not found' });
    }

    // Obtener el agente asociado al proyecto
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (agentError) {
      // Si no existe agente, retornar 404
      if (agentError.code === 'PGRST116') {
        return res.status(404).send({ error: 'Agent not found for this project' });
      }
      throw agentError;
    }

    res.status(200).send(agent);
  } catch (error) {
    console.error('Error fetching project agent:', error);
    res.status(500).send({ error: error.message });
  }
};