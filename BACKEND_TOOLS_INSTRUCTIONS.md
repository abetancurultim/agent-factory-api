# 🔧 Tarea: Implementar Sistema de Tools para Agentes

## Contexto

Necesito que implementes un sistema completo de gestión de "tools" (herramientas) que se pueden conectar a los agentes de IA. Las tools son servicios externos (como `send_email`) que el agente puede ejecutar durante las llamadas.

Ya existen dos tablas en Supabase:
- **`admin_tools`**: Catálogo maestro de tools disponibles (ya tiene una fila con `send_email`)
- **`agent_tools`**: Relación many-to-many entre agentes y tools, con configuración específica

## Estructura de Datos Importantes

### Tabla `admin_tools`
```
- id (uuid)
- name (varchar) - ej: "send_email"
- description (text)
- deployment_url (varchar) - URL del microservicio
- schema_template (jsonb) - Schema completo de la tool
- created_at
```

### Tabla `agent_tools`
```
- id (uuid)
- agent_id (uuid) - FK a agents
- tool_id (uuid) - FK a admin_tools
- config (jsonb) - Configuración específica del usuario
- position (jsonb) - { x: number, y: number }
- is_enabled (boolean)
- created_at
- updated_at
```

### Estructura del `schema_template`

El schema_template en `admin_tools` tiene este formato:
```json
{
  "name": "send_email",
  "type": "webhook",
  "api_schema": {
    "method": "POST",
    "request_body_schema": {
      "properties": [
        "-- (Parámetros de Configuración) --",
        {
          "id": "to_email",
          "type": "string",
          "required": true,
          "value_type": "constant_value",
          "description": "Email del destinatario principal"
        },
        {
          "id": "subject_template",
          "type": "string",
          "required": true,
          "value_type": "constant_value",
          "description": "Plantilla para el asunto"
        },
        {
          "id": "body_template",
          "type": "string",
          "required": true,
          "value_type": "constant_value",
          "description": "Plantilla HTML para el cuerpo"
        },
        "-- (Parámetros Dinámicos para el LLM) --",
        {
          "id": "nombre",
          "type": "string",
          "required": false,
          "value_type": "llm_prompt",
          "description": "Nombre del cliente"
        },
        {
          "id": "telefono",
          "type": "string",
          "required": false,
          "value_type": "llm_prompt",
          "description": "Teléfono del cliente"
        }
      ]
    }
  }
}
```

**Importante:** Los campos con `value_type: "constant_value"` se configuran por el usuario y se guardan en `agent_tools.config`. Los campos con `value_type: "llm_prompt"` se extraen durante la llamada por el LLM.

## Endpoints a Implementar

