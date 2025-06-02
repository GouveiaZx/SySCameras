const { verifyToken, getUserProfile } = require('../services/supabase');

/**
 * Middleware de autenticação que verifica o token JWT
 * @param {Object} request - Objeto de requisição do Fastify
 * @param {Object} reply - Objeto de resposta do Fastify
 */
async function authenticate(request, reply) {
  try {
    console.log('🔐 Iniciando autenticação...');
    
    // Obter o token do header Authorization
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Token não fornecido');
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Token de autenticação não fornecido'
      });
    }
    
    // Extrair o token do header
    const token = authHeader.substring(7);
    console.log('🔑 Token extraído, verificando...');
    
    // Verificar o token JWT
    const user = await verifyToken(token);
    console.log('✅ Token válido, usuário:', user.id);
    
    // Obter o perfil completo do usuário
    const userProfile = await getUserProfile(user.id);
    console.log('👤 Perfil do usuário:', userProfile.role);
    
    // Armazenar o usuário na requisição para uso posterior
    request.user = {
      ...user,
      role: userProfile.role
    };
    
    console.log('✅ Autenticação concluída com sucesso');
    
  } catch (error) {
    console.error('❌ Erro de autenticação:', error);
    
    // Verificar se é erro de token expirado ou inválido
    let message = 'Token de autenticação inválido';
    
    if (error.message.includes('invalid JWT') || error.message.includes('signature is invalid')) {
      message = 'Token de autenticação inválido ou expirado';
    } else if (error.message.includes('expired')) {
      message = 'Token de autenticação expirado. Faça login novamente.';
    }
    
    return reply.code(401).send({ 
      error: 'Não autorizado',
      message: message,
      debug: error.message.includes('invalid JWT') ? `Erro Supabase: ${error.message}` : undefined
    });
  }
}

/**
 * Middleware que verifica se o usuário tem a role necessária
 * @param {Array<string>} roles - Array de roles permitidas
 */
function checkRole(roles) {
  return async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ 
          error: 'Não autorizado',
          message: 'Usuário não autenticado'
        });
      }
      
      const userRole = request.user.role;
      
      if (!roles.includes(userRole)) {
        return reply.code(403).send({ 
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar este recurso'
        });
      }
      
    } catch (error) {
      console.error('Erro ao verificar role:', error);
      return reply.code(500).send({ 
        error: 'Erro interno',
        message: 'Erro ao verificar permissões do usuário'
      });
    }
  };
}

// Funções auxiliares para verificar roles específicas
const isAdmin = checkRole(['ADMIN']);
const isIntegrator = checkRole(['ADMIN', 'INTEGRATOR']);
const isClient = checkRole(['ADMIN', 'INTEGRATOR', 'CLIENT']);

module.exports = {
  authenticate,
  checkRole,
  isAdmin,
  isIntegrator,
  isClient
}; 