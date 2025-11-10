# 🔧 Ejemplos de cURL para Testing

## Variables de Entorno
```bash
export TOKEN="your-firebase-token-here"
export PROJECT_ID="your-project-id"
export AGENT_ID="your-agent-id"
export TOOL_ID="tool-uuid-from-admin_tools"
export CONNECTION_ID="connection-uuid-from-agent_tools"
```

---

## 1. GET /api/tools
Obtener catálogo de tools disponibles

```bash
curl -X GET http://localhost:8091/api/tools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 2. GET /api/projects/:projectId/agents/:agentId/tools
Obtener tools conectadas a un agente

```bash
curl -X GET "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 3. POST /api/projects/:projectId/agents/:agentId/tools
Conectar una tool a un agente

```bash
curl -X POST "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_id": "'$TOOL_ID'",
    "position": { "x": 500, "y": 200 }
  }'
```

---

## 4. PUT /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId
Actualizar configuración de una tool

```bash
curl -X PUT "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "to_email": "supervisor@empresa.com",
      "subject_template": "Nuevo Lead - {{nombre}}",
      "body_template": "<div>Hola {{nombre}}, tienes un nuevo lead. Teléfono: {{telefono}}</div>"
    },
    "position": { "x": 550, "y": 250 }
  }'
```

---

## 5. DELETE /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId
Eliminar una tool del agente

```bash
curl -X DELETE "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 6. PATCH /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/toggle
Habilitar/deshabilitar una tool

```bash
# Deshabilitar
curl -X PATCH "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID/toggle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": false
  }'

# Habilitar
curl -X PATCH "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID/toggle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": true
  }'
```

---

## 7. POST /api/projects/:projectId/agents/:agentId/tools/:toolConnectionId/test
Probar una tool con datos de prueba

```bash
curl -X POST "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "test_data": {
      "nombre": "Juan Pérez Test",
      "telefono": "555-1234",
      "email_cliente": "juan@test.com",
      "necesidad": "Limpieza dental"
    }
  }'
```

---

## Script de Testing Completo

```bash
#!/bin/bash

# Configuración
export TOKEN="your-firebase-token-here"
export PROJECT_ID="your-project-id"
export AGENT_ID="your-agent-id"

echo "=== 1. Obteniendo catálogo de tools ==="
TOOLS_RESPONSE=$(curl -s -X GET http://localhost:8091/api/tools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo $TOOLS_RESPONSE | jq '.'

# Extraer el ID de la primera tool
export TOOL_ID=$(echo $TOOLS_RESPONSE | jq -r '.[0].id')
echo "Tool ID: $TOOL_ID"

echo -e "\n=== 2. Conectando tool al agente ==="
CONNECTION_RESPONSE=$(curl -s -X POST "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"tool_id\": \"$TOOL_ID\",
    \"position\": { \"x\": 500, \"y\": 200 }
  }")

echo $CONNECTION_RESPONSE | jq '.'

# Extraer el ID de la conexión
export CONNECTION_ID=$(echo $CONNECTION_RESPONSE | jq -r '.id')
echo "Connection ID: $CONNECTION_ID"

echo -e "\n=== 3. Verificando tools conectadas ==="
curl -s -X GET "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo -e "\n=== 4. Configurando la tool ==="
curl -s -X PUT "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "to_email": "test@empresa.com",
      "subject_template": "Test - {{nombre}}",
      "body_template": "<div>Hola {{nombre}}, esto es una prueba.</div>"
    }
  }' | jq '.'

echo -e "\n=== 5. Probando la tool ==="
curl -s -X POST "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "test_data": {
      "nombre": "Test User",
      "telefono": "555-0000"
    }
  }' | jq '.'

echo -e "\n=== 6. Deshabilitando la tool ==="
curl -s -X PATCH "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID/toggle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": false
  }' | jq '.'

echo -e "\n=== 7. Eliminando la tool ==="
curl -s -X DELETE "http://localhost:8091/api/projects/$PROJECT_ID/agents/$AGENT_ID/tools/$CONNECTION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo -e "\n✅ Testing completado!"
```

---

## Notas

- Requiere `jq` instalado para parsear JSON: `brew install jq`
- Reemplaza las variables de entorno con tus valores reales
- El script completo asume que ya tienes un proyecto y un agente creados
- Para obtener el token de Firebase, autentícate en tu frontend y copia el token del localStorage o de las dev tools

---

## Testing Manual Paso a Paso

### Paso 1: Obtener token
Autentícate en tu frontend y obtén el Firebase token

### Paso 2: Obtener IDs
```bash
# Listar proyectos (endpoint existente)
curl -X GET http://localhost:8091/api/projects \
  -H "Authorization: Bearer $TOKEN"

# Listar agentes (endpoint existente, ajustar según tu API)
curl -X GET "http://localhost:8091/api/projects/$PROJECT_ID/agents" \
  -H "Authorization: Bearer $TOKEN"
```

### Paso 3: Ejecutar comandos
Usa los comandos individuales de arriba, reemplazando las variables

### Paso 4: Verificar resultados
- Revisa los códigos de respuesta (200, 201, 400, etc.)
- Verifica que los datos se guardan en Supabase
- Prueba el endpoint de test y verifica que llegue el email