### 1. GET /api/tools
**Descripción:** Obtener catálogo completo de tools disponibles

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "send_email",
    "description": "Envía un correo electrónico...",
    "deployment_url": "https://...",
    "schema_template": { ... }
  }
]
```

**Lógica:**
- Consultar tabla `admin_tools`
- Retornar todas las rows
- No requiere autenticación de proyecto específico

---

### 2. GET /api/projects/:projectId/agents/:agentId/tools
**Descripción:** Obtener todas las tools conectadas a un agente específico

**Response:**
```json
[
  {
    "id": "uuid",
    "tool_id": "uuid",
    "tool_name": "send_email",
    "tool_description": "Envía un correo...",
    "deployment_url": "https://...",
    "config": {
      "to_email": "supervisor@empresa.com",
      "subject_template": "Nuevo Lead - {{nombre}}",
      "body_template": "<div>...</div>"
    },
    "position": { "x": 500, "y": 200 },
    "is_enabled": true,
    "created_at": "2025-11-10T..."
  }
]
```

**Lógica:**
1. Validar que el usuario autenticado es dueño del proyecto (via `agents.project_id -> projects.user_id`)
2. JOIN entre `agent_tools` y `admin_tools`:
   ```sql
   SELECT 
     agent_tools.id,
     agent_tools.tool_id,
     admin_tools.name as tool_name,
     admin_tools.description as tool_description,
     admin_tools.deployment_url,
     agent_tools.config,
     agent_tools.position,
     agent_tools.is_enabled,
     agent_tools.created_at
   FROM agent_tools
   JOIN admin_tools ON admin_tools.id = agent_tools.tool_id
   WHERE agent_tools.agent_id = $agentId
   ORDER BY agent_tools.created_at ASC
   ```
3. Retornar array (puede estar vacío si no tiene tools)

---

### 3. POST /api/projects/:projectId/agents/:agentId/tools
**Descripción:** Conectar una tool a un agente

**Body:**
```json
{
  "tool_id": "uuid",
  "position": { "x": 500, "y": 200 }
}
```

**Response:**
```json
{
  "id": "uuid",
  "tool_id": "uuid",
  "agent_id": "uuid",
  "config": {},
  "position": { "x": 500, "y": 200 },
  "is_enabled": false,
  "created_at": "2025-11-10T..."
}
```

**Lógica:**
1. Validar ownership del agente
2. Validar que `tool_id` existe en `admin_tools`
3. Verificar que no exista ya esa combinación `agent_id + tool_id` (UNIQUE constraint)
4. INSERT en `agent_tools`:
   - `agent_id`: del parámetro
   - `tool_id`: del body
   - `config`: `{}` (objeto vacío)
   - `position`: del body
   - `is_enabled`: `false` (hasta que se configure)
5. Retornar la row creada

**Validaciones:**
- `tool_id` es requerido
- `position` debe ser objeto con `x` y `y` numéricos
- Si ya existe, retornar error 409: "Tool already connected to this agent"

---

### 4. PUT /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId
**Descripción:** Actualizar configuración de una tool conectada

**Body:**
```json
{
  "config": {
    "to_email": "supervisor@empresa.com",
    "cc_email": "copia@empresa.com",
    "subject_template": "Nueva Cita - {{nombre}}",
    "body_template": "<div>...</div>"
  },
  "position": { "x": 550, "y": 250 }
}
```

**Response:**
```json
{
  "id": "uuid",
  "config": { ... },
  "position": { ... },
  "is_enabled": true,
  "updated_at": "2025-11-10T..."
}
```

**Lógica:**
1. Validar ownership del agente
2. Obtener la tool de `admin_tools` (via `agent_tools.tool_id`)
3. **Validar configuración:**
   - Obtener `schema_template.api_schema.request_body_schema.properties`
   - Filtrar campos con `value_type: "constant_value"` y `required: true`
   - Verificar que todos esos campos existen en `config`
   - Si falta alguno, retornar error 400: "Missing required fields: to_email, subject_template"
4. **Validar formato de emails:**
   - Si hay campos de tipo email, validar formato con regex básico
5. UPDATE en `agent_tools`:
   - `config`: del body
   - `position`: del body (si viene)
   - `is_enabled`: `true` (se habilita automáticamente si config es válida)
   - `updated_at`: NOW()
6. Retornar la row actualizada

**Validaciones:**
- `config` debe ser objeto
- Campos requeridos según schema
- Formato de emails válido

---

### 5. DELETE /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId
**Descripción:** Eliminar una tool del agente

**Response:**
```json
{
  "success": true
}
```

**Lógica:**
1. Validar ownership del agente
2. DELETE FROM `agent_tools` WHERE id = toolConnectionId AND agent_id = agentId
3. Retornar `{ success: true }`

---

### 6. PATCH /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/toggle
**Descripción:** Habilitar/deshabilitar una tool sin eliminarla

**Body:**
```json
{
  "is_enabled": false
}
```

**Response:**
```json
{
  "id": "uuid",
  "is_enabled": false
}
```

**Lógica:**
1. Validar ownership
2. UPDATE `agent_tools` SET is_enabled = $isEnabled WHERE id = toolConnectionId
3. Retornar la row actualizada

---

### 7. POST /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/test
**Descripción:** Probar una tool enviando datos de prueba al microservicio

**Body:**
```json
{
  "test_data": {
    "nombre": "Juan Pérez Test",
    "telefono": "555-1234",
    "email_cliente": "juan@test.com",
    "necesidad": "Limpieza dental"
  }
}
```

**Response (éxito):**
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "response": { ... }
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Failed to send email: Invalid recipient"
}
```

