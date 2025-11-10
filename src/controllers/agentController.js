import supabase from "../services/supabase.js";
import axios from "axios";

// Configuración de DigitalOcean API
const DO_API_BASE_URL = "https://api.digitalocean.com/v2";
const DO_API_TOKEN = process.env.DIGITALOCEAN_API_TOKEN;

// Cliente axios configurado para DigitalOcean
const doAxios = axios.create({
  baseURL: DO_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${DO_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Chequeo de seguridad:
 * Verifica si un proyecto le pertenece al usuario autenticado.
 * Previene que un usuario vea o agregue agentes a proyectos que no son suyos.
 */
const verifyProjectOwnership = async (userId, projectId) => {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    throw new Error("Project not found or user unauthorized");
  }
  return true;
};

/**
 * [GET] /api/projects/:projectId/agents
 * Obtiene todos los agentes que pertenecen a un proyecto específico.
 */
export const getAgentsByProject = async (req, res) => {
  const userId = req.user.uid;
  const { projectId } = req.params;

  try {
    // 1. Verificar que el usuario es dueño del proyecto
    await verifyProjectOwnership(userId, projectId);

    // 2. Si es dueño, obtener los agentes
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).send(data);
  } catch (error) {
    console.error("Error getting agents:", error.message);
    if (error.message.includes("unauthorized")) {
      return res.status(403).send({ error: error.message });
    }
    res.status(500).send({ error: error.message });
  }
};

/**
 * [POST] /api/projects/:projectId/agents
 * Crea un nuevo agente en la base de datos (sin desplegar a ElevenLabs todavía)
 * El despliegue a ElevenLabs se hace con la ruta /deploy
 */
export const createAgent = async (req, res) => {
  const userId = req.user.uid;
  const { projectId } = req.params;
  const {
    agent_name,
    system_prompt,
    voice_id,
    first_message,
    react_flow_data,
  } = req.body;

  if (!agent_name) {
    return res.status(400).send({ error: "agent_name is required" });
  }

  try {
    // 1. Verificar propiedad del proyecto
    await verifyProjectOwnership(userId, projectId);

    // 2. Guardar el nuevo agente en nuestra DB (Supabase) - SIN desplegar a ElevenLabs todavía
    const { data: newAgent, error: supabaseError } = await supabase
      .from("agents")
      .insert([
        {
          project_id: projectId,
          agent_name: agent_name,
          system_prompt: system_prompt || "",
          voice_id: voice_id || "",
          first_message: first_message || "",
          status: "DRAFT", // DRAFT porque NO está desplegado en ElevenLabs
          elevenlabs_agent_id: null, // NULL hasta que se haga deploy
          react_flow_data: react_flow_data || { position: { x: 250, y: 200 } },
        },
      ])
      .select()
      .single();

    if (supabaseError) throw supabaseError;

    res.status(201).send(newAgent);
  } catch (error) {
    console.error("Error creating agent:", error.message);
    res
      .status(500)
      .send({ error: "Failed to create agent", details: error.message });
  }
};

/**
 * [PUT] /api/projects/:projectId/agents/:agentId
 * Actualiza la configuración de un agente (solo en Supabase, NO en ElevenLabs)
 */
export const updateAgent = async (req, res) => {
  const userId = req.user.uid;
  const { projectId, agentId } = req.params;
  const {
    agent_name,
    system_prompt,
    voice_id,
    first_message,
    react_flow_data,
  } = req.body;

  console.log("Update agent request:", { userId, projectId, agentId });

  try {
    // 1. Verificar que el proyecto pertenece al usuario
    await verifyProjectOwnership(userId, projectId);

    // 2. Verificar que el agente existe y pertenece a ese proyecto
    const { data: existingAgent, error: fetchError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("project_id", projectId)
      .single();

    console.log("Existing agent:", existingAgent, "Error:", fetchError);

    if (fetchError || !existingAgent) {
      console.error("Agent not found:", {
        agentId,
        projectId,
        error: fetchError,
      });
      return res.status(404).send({ error: "Agent not found" });
    }

    // 3. Preparar datos para actualizar
    const updateData = {};
    if (agent_name !== undefined) updateData.agent_name = agent_name;
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
    if (voice_id !== undefined) updateData.voice_id = voice_id;
    if (first_message !== undefined) updateData.first_message = first_message;
    if (react_flow_data !== undefined)
      updateData.react_flow_data = react_flow_data;

    console.log("Update data:", updateData);

    // Validar que haya al menos un campo para actualizar
    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .send({
          error: "No fields to update. Please provide at least one field.",
        });
    }

    // 4. Actualizar en Supabase
    const { data: updatedAgent, error: updateError } = await supabase
      .from("agents")
      .update(updateData)
      .eq("id", agentId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    console.log("Agent updated successfully:", updatedAgent);
    res.status(200).send(updatedAgent);
  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).send({ error: error.message });
  }
};

/**
 * [POST] /api/projects/:projectId/agents/:agentId/deploy
 * Despliega el agente en ElevenLabs por primera vez (crea el agente)
 */
export const deployAgent = async (req, res) => {
  const userId = req.user.uid;
  const { projectId, agentId } = req.params;

  try {
    // 1. Verificar propiedad del proyecto
    await verifyProjectOwnership(userId, projectId);
    
    // 2. Obtener el agente
    const { data: agent, error: fetchError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("project_id", projectId)
      .single();

    if (fetchError || !agent) {
      return res.status(404).send({ error: "Agent not found" });
    }

    // 3. Verificar que NO esté ya desplegado
    if (agent.elevenlabs_agent_id) {
      return res.status(400).send({ 
        error: "Agent is already deployed. Use the update endpoint to modify it." 
      });
    }

    // 4. Validar que tenga los datos necesarios
    if (!agent.agent_name || !agent.system_prompt || !agent.voice_id) {
      return res.status(400).send({
        error: "Agent must have agent_name, system_prompt, and voice_id configured before deploying",
      });
    }

    // 5. Actualizar status a DEPLOYING
    await supabase
      .from("agents")
      .update({ status: "DEPLOYING" })
      .eq("id", agentId);

    try {
      console.log('Creating agent in ElevenLabs...');
      
      // 6. Crear en ElevenLabs
      const elevenLabsResponse = await axios.post(
        "https://api.elevenlabs.io/v1/convai/agents/create",
        {
          name: agent.agent_name, // Agregar el nombre del agente
          conversation_config: {
            agent: {
              prompt: {
                prompt: agent.system_prompt,
              },
              first_message: agent.first_message || "Hello! How can I help you?",
              language: "en",
            },
            tts: {
              voice_id: agent.voice_id,
            },
          },
        },
        {
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      const elevenlabs_agent_id = elevenLabsResponse.data.agent_id;

      if (!elevenlabs_agent_id) {
        throw new Error("Failed to create agent in ElevenLabs - no agent_id returned");
      }
      
      console.log('Agent created in ElevenLabs:', elevenlabs_agent_id);

      // 7. Actualizar en Supabase con el agent_id y status ACTIVE
      const { data: deployedAgent, error: updateError } = await supabase
        .from("agents")
        .update({
          elevenlabs_agent_id: elevenlabs_agent_id,
          status: "ACTIVE",
          deployed_at: new Date().toISOString(),
        })
        .eq("id", agentId)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log('Agent deployed successfully');
      res.status(200).send(deployedAgent);
    } catch (elevenLabsError) {
      // Si falla ElevenLabs, marcar como ERROR
      console.error('ElevenLabs error:', elevenLabsError.response?.data || elevenLabsError.message);
      
      await supabase
        .from("agents")
        .update({ status: "ERROR" })
        .eq("id", agentId);

      throw elevenLabsError;
    }
  } catch (error) {
    console.error("Error deploying agent:", error.response?.data || error.message);
    res.status(500).send({
      error: "Failed to deploy agent",
      details: error.response?.data || error.message,
    });
  }
};

/**
 * [PATCH] /api/projects/:projectId/agents/:agentId/redeploy
 * Actualiza un agente ya desplegado en ElevenLabs
 */
//! Pendiente por agregar ruta
export const updateDeployedAgent = async (req, res) => {
  const userId = req.user.uid;
  const { projectId, agentId } = req.params;

  try {
    // 1. Verificar propiedad del proyecto
    await verifyProjectOwnership(userId, projectId);
    
    // 2. Obtener el agente
    const { data: agent, error: fetchError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("project_id", projectId)
      .single();

    if (fetchError || !agent) {
      return res.status(404).send({ error: "Agent not found" });
    }

    // 3. Verificar que YA esté desplegado
    if (!agent.elevenlabs_agent_id) {
      return res.status(400).send({ 
        error: "Agent is not deployed yet. Use the deploy endpoint first." 
      });
    }

    // 4. Validar que tenga los datos necesarios
    if (!agent.agent_name || !agent.system_prompt || !agent.voice_id) {
      return res.status(400).send({
        error: "Agent must have agent_name, system_prompt, and voice_id configured",
      });
    }

    try {
      console.log('Updating agent in ElevenLabs...');
      
      // 5. Actualizar en ElevenLabs
      await axios.patch(
        `https://api.elevenlabs.io/v1/convai/agents/${agent.elevenlabs_agent_id}`,
        {
          name: agent.agent_name, // Agregar el nombre del agente
          conversation_config: {
            agent: {
              prompt: {
                prompt: agent.system_prompt,
              },
              first_message: agent.first_message || "Hello! How can I help you?",
              language: "en",
            },
            tts: {
              voice_id: agent.voice_id,
            },
          },
        },
        {
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      
      console.log('Agent updated in ElevenLabs');

      // 6. Actualizar timestamp en Supabase
      const { data: updatedAgent, error: updateError } = await supabase
        .from("agents")
        .update({
          deployed_at: new Date().toISOString(),
        })
        .eq("id", agentId)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log('Agent redeployed successfully');
      res.status(200).send(updatedAgent);
    } catch (elevenLabsError) {
      console.error('ElevenLabs error:', elevenLabsError.response?.data || elevenLabsError.message);
      throw elevenLabsError;
    }
  } catch (error) {
    console.error("Error updating deployed agent:", error.response?.data || error.message);
    res.status(500).send({
      error: "Failed to update deployed agent",
      details: error.response?.data || error.message,
    });
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
    // Verificar propiedad del proyecto
    await verifyProjectOwnership(userId, projectId);

    // Obtener el agente (debería ser único)
    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (error) {
      // Si no existe agente, retornar 404
      if (error.code === "PGRST116") {
        return res
          .status(404)
          .send({ error: "Agent not found for this project" });
      }
      throw error;
    }

    res.status(200).send(agent);
  } catch (error) {
    console.error("Error fetching project agent:", error);
    res.status(500).send({ error: error.message });
  }
};

/**
 * [POST] /api/agents/:agentId/deploy-bridge
 * Despliega el "puente" (agent-bridge-template) en DigitalOcean
 * para un agente que YA existe en ElevenLabs.
 */
export const deployBridge = async (req, res) => {
  const userId = req.user.uid;
  const { agentId } = req.params;

  let agent; // Definir aquí para usarlo en el bloque catch

  try {
    // --- 1. Obtener y Validar Agente ---
    // Obtenemos el agente Y su proyecto padre para verificar la propiedad
    const { data: agentData, error: agentError } = await supabase
      .from('agents')
      .select('*, projects(user_id)')
      .eq('id', agentId)
      .single();

    if (agentError) throw new Error('Agente no encontrado.');
    if (agentData.projects.user_id !== userId) {
      return res.status(403).send({ error: 'Usuario no autorizado para este agente' });
    }

    // --- 2. Validación de Lógica ---
    // ¡CRÍTICO! No se puede desplegar un puente sin un agent_id de ElevenLabs
    if (!agentData.elevenlabs_agent_id) {
      return res.status(400).send({ error: 'El agente debe ser desplegado en ElevenLabs primero (Paso 1).' });
    }
    // No volver a desplegar si ya tiene uno
    if (agentData.digitalocean_app_id) {
      return res.status(400).send({ error: 'Este agente ya tiene un puente desplegado.' });
    }

    agent = agentData; // Guardamos el agente para el manejo de errores

    // --- 3. Actualizar Estado en DB ---
    await supabase
      .from('agents')
      .update({ status: 'DEPLOYING_BRIDGE' }) // Un nuevo estado para la UI
      .eq('id', agent.id);

    // --- 4. Crear la Especificación de Despliegue ---
    // Usar el nombre del agente, limpiándolo para cumplir con las reglas de DigitalOcean:
    // - Solo letras minúsculas, números y guiones
    // - Máximo 32 caracteres
    let appName = agent.agent_name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Reemplazar caracteres no permitidos por guiones
      .replace(/-+/g, '-') // Eliminar guiones duplicados
      .replace(/^-|-$/g, '') // Eliminar guiones al inicio o final
      .substring(0, 32); // Limitar a 32 caracteres
    
    // Si el nombre queda vacío o muy corto, usar un fallback
    if (!appName || appName.length < 3) {
      const shortId = agent.id.substring(0, 8);
      appName = `agent-${shortId}`;
    }
    
    console.log(`Nombre de la app en DigitalOcean: ${appName}`);
    
    const appSpec = {
      name: appName,
      region: 'nyc', // Región de Nueva York
      services: [
        {
          name: 'bridge-service',
          github: {
            repo: 'abetancurultim/agent-bridge-template', // Tu repositorio
            branch: 'main',
            deploy_on_push: true,
          },
          run_command: 'npm start',
          environment_slug: 'node-js',
          instance_size_slug: 'basic-xxs',
          instance_count: 1,
          http_port: 8080,
          envs: [
            // --- Las 2 únicas claves que necesitas por ahora ---
            { 
              key: 'ELEVENLABS_API_KEY', 
              value: process.env.ELEVENLABS_API_KEY, 
              type: 'SECRET',
              scope: 'RUN_TIME'
            },
            { 
              key: 'ELEVENLABS_AGENT_ID', 
              value: agent.elevenlabs_agent_id,
              type: 'GENERAL',
              scope: 'RUN_TIME'
            },
          ],
        },
      ],
    };

    // --- 5. Llamar a la API de DigitalOcean ---
    console.log('Creando app en DigitalOcean...');
    const createResponse = await doAxios.post('/apps', { spec: appSpec });
    const app = createResponse.data.app;
    console.log('App creada con ID:', app.id);

    // --- 6. Esperar a que el Despliegue esté ACTIVO ---
    let liveUrl = null;
    let attempts = 0;
    console.log('Esperando a que la app esté activa...');
    
    while (!liveUrl && attempts < 60) { // Timeout de 5 minutos
        const getResponse = await doAxios.get(`/apps/${app.id}`);
        const checkingApp = getResponse.data.app;
        
        console.log(`Intento ${attempts + 1}: Status = ${checkingApp.active_deployment?.phase || 'PENDING'}`);
        
        // Solo continuamos cuando el despliegue esté 100% ACTIVO
        if (checkingApp.active_deployment?.phase === 'ACTIVE' && checkingApp.live_url) {
            liveUrl = checkingApp.live_url;
            break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 seg
        attempts++;
    }

    if (!liveUrl) {
        throw new Error('Fallo al obtener la URL de DigitalOcean después de 5 minutos.');
    }
    
    console.log('App activa en:', liveUrl);

    // --- 7. ¡Éxito! Guardar en Supabase ---
    const { data: finalAgent } = await supabase
      .from('agents')
      .update({
        status: 'PUBLISHED', // ¡Estado final!
        digitalocean_app_id: app.id,
        deployment_url: liveUrl, // Ej: https://agent-bridge-uuid.ondigitalocean.app
      })
      .eq('id', agent.id)
      .select()
      .single();

    // Devolvemos el agente con la URL al frontend
    res.status(200).send(finalAgent); 

  } catch (error) {
    // --- Manejo de Errores ---
    console.error('Fallo al desplegar el puente:', error);
    if (agent && agent.id) {
      await supabase
        .from('agents')
        .update({ status: 'ERROR' }) // Revertir estado
        .eq('id', agent.id);
    }
    res.status(500).send({ error: 'Fallo el despliegue del puente', details: error.message });
  }
};