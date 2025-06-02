import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware para verificar se o usuário é um administrador
 */
export async function isAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  
  if (!user) {
    return reply.status(401).send({ error: 'Não autenticado' });
  }
  
  if (user.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Acesso restrito a administradores' });
  }
}

/**
 * Middleware para verificar se o usuário é um integrador ou administrador
 */
export async function isIntegratorOrAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  
  if (!user) {
    return reply.status(401).send({ error: 'Não autenticado' });
  }
  
  if (user.role !== 'ADMIN' && user.role !== 'INTEGRATOR') {
    return reply.status(403).send({ error: 'Acesso restrito a administradores e integradores' });
  }
}

/**
 * Middleware para verificar se o usuário tem acesso a um recurso específico
 * (Permite acesso se for admin, ou se for proprietário do recurso)
 * @param resourceAccessFunc Função para verificar acesso do usuário ao recurso
 */
export function hasResourceAccess(
  resourceAccessFunc: (user: any, request: FastifyRequest) => Promise<boolean>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    
    // Administradores têm acesso a tudo
    if (user.role === 'ADMIN') {
      return;
    }
    
    // Para outros papéis, verificar acesso específico
    const hasAccess = await resourceAccessFunc(user, request);
    
    if (!hasAccess) {
      return reply.status(403).send({ error: 'Sem permissão para acessar este recurso' });
    }
  };
} 