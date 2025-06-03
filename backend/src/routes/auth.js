const { register, login, getUserProfile } = require('../controllers/auth');
const { authenticate } = require('../middlewares/auth');
const { sendTestEmail } = require('../services/emailService');

// Esquemas para validação do Fastify
const userSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6 },
    name: { type: 'string', minLength: 2 },
    role: { type: 'string', enum: ['ADMIN', 'INTEGRATOR', 'CLIENT'] },
    integratorId: { type: 'string' }
  },
  required: ['email', 'password', 'name']
};

const loginSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6 }
  }
};

/**
 * Rotas de autenticação para o Fastify
 * @param {FastifyInstance} fastify - Instância do Fastify
 * @param {Object} options - Opções do plugin
 */
async function authRoutes(fastify, options) {
  // Rota para registro
  fastify.post('/register', {
    schema: {
      body: userSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        }
      }
    },
    handler: register
  });
  
  // Rota para login
  fastify.post('/login', {
    schema: {
      body: loginSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        }
      }
    },
    handler: login
  });
  
  // Rota para perfil do usuário (protegida)
  fastify.get('/profile', {
    preHandler: authenticate,
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        }
      }
    },
    handler: getUserProfile
  });

  // Endpoint de teste para verificar autenticação
  fastify.get('/test-auth', { preValidation: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user;
      
      return reply.code(200).send({
        success: true,
        message: 'Autenticação válida',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Erro no teste de autenticação:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Erro ao verificar autenticação'
      });
    }
  });

  // Logout endpoint
  fastify.post('/logout', { preValidation: [authenticate] }, async (request, reply) => {
    try {
      // Para JWT, logout é principalmente do lado do cliente
      // Aqui só confirmamos que foi executado
      return reply.code(200).send({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    } catch (error) {
      console.error('Erro no logout:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Erro ao realizar logout'
      });
    }
  });

  // Rota para teste de email
  fastify.post('/test-email', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email']
      }
    },
    handler: async (request, reply) => {
      try {
        const { email } = request.body;
        
        console.log(`📧 Iniciando teste de email para: ${email}`);
        
        const result = await sendTestEmail(email);
        
        if (result.success) {
          return reply.code(200).send({
            success: true,
            message: 'E-mail de teste enviado com sucesso',
            messageId: result.messageId
          });
        } else {
          return reply.code(500).send({
            success: false,
            error: 'Falha ao enviar e-mail de teste',
            details: result.error
          });
        }
        
      } catch (error) {
        console.error('❌ Erro no teste de email:', error);
        return reply.code(500).send({
          success: false,
          error: 'Erro interno',
          message: error.message
        });
      }
    }
  });
}

module.exports = authRoutes; 