**Lógica:**
1. Validar ownership
2. Obtener `agent_tools` row (incluir JOIN con `admin_tools` para obtener `deployment_url`)
3. Obtener `config` de la tool (to_email, subject_template, body_template, etc.)
4. **Mergear config + test_data:**
   ```javascript
   const payload = {
     ...config,        // campos constant_value
     ...test_data      // campos llm_prompt (datos de prueba)
   };
   ```
5. **Hacer POST al microservicio:**
   ```javascript
   const response = await axios.post(deployment_url, payload, {
     headers: { 'Content-Type': 'application/json' },
     timeout: 10000  // 10 segundos
   });
   ```
6. Retornar resultado:
   - Si 2xx: `{ success: true, message: "...", response: response.data }`
   - Si error: `{ success: false, error: response.data.error || "Unknown error" }`

**Validaciones:**
- `test_data` debe ser objeto
- Tool debe estar configurada (config no vacío)
- Manejar timeouts y errores de red

---

## Validaciones Globales

### Función auxiliar: `validateToolConfig`
```javascript
const validateToolConfig = (schemaTemplate, config) => {
  // Parse schema si es string
  const schema = typeof schemaTemplate === 'string' 
    ? JSON.parse(schemaTemplate) 
    : schemaTemplate;
  
  // Obtener campos requeridos con constant_value
  const requiredFields = schema.api_schema.request_body_schema.properties
    .filter(prop => 
      typeof prop === 'object' && 
      prop.required === true && 
      prop.value_type === 'constant_value'
    )
    .map(prop => prop.id);
  
  // Verificar que todos estén presentes
  const missingFields = requiredFields.filter(field => !config[field] || config[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return true;
};
```

### Función auxiliar: `validateEmail`
```javascript
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

---

## Estructura de Archivos Sugerida

```
src/
  routes/
    tools.routes.js           # Nuevas rutas
  controllers/
    tools.controller.js       # Lógica de endpoints
  middleware/
    validateOwnership.js      # Validar que user es dueño del proyecto
  utils/
    toolValidation.js         # Funciones de validación
```

---

## Manejo de Errores

**Códigos de estado:**
- `200`: Éxito
- `201`: Recurso creado
- `400`: Bad request (validación fallida)
- `401`: No autenticado
- `403`: No autorizado (no es dueño)
- `404`: Recurso no encontrado
- `409`: Conflicto (tool ya conectada)
- `500`: Error interno

**Formato de errores:**
```json
{
  "error": "Mensaje descriptivo del error"
}
```

---

## Testing Recomendado

Usa Postman o Thunder Client para probar:
1. GET /api/tools → debe retornar la tool send_email
2. POST /api/.../tools → conectar tool a un agente
3. GET /api/.../tools → debe retornar array con la tool conectada
4. PUT /api/.../tools/:id → configurar con datos válidos
5. POST /api/.../tools/:id/test → enviar email de prueba (verificar inbox)
6. PATCH /api/.../tools/:id/toggle → deshabilitar tool
7. DELETE /api/.../tools/:id → eliminar tool

---

## Notas Importantes

1. **Autenticación:** Todos los endpoints (excepto GET /api/tools) requieren validar que el usuario autenticado es dueño del proyecto
2. **Schema parsing:** El `schema_template` en DB está en formato string JSON, asegúrate de parsearlo
3. **Sanitización:** No sanitices el HTML en backend, eso lo hace el frontend antes de guardar
4. **Timeout:** En el endpoint de test, usa timeout de 10-20 segundos máximo
5. **Logs:** Loguea los errores del microservicio para debugging

---

**¿Está claro? ¿Alguna duda antes de empezar?**
