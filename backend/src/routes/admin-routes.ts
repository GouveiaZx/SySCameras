import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middlewares/auth';
import { isAdmin } from '../middlewares/authorization';

const prisma = new PrismaClient();

/**
 * Rotas administrativas
 */
export default async function adminRoutes(fastify: FastifyInstance) {
  // Middleware de autenticação e autorização para todas as rotas
  fastify.addHook('onRequest', authenticate);
  fastify.addHook('onRequest', isAdmin);

  // Obter estatísticas gerais do sistema
  fastify.get('/api/admin/stats', async (request, reply) => {
    try {
      // Contagem de integradores
      const totalIntegrators = await prisma.integrator.count();
      
      // Contagem de clientes
      const totalClients = await prisma.client.count();
      
      // Contagem de câmeras e câmeras ativas
      const [totalCameras, activeCameras] = await Promise.all([
        prisma.camera.count(),
        prisma.camera.count({
          where: { status: 'online' }
        })
      ]);
      
      // Contagem de gravações
      const totalRecordings = await prisma.recording.count();
      
      // Contagem de alertas
      const [totalAlerts, newAlerts, readAlerts] = await Promise.all([
        prisma.alert.count(),
        prisma.alert.count({ where: { status: 'NEW' } }),
        prisma.alert.count({ where: { status: 'READ' } })
      ]);
      
      // Calcular uso de armazenamento (total de bytes em gravações)
      const storageResult = await prisma.recording.aggregate({
        _sum: {
          size: true
        }
      });
      
      const storageUsedBytes = storageResult._sum.size || 0;
      
      // Supondo um limite de armazenamento de 1TB (1 terabyte = 1.099.511.627.776 bytes)
      const storageLimit = process.env.STORAGE_LIMIT ? 
        parseInt(process.env.STORAGE_LIMIT) : 1099511627776;
      
      const storagePercentage = (storageUsedBytes / storageLimit) * 100;
      
      return {
        totalIntegrators,
        totalClients,
        totalCameras,
        activeCameras,
        totalRecordings,
        totalAlerts: {
          total: totalAlerts,
          new: newAlerts,
          read: readAlerts
        },
        storageUsed: {
          total: storageUsedBytes,
          percentage: storagePercentage
        }
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas do sistema:', error);
      return reply.status(500).send({ error: 'Erro interno ao obter estatísticas' });
    }
  });

  // Obter estatísticas de gravações ao longo do tempo
  fastify.get('/api/admin/stats/recordings', async (request, reply) => {
    const { period = 'week' } = request.query as { period?: 'day' | 'week' | 'month' };
    
    try {
      let dateFormat: string;
      let dateFilter: Date;
      
      // Definir formato de data e filtro baseado no período
      const now = new Date();
      
      switch (period) {
        case 'day':
          dateFormat = '%Y-%m-%d %H:00'; // Formato por hora
          dateFilter = new Date(now.setDate(now.getDate() - 1)); // Último dia
          break;
        case 'month':
          dateFormat = '%Y-%m-%d'; // Formato diário
          dateFilter = new Date(now.setMonth(now.getMonth() - 1)); // Último mês
          break;
        case 'week':
        default:
          dateFormat = '%Y-%m-%d'; // Formato diário
          dateFilter = new Date(now.setDate(now.getDate() - 7)); // Última semana
          break;
      }
      
      // Query para obter contagem de gravações agrupadas por data
      const recordingsStats = await prisma.$queryRaw<{ date: string, count: string }[]>`
        SELECT 
          DATE_FORMAT(date, ${dateFormat}) as date, 
          COUNT(*) as count 
        FROM recordings 
        WHERE date >= ${dateFilter} 
        GROUP BY DATE_FORMAT(date, ${dateFormat}) 
        ORDER BY date ASC
      `;
      
      return recordingsStats.map(item => ({
        date: item.date,
        count: parseInt(item.count, 10)
      }));
    } catch (error) {
      console.error('Erro ao obter estatísticas de gravações:', error);
      return reply.status(500).send({ error: 'Erro interno ao obter estatísticas de gravações' });
    }
  });

  // Obter estatísticas de alertas ao longo do tempo
  fastify.get('/api/admin/stats/alerts', async (request, reply) => {
    const { period = 'week' } = request.query as { period?: 'day' | 'week' | 'month' };
    
    try {
      let dateFormat: string;
      let dateFilter: Date;
      
      // Definir formato de data e filtro baseado no período
      const now = new Date();
      
      switch (period) {
        case 'day':
          dateFormat = '%Y-%m-%d %H:00'; // Formato por hora
          dateFilter = new Date(now.setDate(now.getDate() - 1)); // Último dia
          break;
        case 'month':
          dateFormat = '%Y-%m-%d'; // Formato diário
          dateFilter = new Date(now.setMonth(now.getMonth() - 1)); // Último mês
          break;
        case 'week':
        default:
          dateFormat = '%Y-%m-%d'; // Formato diário
          dateFilter = new Date(now.setDate(now.getDate() - 7)); // Última semana
          break;
      }
      
      // Query para obter contagem de alertas agrupados por data
      const alertsStats = await prisma.$queryRaw<{ date: string, count: string }[]>`
        SELECT 
          DATE_FORMAT(date, ${dateFormat}) as date, 
          COUNT(*) as count 
        FROM alerts 
        WHERE date >= ${dateFilter} 
        GROUP BY DATE_FORMAT(date, ${dateFormat}) 
        ORDER BY date ASC
      `;
      
      return alertsStats.map(item => ({
        date: item.date,
        count: parseInt(item.count, 10)
      }));
    } catch (error) {
      console.error('Erro ao obter estatísticas de alertas:', error);
      return reply.status(500).send({ error: 'Erro interno ao obter estatísticas de alertas' });
    }
  });

  // Obter atividades recentes do sistema
  fastify.get('/api/admin/activities', async (request, reply) => {
    const { limit = '10' } = request.query as { limit?: string };
    const limitNum = parseInt(limit, 10);
    
    try {
      // Buscar alertas recentes
      const recentAlerts = await prisma.alert.findMany({
        select: {
          id: true,
          type: true,
          date: true,
          status: true,
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
        orderBy: { date: 'desc' },
        take: limitNum
      });
      
      // Transformar em atividades
      const activities = recentAlerts.map(alert => ({
        id: alert.id,
        type: 'ALERT',
        date: alert.date,
        title: `Novo alerta de ${alert.type === 'MOTION' ? 'movimento' : 
                          alert.type === 'OFFLINE' ? 'câmera offline' : 'manual'}`,
        description: `Alerta na câmera ${alert.camera.name} (${alert.camera.client.name})`,
        entityId: alert.id,
        entityType: 'alert'
      }));
      
      return activities;
    } catch (error) {
      console.error('Erro ao obter atividades recentes:', error);
      return reply.status(500).send({ error: 'Erro interno ao obter atividades recentes' });
    }
  });

  // Listar integradores
  fastify.get('/api/admin/integrators', async (request, reply) => {
    const { 
      search = '', 
      status = 'all', 
      sortBy = 'name', 
      sortOrder = 'asc',
      page = '1', 
      limit = '10' 
    } = request.query as { 
      search?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
      page?: string;
      limit?: string;
    };
    
    try {
      // Construir query de filtro
      const where: any = {};
      
      // Filtro por busca (nome ou email)
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } }
        ];
      }
      
      // Filtro por status
      if (status === 'active') {
        where.user = { ...where.user, active: true };
      } else if (status === 'inactive') {
        where.user = { ...where.user, active: false };
      }
      
      // Configuração de ordenação
      let orderBy: any = {};
      
      switch (sortBy) {
        case 'name':
          orderBy.name = sortOrder;
          break;
        case 'email':
          orderBy.user = { email: sortOrder };
          break;
        case 'createdAt':
          orderBy.user = { createdAt: sortOrder };
          break;
        case 'active':
          orderBy.user = { active: sortOrder };
          break;
        default:
          orderBy.name = 'asc';
      }
      
      // Paginação
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Buscar integradores
      const [integrators, total] = await Promise.all([
        prisma.integrator.findMany({
          where,
          select: {
            id: true,
            name: true,
            userId: true,
            user: {
              select: {
                email: true,
                createdAt: true,
                active: true
              }
            },
            _count: {
              select: {
                clients: true,
                cameras: true
              }
            }
          },
          orderBy,
          skip,
          take: limitNum
        }),
        prisma.integrator.count({ where })
      ]);
      
      // Formatar resposta
      const formattedIntegrators = integrators.map(integrator => ({
        id: integrator.id,
        name: integrator.name,
        email: integrator.user.email,
        createdAt: integrator.user.createdAt,
        active: integrator.user.active,
        clientsCount: integrator._count.clients,
        camerasCount: integrator._count.cameras,
        userId: integrator.userId
      }));
      
      // Calcular total de páginas
      const totalPages = Math.ceil(total / limitNum);
      
      return {
        data: formattedIntegrators,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages
        }
      };
    } catch (error) {
      console.error('Erro ao listar integradores:', error);
      return reply.status(500).send({ error: 'Erro interno ao listar integradores' });
    }
  });

  // Obter detalhes de um integrador específico
  fastify.get('/api/admin/integrators/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      // Buscar integrador
      const integrator = await prisma.integrator.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          userId: true,
          user: {
            select: {
              email: true,
              createdAt: true,
              active: true
            }
          },
          _count: {
            select: {
              clients: true,
              cameras: true
            }
          }
        }
      });
      
      if (!integrator) {
        return reply.status(404).send({ error: 'Integrador não encontrado' });
      }
      
      // Formatar resposta
      return {
        id: integrator.id,
        name: integrator.name,
        email: integrator.user.email,
        createdAt: integrator.user.createdAt,
        active: integrator.user.active,
        clientsCount: integrator._count.clients,
        camerasCount: integrator._count.cameras,
        userId: integrator.userId
      };
    } catch (error) {
      console.error(`Erro ao obter detalhes do integrador ${id}:`, error);
      return reply.status(500).send({ error: 'Erro interno ao obter detalhes do integrador' });
    }
  });

  // Atualizar um integrador
  fastify.put('/api/admin/integrators/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, email, active, password } = request.body as { 
      name?: string; 
      email?: string; 
      active?: boolean;
      password?: string;
    };
    
    try {
      // Verificar se integrador existe
      const integrator = await prisma.integrator.findUnique({
        where: { id },
        select: { userId: true }
      });
      
      if (!integrator) {
        return reply.status(404).send({ error: 'Integrador não encontrado' });
      }
      
      // Preparar dados para atualização
      const updates: any = {};
      
      if (name !== undefined) updates.name = name;
      
      // Dados do usuário
      const userUpdates: any = {};
      
      if (email !== undefined) userUpdates.email = email;
      if (active !== undefined) userUpdates.active = active;
      if (password) userUpdates.password = await fastify.bcrypt.hash(password);
      
      // Atualizar integrador e usuário em transação
      const updatedIntegrator = await prisma.$transaction(async (prisma) => {
        // Atualizar dados do integrador
        const updatedIntegrator = Object.keys(updates).length > 0 
          ? await prisma.integrator.update({
              where: { id },
              data: updates,
              select: {
                id: true,
                name: true,
                userId: true
              }
            })
          : await prisma.integrator.findUnique({
              where: { id },
              select: {
                id: true,
                name: true,
                userId: true
              }
            });
        
        // Atualizar dados do usuário se houver mudanças
        if (Object.keys(userUpdates).length > 0) {
          await prisma.user.update({
            where: { id: integrator.userId },
            data: userUpdates
          });
        }
        
        // Buscar dados atualizados do usuário
        const user = await prisma.user.findUnique({
          where: { id: integrator.userId },
          select: {
            email: true,
            createdAt: true,
            active: true
          }
        });
        
        // Contar clientes e câmeras
        const [clientsCount, camerasCount] = await Promise.all([
          prisma.client.count({ where: { integratorId: id } }),
          prisma.camera.count({ where: { integratorId: id } })
        ]);
        
        return {
          ...updatedIntegrator,
          email: user?.email,
          createdAt: user?.createdAt,
          active: user?.active,
          clientsCount,
          camerasCount
        };
      });
      
      return updatedIntegrator;
    } catch (error) {
      console.error(`Erro ao atualizar integrador ${id}:`, error);
      return reply.status(500).send({ error: 'Erro interno ao atualizar integrador' });
    }
  });

  // Criar um novo integrador
  fastify.post('/api/admin/integrators', async (request, reply) => {
    const { name, email, password } = request.body as { 
      name: string; 
      email: string; 
      password: string;
    };
    
    // Validar dados
    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'Nome, email e senha são obrigatórios' });
    }
    
    try {
      // Verificar se email já existe
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existingUser) {
        return reply.status(400).send({ error: 'Email já está em uso' });
      }
      
      // Criar usuário e integrador em transação
      const newIntegrator = await prisma.$transaction(async (prisma) => {
        // Criar usuário
        const hashedPassword = await fastify.bcrypt.hash(password);
        
        const user = await prisma.user.create({
          data: {
            email,
            name,
            role: 'INTEGRATOR',
            password: hashedPassword,
            active: true
          }
        });
        
        // Criar integrador
        const integrator = await prisma.integrator.create({
          data: {
            name,
            userId: user.id
          },
          select: {
            id: true,
            name: true,
            userId: true
          }
        });
        
        return {
          ...integrator,
          email,
          createdAt: user.createdAt,
          active: true,
          clientsCount: 0,
          camerasCount: 0
        };
      });
      
      return reply.status(201).send(newIntegrator);
    } catch (error) {
      console.error('Erro ao criar integrador:', error);
      return reply.status(500).send({ error: 'Erro interno ao criar integrador' });
    }
  });

  // ==================== ROTAS DE CLIENTES ====================
  // NOTA: Rotas de clientes temporariamente desabilitadas por problemas de tipo
  // Os dados de clientes são acessados via Supabase diretamente no frontend
} 