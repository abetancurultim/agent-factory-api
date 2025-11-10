/**
 * Valida la configuración de una tool contra su schema template
 * @param {Object|String} schemaTemplate - El schema template de la tool
 * @param {Object} config - La configuración a validar
 * @returns {Boolean} - true si la configuración es válida
 * @throws {Error} - Si falta algún campo requerido
 */
export const validateToolConfig = (schemaTemplate, config) => {
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

/**
 * Valida el formato de un email
 * @param {String} email - El email a validar
 * @returns {Boolean} - true si el email es válido
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
