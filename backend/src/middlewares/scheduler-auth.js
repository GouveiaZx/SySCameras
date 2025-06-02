/**
 * Middleware de autenticação para o agendador de tarefas
 * Verifica se a requisição contém um token válido para o agendador
 * @param {Object} request - Objeto de requisição do Fastify
 * @param {Object} reply - Objeto de resposta do Fastify
 */
async function schedulerAuth(request, reply) {
  try {
    // Obter o token do header Authorization
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Token de autenticação não fornecido'
      });
    }
    
    // Extrair o token do header
    const token = authHeader.substring(7);
    
    // Verificar se o token corresponde ao token do agendador
    const schedulerToken = process.env.SCHEDULER_API_KEY || 'scheduler-token';
    
    if (token !== schedulerToken) {
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Token de agendador inválido'
      });
    }
    
    // Simular usuário admin para o agendador
    request.user = {
      id: 'scheduler',
      role: 'ADMIN'
    };
    
  } catch (error) {
    console.error('Erro de autenticação do agendador:', error);
    return reply.code(401).send({ 
      error: 'Não autorizado',
      message: error.message || 'Token de autenticação inválido'
    });
  }
}

module.exports = { schedulerAuth }; 