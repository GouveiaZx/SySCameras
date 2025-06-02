import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middlewares/auth';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3001';

export default async function recordingRoutes(fastify: FastifyInstance) {
  // Middleware de autenticação para todas as rotas
  fastify.addHook('onRequest', authenticate);

  // Listar gravações por câmera com filtros
  fastify.get('/api/recordings/:cameraId', async (request, reply) => {
    const { cameraId } = request.params as { cameraId: string };
    const { 
      page = '1', 
      limit = '20',
      startDate,
      endDate,
      type
    } = request.query as { 
      page?: string;
      limit?: string;
      startDate?: string;
      endDate?: string;
      type?: string;
    };
    
    const userId = (request.user as any).id;
    const userRole = (request.user as any).role;

    try {
      // Buscar a câmera para verificar permissões
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

      // Verificar permissões (apenas dono da câmera, integrador responsável ou admin)
      const isAdmin = userRole === 'ADMIN';
      const isOwnerIntegrator = camera.integratorId === userId;
      const isOwnerClient = camera.clientId === userId;

      if (!isAdmin && !isOwnerIntegrator && !isOwnerClient) {
        return reply.status(403).send({ error: 'Sem permissão para acessar gravações desta câmera' });
      }

      // Construir filtros
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      const where: any = { cameraId };

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

      // Filtro por tipo de gravação
      if (type) {
        where.recordingType = type.toUpperCase();
      }

      // Buscar gravações
      const [recordings, total] = await Promise.all([
        prisma.recording.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take: limitNum
        }),
        prisma.recording.count({ where })
      ]);

      // Calcular metadados de paginação
      const totalPages = Math.ceil(total / limitNum);
      
      return reply.send({
        data: recordings,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages
        }
      });
    } catch (error) {
      console.error('Erro ao listar gravações:', error);
      return reply.status(500).send({ error: 'Erro interno ao listar gravações' });
    }
  });

  // Iniciar gravação contínua para uma câmera
  fastify.post('/api/recordings/continuous/start', async (request, reply) => {
    const { cameraId } = request.body as { cameraId: string };
    const userId = (request.user as any).id;
    const userRole = (request.user as any).role;

    try {
      // Buscar a câmera com dados completos
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

      // Verificar permissões (apenas integrador responsável ou admin)
      const isAdmin = userRole === 'ADMIN';
      const isOwnerIntegrator = camera.integratorId === userId;

      if (!isAdmin && !isOwnerIntegrator) {
        return reply.status(403).send({ error: 'Apenas integradores e administradores podem iniciar gravações contínuas' });
      }

      // Preparar dados da câmera para enviar ao worker
      const cameraData = {
        id: camera.id,
        name: camera.name,
        rtspUrl: camera.rtspUrl,
        clientId: camera.clientId,
        integratorId: camera.integratorId,
        userId: userId // ID do usuário que iniciou a gravação
      };

      // Enviar comando para o worker iniciar a gravação contínua
      const workerResponse = await fetch(`${WORKER_URL}/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ camera: cameraData }),
      });

      if (!workerResponse.ok) {
        const errorData = await workerResponse.json();
        return reply.status(500).send({ error: 'Falha ao iniciar gravação contínua', details: errorData });
      }

      // Atualizar status da câmera no banco
      await prisma.camera.update({
        where: { id: cameraId },
        data: { 
          recordingStatus: 'CONTINUOUS'
        }
      });

      const responseData = await workerResponse.json();
      return reply.send({
        success: true,
        message: 'Gravação contínua iniciada com sucesso',
        cameraId
      });
    } catch (error) {
      console.error('Erro ao iniciar gravação contínua:', error);
      return reply.status(500).send({ error: 'Erro interno ao iniciar gravação contínua' });
    }
  });

  // Parar gravação contínua
  fastify.post('/api/recordings/continuous/stop', async (request, reply) => {
    const { cameraId } = request.body as { cameraId: string };
    const userId = (request.user as any).id;
    const userRole = (request.user as any).role;

    try {
      // Buscar a câmera
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

      // Verificar permissões (apenas integrador responsável ou admin)
      const isAdmin = userRole === 'ADMIN';
      const isOwnerIntegrator = camera.integratorId === userId;

      if (!isAdmin && !isOwnerIntegrator) {
        return reply.status(403).send({ error: 'Apenas integradores e administradores podem parar gravações contínuas' });
      }

      // Enviar comando para o worker parar a gravação
      const workerResponse = await fetch(`${WORKER_URL}/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cameraId }),
      });

      if (!workerResponse.ok) {
        const errorData = await workerResponse.json();
        return reply.status(500).send({ error: 'Falha ao parar gravação contínua', details: errorData });
      }

      // Atualizar status da câmera no banco
      await prisma.camera.update({
        where: { id: cameraId },
        data: { 
          recordingStatus: 'INACTIVE'
        }
      });

      return reply.send({
        success: true,
        message: 'Gravação contínua interrompida com sucesso',
        cameraId
      });
    } catch (error) {
      console.error('Erro ao parar gravação contínua:', error);
      return reply.status(500).send({ error: 'Erro interno ao parar gravação contínua' });
    }
  });

  // Excluir uma gravação
  fastify.delete('/api/recordings/:recordingId', async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const userId = (request.user as any).id;
    const userRole = (request.user as any).role;

    try {
      // Buscar a gravação
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
        include: {
          camera: {
            include: {
              client: true,
              integrator: true
            }
          }
        }
      });

      if (!recording) {
        return reply.status(404).send({ error: 'Gravação não encontrada' });
      }

      // Verificar permissões (apenas dono da câmera, integrador responsável ou admin)
      const isAdmin = userRole === 'ADMIN';
      const isOwnerIntegrator = recording.camera.integratorId === userId;

      if (!isAdmin && !isOwnerIntegrator) {
        return reply.status(403).send({ error: 'Sem permissão para excluir esta gravação' });
      }

      // Enviar comando para o worker excluir a gravação
      const workerResponse = await fetch(`${WORKER_URL}/recording/${recordingId}`, {
        method: 'DELETE'
      });

      if (!workerResponse.ok) {
        const errorData = await workerResponse.json();
        return reply.status(500).send({ error: 'Falha ao excluir gravação', details: errorData });
      }

      return reply.send({
        success: true,
        message: 'Gravação excluída com sucesso',
        recordingId
      });
    } catch (error) {
      console.error('Erro ao excluir gravação:', error);
      return reply.status(500).send({ error: 'Erro interno ao excluir gravação' });
    }
  });

  // Iniciar limpeza de gravações antigas
  fastify.post('/api/recordings/cleanup', async (request, reply) => {
    const userRole = (request.user as any).role;

    // Apenas administradores podem executar limpeza manual
    if (userRole !== 'ADMIN') {
      return reply.status(403).send({ error: 'Apenas administradores podem executar limpeza manual de gravações' });
    }

    try {
      // Enviar comando para o worker limpar gravações antigas
      const workerResponse = await fetch(`${WORKER_URL}/recording/cleanup`, {
        method: 'POST'
      });

      if (!workerResponse.ok) {
        const errorData = await workerResponse.json();
        return reply.status(500).send({ error: 'Falha ao limpar gravações antigas', details: errorData });
      }

      const responseData = await workerResponse.json();
      return reply.send({
        success: true,
        message: 'Limpeza de gravações antigas iniciada com sucesso',
        details: responseData
      });
    } catch (error) {
      console.error('Erro ao limpar gravações antigas:', error);
      return reply.status(500).send({ error: 'Erro interno ao limpar gravações antigas' });
    }
  });
} 