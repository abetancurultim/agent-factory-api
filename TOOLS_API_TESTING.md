# 🧪 Guía de Testing - Tools API

## Endpoints Implementados

### 1. GET /api/tools
**Descripción:** Obtener catálogo completo de tools disponibles

**Request:**
```http
GET http://localhost:8091/api/tools
Authorization: Bearer <your-firebase-token>
```

**Response esperado:**
```json
[
  {
    "id": "uuid",
    "name": "send_email",
    "description": "Envía un correo electrónico...",
    "deployment_url": "https://...",
    "schema_template": { ... },
    "created_at": "2025-11-10T..."
  }
]
```

---

### 2. GET /api/projects/:projectId/agents/:agentId/tools
**Descripción:** Obtener todas las tools conectadas a un agente específico

**Request:**
```http
GET http://localhost:8091/api/projects/{projectId}/agents/{agentId}/tools
Authorization: Bearer <your-firebase-token>
```

**Response esperado:**
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

---

### 3. POST /api/projects/:projectId/agents/:agentId/tools
**Descripción:** Conectar una tool a un agente

**Request:**
```http
POST http://localhost:8091/api/projects/{projectId}/agents/{agentId}/tools
Authorization: Bearer <your-firebase-token>
Content-Type: application/json

{
  "tool_id": "uuid-de-la-tool",
  "position": { "x": 500, "y": 200 }
}
```

**Response esperado:**
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

**Errores posibles:**
- `400`: tool_id faltante o position inválida
- `404`: Tool no encontrada
- `409`: Tool ya conectada a este agente

---

### 4. PUT /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId
**Descripción:** Actualizar configuración de una tool conectada

**Request:**
```http
PUT http://localhost:8091/api/projects/{projectId}/agents/{agentId}/tools/{toolConnectionId}
Authorization: Bearer <your-firebase-token>
Content-Type: application/json

{
  "config": {
    "to_email": "supervisor@empresa.com",
    "subject_template": "Nueva Cita - {{nombre}}",
    "body_template": "<div>Hola {{nombre}}, tu cita está confirmada.</div>"
  },
  "position": { "x": 550, "y": 250 }
}
```

**Response esperado:**
```json
{
  "id": "uuid",
  "config": { ... },
  "position": { ... },
  "is_enabled": true,
  "updated_at": "2025-11-10T..."
}
```

**Errores posibles:**
- `400`: Config inválida o campos requeridos faltantes
- `404`: Tool connection no encontrada

---

### 5. DELETE /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId
**Descripción:** Eliminar una tool del agente

**Request:**
```http
DELETE http://localhost:8091/api/projects/{projectId}/agents/{agentId}/tools/{toolConnectionId}
Authorization: Bearer <your-firebase-token>
```

**Response esperado:**
```json
{
  "success": true
}
```

---

### 6. PATCH /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/toggle
**Descripción:** Habilitar/deshabilitar una tool sin eliminarla

**Request:**
```http
PATCH http://localhost:8091/api/projects/{projectId}/agents/{agentId}/tools/{toolConnectionId}/toggle
Authorization: Bearer <your-firebase-token>
Content-Type: application/json

{
  "is_enabled": false
}
```

**Response esperado:**
```json
{
  "id": "uuid",
  "is_enabled": false
}
```

---

### 7. POST /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/test
**Descripción:** Probar una tool enviando datos de prueba al microservicio

**Request:**
```http
POST http://localhost:8091/api/projects/{projectId}/agents/{agentId}/tools/{toolConnectionId}/test
Authorization: Bearer <your-firebase-token>
Content-Type: application/json

{
  "test_data": {
    "nombre": "Juan Pérez Test",
    "telefono": "555-1234",
    "email_cliente": "juan@test.com",
    "necesidad": "Limpieza dental"
  }
}
```

**Response esperado (éxito):**
```json
{
  "success": true,
  "message": "Test executed successfully",
  "response": { ... }
}
```

**Response esperado (error):**
```json
{
  "success": false,
  "error": "Failed to execute tool: Invalid recipient"
}
```

---

## Orden de Testing Recomendado

1. **GET /api/tools** → Obtener el ID de la tool `send_email`
2. **POST .../tools** → Conectar la tool a tu agente
3. **GET .../tools** → Verificar que aparece la tool conectada
4. **PUT .../tools/:id** → Configurar con datos válidos:
   ```json
   {
     "config": {
       "to_email": "tu-email@test.com",
       "subject_template": "Test - {{nombre}}",
       "body_template": "<div>Hola {{nombre}}, esto es una prueba.</div>"
     }
   }
   ```
5. **POST .../tools/:id/test** → Enviar email de prueba y verificar inbox
6. **PATCH .../tools/:id/toggle** → Deshabilitar tool
7. **DELETE .../tools/:id** → Eliminar tool

---

## Variables de Entorno Necesarias

Asegúrate de tener en tu `.env`:
```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
FIREBASE_PROJECT_ID=your-project-id
# ... otras vars de Firebase
```

---

## Notas Importantes

1. **Autenticación:** Necesitas un token de Firebase válido en todos los endpoints
2. **Ownership:** El sistema valida que el usuario autenticado sea dueño del proyecto
3. **Timeout:** Los tests de tools tienen un timeout de 10 segundos
4. **Schema validation:** Los campos marcados como `required: true` y `value_type: "constant_value"` son obligatorios en la configuración

---

## Errores Comunes

### 401 Unauthorized
- Token no proporcionado o inválido
- Verifica que el header `Authorization: Bearer <token>` esté presente

### 403 Forbidden
- No eres dueño del proyecto/agente
- Verifica que el `projectId` y `agentId` correspondan a tu usuario

### 404 Not Found
- Agent, tool o connection no encontrados
- Verifica los IDs en la URL

### 409 Conflict
- La tool ya está conectada al agente
- Verifica con GET antes de conectar

### 400 Bad Request
- Configuración inválida o campos faltantes
- Revisa el schema de la tool y completa todos los campos requeridos
