const { 
  getRecordings, 
  getRecordingById, 
  updateRetentionSetting 
} = require('../controllers/recordings');

const { 
  authenticate, 
  isAdmin, 
  isIntegrator, 
  isClient 
} = require('../middlewares/auth');

// Esquemas para validação do Fastify
const retentionSchema = {
  type: 'object',
  properties: {
    days: { type: 'integer', minimum: 1, maximum: 60 }
  },
  required: ['days']
};

const queryParamsSchema = {
  type: 'object',
  properties: {
    cameraId: { type: 'string' },
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' },
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100 }
  }
};

/**
 * Rotas de gravações para o Fastify
 * @param {FastifyInstance} fastify - Instância do Fastify
 * @param {Object} options - Opções do plugin
 */
async function recordingRoutes(fastify, options) {
  // Middleware de autenticação para todas as rotas de gravações
  fastify.addHook('preHandler', authenticate);
  
  // Lista gravações (filtrada por permissões)
  fastify.get('/', {
    schema: {
      querystring: queryParamsSchema
    },
    preHandler: isClient, // Pelo menos cliente
    handler: getRecordings
  });
  
  // Obter uma gravação específica
  fastify.get('/:id', {
    preHandler: isClient, // Pelo menos cliente
    handler: getRecordingById
  });
  
  // Atualizar configuração de retenção para uma câmera
  fastify.put('/retention/:cameraId', {
    schema: {
      body: retentionSchema
    },
    preHandler: isIntegrator, // Pelo menos integrador
    handler: updateRetentionSetting
  });
}

module.exports = recordingRoutes; 