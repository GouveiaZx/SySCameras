import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middlewares/auth';

const prisma = new PrismaClient();

export default async function alertRoutes(fastify: FastifyInstance) {
  // Middleware de autenticação para todas as rotas
  fastify.addHook('onRequest', authenticate);

  // Listar alertas com filtros (por câmera, data, status)
  fastify.get('/api/alerts', async (request, reply) => {
    const { 
      cameraId, 
      startDate, 
      endDate, 
      status, 
      type,
      page = '1', 
      limit = '20' 
    } = request.query as { 
      cameraId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      type?: string;
      page?: string;
      limit?: string;
    };
    
    const userId = (request.user as any).id;
    const userRole = (request.user as any).role;

    try {
      // Construir query de filtro
      const where: any = {};
      
      // Filtro por câmera
      if (cameraId) {
        where.cameraId = cameraId;
      } else {
        // Se não for admin, filtrar por câmeras que o usuário tem acesso
        if (userRole !== 'ADMIN') {
          // Buscar câmeras do usuário
          if (userRole === 'INTEGRATOR') {
            const integrator = await prisma.integrator.findUnique({
              where: { userId },
              select: { id: true }
            });
            
            if (integrator) {
              where.camera = {
                integratorId: integrator.id
              };
            }
          } else if (userRole === 'CLIENT') {
            const client = await prisma.client.findUnique({
              where: { userId },
              select: { id: true }
            });
            
            if (client) {
              where.camera = {
                clientId: client.id
              };
            }
          }
        }
      }
      
      // Filtro por data
      if (startDate || endDate) {
        where.date = {};
        
        if (startDate) {
          where.date.gte = new Date(startDate);
        }
        
        if (endDate) {
          where.date.lte = new Date(endDate);
        }
      }
      
      // Filtro por status
      if (status) {
        where.status = status;
      }
      
      // Filtro por tipo
      if (type) {
        where.type = type;
      }
      
      // Paginação
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Executar query
      const [alerts, total] = await Promise.all([
        prisma.alert.findMany({
          where,
          include: {
            camera: {
              select: {
                name: true,
                client: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: {
            date: 'desc'
          },
          skip,
          take: limitNum
        }),
        prisma.alert.count({ where })
      ]);
      
      // Calcular total de páginas
      const totalPages = Math.ceil(total / limitNum);
      
      return reply.send({
        data: alerts,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages
        }
      });
    } catch (error) {
      console.error('Erro ao listar alertas:', error);
      return reply.status(500).send({ error: 'Erro interno ao listar alertas' });
    }
  });

  // Marcar alertas como lidos
  fastify.put('/api/alerts/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;
    
    try {
      // Buscar alerta
      const alert = await prisma.alert.findUnique({
        where: { id },
        include: {
          camera: true
        }
      });
      
      if (!alert) {
        return reply.status(404).send({ error: 'Alerta não encontrado' });
      }
      
      // Verificar permissões
      const userRole = (request.user as any).role;
      const isAdmin = userRole === 'ADMIN';
      
      if (!isAdmin) {
        const camera = alert.camera;
        
        if (userRole === 'INTEGRATOR') {
          const integrator = await prisma.integrator.findUnique({
            where: { userId },
            select: { id: true }
          });
          
          if (!integrator || camera.integratorId !== integrator.id) {
            return reply.status(403).send({ error: 'Sem permissão para este alerta' });
          }
        } else if (userRole === 'CLIENT') {
          const client = await prisma.client.findUnique({
            where: { userId },
            select: { id: true }
          });
          
          if (!client || camera.clientId !== client.id) {
            return reply.status(403).send({ error: 'Sem permissão para este alerta' });
          }
        }
      }
      
      // Atualizar status do alerta
      const updatedAlert = await prisma.alert.update({
        where: { id },
        data: {
          status: 'READ',
          readAt: new Date(),
          userId: userId
        }
      });
      
      return reply.send(updatedAlert);
    } catch (error) {
      console.error(`Erro ao marcar alerta como lido (${id}):`, error);
      return reply.status(500).send({ error: 'Erro interno ao marcar alerta como lido' });
    }
  });

  // Criar alerta manual (para testes ou registros administrativos)
  fastify.post('/api/alerts/manual', async (request, reply) => {
    const { cameraId, message } = request.body as {
      cameraId: string;
      message: string;
    };
    
    const userId = (request.user as any).id;
    const userRole = (request.user as any).role;
    
    // Apenas administradores e integradores podem criar alertas manuais
    if (userRole !== 'ADMIN' && userRole !== 'INTEGRATOR') {
      return reply.status(403).send({ error: 'Sem permissão para criar alertas manuais' });
    }
    
    try {
      // Verificar se a câmera existe
      const camera = await prisma.camera.findUnique({
        where: { id: cameraId },
        include: {
          client: true,
          integrator: true
        }
      });
      
      if (!camera) {
        return reply.status(404).send({ error: 'Câmera não encontrada' });
      }
      
      // Verificar permissões para a câmera
      if (userRole === 'INTEGRATOR') {
        const integrator = await prisma.integrator.findUnique({
          where: { userId },
          select: { id: true }
        });
        
        if (!integrator || camera.integratorId !== integrator.id) {
          return reply.status(403).send({ error: 'Sem permissão para esta câmera' });
        }
      }
      
      // Criar alerta manual
      const alert = await prisma.alert.create({
        data: {
          cameraId,
          status: 'NEW',
          type: 'MANUAL',
          message: message || 'Alerta manual',
          userId
        }
      });
      
      return reply.status(201).send(alert);
    } catch (error) {
      console.error('Erro ao criar alerta manual:', error);
      return reply.status(500).send({ error: 'Erro interno ao criar alerta manual' });
    }
  });

  // Excluir alerta
  fastify.delete('/api/alerts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;
    const userRole = (request.user as any).role;
    
    try {
      // Buscar alerta
      const alert = await prisma.alert.findUnique({
        where: { id },
        include: {
          camera: true
        }
      });
      
      if (!alert) {
        return reply.status(404).send({ error: 'Alerta não encontrado' });
      }
      
      // Verificar permissões
      const isAdmin = userRole === 'ADMIN';
      
      if (!isAdmin) {
        const camera = alert.camera;
        
        if (userRole === 'INTEGRATOR') {
          const integrator = await prisma.integrator.findUnique({
            where: { userId },
            select: { id: true }
          });
          
          if (!integrator || camera.integratorId !== integrator.id) {
            return reply.status(403).send({ error: 'Sem permissão para excluir este alerta' });
          }
        } else {
          // Clientes não podem excluir alertas
          return reply.status(403).send({ error: 'Sem permissão para excluir alertas' });
        }
      }
      
      // Excluir alerta
      await prisma.alert.delete({
        where: { id }
      });
      
      return reply.send({ success: true, message: 'Alerta excluído com sucesso' });
    } catch (error) {
      console.error(`Erro ao excluir alerta (${id}):`, error);
      return reply.status(500).send({ error: 'Erro interno ao excluir alerta' });
    }
  });

  // Estatísticas de alertas (para dashboard)
  fastify.get('/api/alerts/stats', async (request, reply) => {
    const userId = (request.user as any).id;
    const userRole = (request.user as any).role;
    
    try {
      // Filtros para câmeras que o usuário tem acesso
      const cameraFilter: any = {};
      
      if (userRole !== 'ADMIN') {
        if (userRole === 'INTEGRATOR') {
          const integrator = await prisma.integrator.findUnique({
            where: { userId },
            select: { id: true }
          });
          
          if (integrator) {
            cameraFilter.integratorId = integrator.id;
          }
        } else if (userRole === 'CLIENT') {
          const client = await prisma.client.findUnique({
            where: { userId },
            select: { id: true }
          });
          
          if (client) {
            cameraFilter.clientId = client.id;
          }
        }
      }
      
      // Buscar câmeras do usuário
      const cameras = await prisma.camera.findMany({
        where: cameraFilter,
        select: { id: true }
      });
      
      const cameraIds = cameras.map(camera => camera.id);
      
      // Contagem de alertas por status
      const alertsByStatus = await prisma.$queryRaw<any[]>`
        SELECT status, COUNT(*) as count 
        FROM alerts 
        WHERE "cameraId" IN (${cameraIds.join(',')}) 
        GROUP BY status
      `;
      
      // Contagem de alertas por tipo
      const alertsByType = await prisma.$queryRaw<any[]>`
        SELECT type, COUNT(*) as count 
        FROM alerts 
        WHERE "cameraId" IN (${cameraIds.join(',')}) 
        GROUP BY type
      `;
      
      // Alertas por dia (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const alertsByDay = await prisma.$queryRaw<any[]>`
        SELECT DATE(date) as day, COUNT(*) as count 
        FROM alerts 
        WHERE "cameraId" IN (${cameraIds.join(',')}) 
          AND date >= ${thirtyDaysAgo} 
        GROUP BY DATE(date) 
        ORDER BY day ASC
      `;
      
      return reply.send({
        byStatus: alertsByStatus,
        byType: alertsByType,
        byDay: alertsByDay
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas de alertas:', error);
      return reply.status(500).send({ error: 'Erro interno ao buscar estatísticas de alertas' });
    }
  });
} 