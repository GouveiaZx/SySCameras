import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middlewares/auth';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3001';
const SRS_BASE_URL = process.env.SRS_BASE_URL || 'http://localhost:8080';

export default async function streamRoutes(fastify: FastifyInstance) {
  // Middleware de autenticação para todas as rotas
  fastify.addHook('onRequest', authenticate);

  // Iniciar stream de câmera
  fastify.post('/api/stream/start', async (request, reply) => {
    const { cameraId } = request.body as { cameraId: string };
    const userId = (request.user as any).id;

    try {
      // Buscar a câmera no banco de dados
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
      const isAdmin = (request.user as any).role === 'ADMIN';
      const isOwnerIntegrator = camera.integratorId === userId;
      const isOwnerClient = camera.clientId === userId;

      if (!isAdmin && !isOwnerIntegrator && !isOwnerClient) {
        return reply.status(403).send({ error: 'Sem permissão para esta câmera' });
      }

      // Gerar nome único para o stream
      const streamName = `client${camera.clientId}_cam${camera.id}_${Date.now()}`;
      
      // Criar ou atualizar registro de stream no banco
      const stream = await prisma.cameraStream.upsert({
        where: { cameraId },
        update: {
          streamName,
          status: 'STARTING',
          hlsUrl: `${SRS_BASE_URL}/live/${streamName}.m3u8`
        },
        create: {
          cameraId,
          streamName,
          status: 'STARTING',
          hlsUrl: `${SRS_BASE_URL}/live/${streamName}.m3u8`
        }
      });

      // Enviar comando para o worker iniciar o streaming
      const workerResponse = await fetch(`${WORKER_URL}/stream/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamName,
          rtspUrl: camera.rtspUrl,
          srsUrl: SRS_BASE_URL,
        }),
      });

      if (!workerResponse.ok) {
        const errorData = await workerResponse.json();
        // Atualizar status para erro
        await prisma.cameraStream.update({
          where: { id: stream.id },
          data: { status: 'ERROR', errorMessage: errorData.error }
        });
        
        return reply.status(500).send({ error: 'Falha ao iniciar stream', details: errorData });
      }

      // Atualizar câmera com URL de streaming
      await prisma.camera.update({
        where: { id: cameraId },
        data: { 
          hlsUrl: stream.hlsUrl,
          streamStatus: 'ACTIVE' 
        }
      });

      return reply.send({
        streamId: stream.id,
        streamName,
        hlsUrl: stream.hlsUrl,
        status: 'STARTING'
      });
    } catch (error) {
      console.error('Erro ao iniciar stream:', error);
      return reply.status(500).send({ error: 'Erro interno ao iniciar stream' });
    }
  });

  // Parar stream de câmera
  fastify.post('/api/stream/stop', async (request, reply) => {
    const { cameraId } = request.body as { cameraId: string };
    const userId = (request.user as any).id;

    try {
      // Buscar a câmera no banco de dados
      const camera = await prisma.camera.findUnique({
        where: { id: cameraId },
        include: {
          client: true,
          integrator: true,
          stream: true
        }
      });

      if (!camera) {
        return reply.status(404).send({ error: 'Câmera não encontrada' });
      }

      // Verificar permissões
      const isAdmin = (request.user as any).role === 'ADMIN';
      const isOwnerIntegrator = camera.integratorId === userId;
      const isOwnerClient = camera.clientId === userId;

      if (!isAdmin && !isOwnerIntegrator && !isOwnerClient) {
        return reply.status(403).send({ error: 'Sem permissão para esta câmera' });
      }

      // Se não houver stream ativo
      if (!camera.stream) {
        return reply.status(400).send({ error: 'Nenhum stream ativo para esta câmera' });
      }

      // Enviar comando para o worker parar o streaming
      const workerResponse = await fetch(`${WORKER_URL}/stream/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamName: camera.stream.streamName
        }),
      });

      if (!workerResponse.ok) {
        const errorData = await workerResponse.json();
        return reply.status(500).send({ error: 'Falha ao parar stream', details: errorData });
      }

      // Atualizar status do stream
      await prisma.cameraStream.update({
        where: { id: camera.stream.id },
        data: { status: 'STOPPED' }
      });

      // Atualizar câmera
      await prisma.camera.update({
        where: { id: cameraId },
        data: { 
          hlsUrl: null,
          streamStatus: 'INACTIVE' 
        }
      });

      return reply.send({
        message: 'Stream encerrado com sucesso',
        cameraId
      });
    } catch (error) {
      console.error('Erro ao parar stream:', error);
      return reply.status(500).send({ error: 'Erro interno ao parar stream' });
    }
  });

  // Obter status do stream de uma câmera
  fastify.get('/api/stream/status/:cameraId', async (request, reply) => {
    const { cameraId } = request.params as { cameraId: string };
    const userId = (request.user as any).id;

    try {
      // Buscar a câmera no banco de dados
      const camera = await prisma.camera.findUnique({
        where: { id: cameraId },
        include: {
          client: true,
          integrator: true,
          stream: true
        }
      });

      if (!camera) {
        return reply.status(404).send({ error: 'Câmera não encontrada' });
      }

      // Verificar permissões
      const isAdmin = (request.user as any).role === 'ADMIN';
      const isOwnerIntegrator = camera.integratorId === userId;
      const isOwnerClient = camera.clientId === userId;

      if (!isAdmin && !isOwnerIntegrator && !isOwnerClient) {
        return reply.status(403).send({ error: 'Sem permissão para esta câmera' });
      }

      if (!camera.stream) {
        return reply.send({
          cameraId,
          streamStatus: 'INACTIVE',
          hlsUrl: null
        });
      }

      return reply.send({
        cameraId,
        streamId: camera.stream.id,
        streamName: camera.stream.streamName,
        streamStatus: camera.stream.status,
        hlsUrl: camera.stream.hlsUrl,
        errorMessage: camera.stream.errorMessage
      });
    } catch (error) {
      console.error('Erro ao obter status do stream:', error);
      return reply.status(500).send({ error: 'Erro interno ao obter status do stream' });
    }
  });
} 