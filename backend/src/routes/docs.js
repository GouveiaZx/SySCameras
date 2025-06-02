/**
 * Rotas relacionadas à documentação e metadados da API
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function docsRoutes(fastify) {
  // Rota para verificar a versão da API e status
  fastify.get('/version', {
    schema: {
      tags: ['docs'],
      summary: 'Obtém a versão atual da API',
      description: 'Retorna informações sobre a versão atual da API e seu status',
      response: {
        200: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    handler: async () => {
      return {
        version: '1.0.0',
        name: 'API de Sistema de Vigilância IP',
        status: 'online',
        timestamp: new Date().toISOString()
      };
    }
  });
}

module.exports = docsRoutes; 