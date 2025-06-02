/**
 * Configura o Swagger para documentação OpenAPI
 * @param {import('fastify').FastifyInstance} fastify Instância do Fastify
 */
async function configureSwagger(fastify) {
  // Verificar se estamos em ambiente de desenvolvimento
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (!isDevelopment) {
    console.log('Swagger desativado em ambiente de produção');
    return;
  }
  
  // Configuração básica do Swagger
  await fastify.register(require('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'API de Sistema de Vigilância IP',
        description: 'Documentação da API para o Sistema de Vigilância IP',
        version: '1.0.0'
      },
      host: process.env.API_HOST || 'localhost:3000',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'auth', description: 'Endpoints de autenticação' },
        { name: 'users', description: 'Operações relacionadas a usuários' },
        { name: 'cameras', description: 'Operações relacionadas a câmeras' },
        { name: 'recordings', description: 'Operações relacionadas a gravações' },
        { name: 'alerts', description: 'Operações relacionadas a alertas' },
        { name: 'stream', description: 'Operações relacionadas a streaming' },
        { name: 'admin', description: 'Operações administrativas' }
      ],
      securityDefinitions: {
        apiKey: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header'
        }
      }
    }
  });

  // Configuração da UI do Swagger
  await fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    },
    uiHooks: {
      onRequest: function(request, reply, next) {
        // Bloqueio adicional de segurança caso NODE_ENV seja alterado em produção
        if (process.env.DISABLE_DOCS === 'true') {
          return reply.status(404).send({ error: 'Documentação não disponível' });
        }
        next();
      }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });

  // Log para facilitar o acesso durante o desenvolvimento
  fastify.ready(() => {
    console.log('Documentação Swagger disponível em: /documentation');
  });
}

module.exports = { configureSwagger }; 