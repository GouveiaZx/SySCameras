const { 
  getAlertConfigurations, 
  createAlertConfiguration, 
  updateAlertConfiguration, 
  deleteAlertConfiguration 
} = require('../controllers/alerts');

const { 
  authenticate, 
  isAdmin, 
  isIntegrator, 
  isClient 
} = require('../middlewares/auth');

// Esquemas para validação do Fastify
const alertConfigSchema = {
  type: 'object',
  properties: {
    cameraId: { type: 'string' },
    emailAddresses: { 
      type: 'array',
      items: { type: 'string', format: 'email' } 
    },
    notifyOnline: { type: 'boolean' },
    notifyOffline: { type: 'boolean' },
    targetUserId: { type: 'string' }
  },
  required: ['cameraId', 'emailAddresses']
};

const updateAlertConfigSchema = {
  type: 'object',
  properties: {
    emailAddresses: { 
      type: 'array',
      items: { type: 'string', format: 'email' } 
    },
    notifyOnline: { type: 'boolean' },
    notifyOffline: { type: 'boolean' }
  }
};

/**
 * Rotas de alertas para o Fastify
 * @param {FastifyInstance} fastify - Instância do Fastify
 * @param {Object} options - Opções do plugin
 */
async function alertRoutes(fastify, options) {
  // Middleware de autenticação para todas as rotas de alertas
  fastify.addHook('preHandler', authenticate);
  
  // Lista configurações de alertas
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          cameraId: { type: 'string' }
        }
      }
    },
    handler: getAlertConfigurations
  });
  
  // Criar nova configuração de alerta (apenas integradores)
  fastify.post('/', {
    schema: {
      body: alertConfigSchema
    },
    preHandler: isIntegrator,
    handler: createAlertConfiguration
  });
  
  // Atualizar configuração de alerta existente
  fastify.put('/:id', {
    schema: {
      body: updateAlertConfigSchema,
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    },
    handler: updateAlertConfiguration
  });
  
  // Excluir configuração de alerta
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    },
    handler: deleteAlertConfiguration
  });
}

module.exports = alertRoutes; 