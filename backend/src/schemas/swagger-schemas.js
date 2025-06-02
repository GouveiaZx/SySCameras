/**
 * Esquemas compartilhados para documentação do Swagger
 */

// Esquema de erro padrão
const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    details: { 
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  },
  required: ['error', 'message']
};

// Esquema para resposta de autenticação
const authResponseSchema = {
  type: 'object',
  properties: {
    token: { type: 'string' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' }
      }
    }
  },
  required: ['token', 'user']
};

// Esquema para câmera
const cameraSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    model: { type: 'string' },
    ipAddress: { type: 'string' },
    port: { type: 'integer' },
    username: { type: 'string' },
    password: { type: 'string' },
    active: { type: 'boolean' },
    location: { type: 'string' },
    streamUrl: { type: 'string' },
    motionDetection: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

// Esquema para gravação
const recordingSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    cameraId: { type: 'string' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    duration: { type: 'integer' },
    fileUrl: { type: 'string' },
    fileSize: { type: 'integer' },
    reason: { type: 'string', enum: ['scheduled', 'motion', 'manual'] },
    thumbnailUrl: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

// Esquema para alerta
const alertSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    cameraId: { type: 'string' },
    type: { type: 'string', enum: ['motion', 'disconnection', 'tamper', 'custom'] },
    message: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: ['new', 'acknowledged', 'resolved'] },
    metadata: { type: 'object' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

// Exportação dos esquemas
module.exports = {
  errorSchema,
  authResponseSchema,
  cameraSchema,
  recordingSchema,
  alertSchema
}; 