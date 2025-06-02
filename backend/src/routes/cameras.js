const fetch = require('node-fetch');

const { 
  getCameras, 
  getCameraById, 
  createCamera, 
  updateCamera, 
  deleteCamera,
  updateRetentionSetting,
  getAlertConfigurations,
  createAlertConfiguration,
  updateAlertConfiguration,
  deleteAlertConfiguration,
  checkCameraStatus,
  captureSnapshot,
  startHLSStream,
  stopHLSStream,
  getHLSStreamStatus,
  getActiveHLSStreams
} = require('../controllers/cameras');

const { 
  authenticate, 
  isAdmin, 
  isIntegrator, 
  isClient 
} = require('../middlewares/auth');

const { startStream, stopStream, getStreamStatus, getActiveStreams } = require('../controllers/streaming');

// Esquemas para validação do Fastify
const cameraSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    rtspUrl: { type: 'string', format: 'uri' },
    rtmpUrl: { type: 'string', format: 'uri' },
    clientId: { type: 'string' },
    integratorId: { type: 'string' },
    type: { type: 'string' },
    retentionDays: { type: 'integer', minimum: 1, maximum: 60 }
  },
  required: ['name', 'clientId', 'type'],
  anyOf: [
    { required: ['rtspUrl'] },
    { required: ['rtmpUrl'] }
  ]
};

const cameraUpdateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    rtspUrl: { type: 'string', format: 'uri' },
    rtmpUrl: { type: 'string', format: 'uri' },
    status: { type: 'string', enum: ['online', 'offline'] },
    type: { type: 'string' },
    retentionDays: { type: 'integer', minimum: 1, maximum: 60 }
  }
};

/**
 * Rotas de câmeras para o Fastify
 * @param {FastifyInstance} fastify - Instância do Fastify
 * @param {Object} options - Opções do plugin
 */
async function cameraRoutes(fastify, options) {
  // Middleware de autenticação para todas as rotas
  fastify.addHook('onRequest', authenticate);
  
  // Lista todas as câmeras (filtradas por permissão)
  fastify.get('/cameras', {
    preHandler: isClient, // Pelo menos cliente
    handler: getCameras
  });
  
  // Obter uma câmera específica
  fastify.get('/cameras/:id', {
    preHandler: isClient, // Pelo menos cliente
    handler: getCameraById
  });
  
  // Criar uma nova câmera (apenas admin e integrador)
  fastify.post('/cameras', {
    schema: {
      body: cameraSchema
    },
    preHandler: isIntegrator, // Pelo menos integrador
    handler: createCamera
  });
  
  // Atualizar uma câmera (apenas admin e integrador)
  fastify.put('/cameras/:id', {
    schema: {
      body: cameraUpdateSchema
    },
    preHandler: isIntegrator, // Pelo menos integrador
    handler: updateCamera
  });
  
  // Remover uma câmera (apenas admin e integrador)
  fastify.delete('/cameras/:id', {
    preHandler: isIntegrator, // Pelo menos integrador
    handler: deleteCamera
  });
  
  // Atualizar configurações de retenção de uma câmera (apenas admin e integrador)
  fastify.put('/cameras/:id/retention', {
    schema: {
      body: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 365 }
        },
        required: ['days']
      }
    },
    preHandler: isIntegrator, // Pelo menos integrador
    handler: updateRetentionSetting
  });
  
  // Obter configurações de alerta de uma câmera
  fastify.get('/cameras/:id/alert-configurations', {
    preHandler: isClient, // Pelo menos cliente
    handler: getAlertConfigurations
  });

  // Criar configuração de alerta
  fastify.post('/alert-configurations', {
    schema: {
      body: {
        type: 'object',
        properties: {
          cameraId: { type: 'string' },
          emailAddresses: { 
            type: 'array',
            items: { type: 'string', format: 'email' },
            minItems: 1
          },
          notifyOnline: { type: 'boolean' },
          notifyOffline: { type: 'boolean' }
        },
        required: ['cameraId', 'emailAddresses']
      }
    },
    preHandler: isIntegrator, // Pelo menos integrador
    handler: createAlertConfiguration
  });

  // Atualizar configuração de alerta
  fastify.put('/alert-configurations/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          emailAddresses: { 
            type: 'array',
            items: { type: 'string', format: 'email' },
            minItems: 1
          },
          notifyOnline: { type: 'boolean' },
          notifyOffline: { type: 'boolean' },
          active: { type: 'boolean' }
        }
      }
    },
    preHandler: isIntegrator, // Pelo menos integrador
    handler: updateAlertConfiguration
  });

  // Excluir configuração de alerta
  fastify.delete('/cameras/alert-configurations/:id', {
    preHandler: isIntegrator, // Pelo menos integrador
    handler: deleteAlertConfiguration
  });

  // Verificar status real da câmera - IMPLEMENTAÇÃO MELHORADA
  fastify.post('/cameras/:id/check-status', async (request, reply) => {
    try {
      const { id } = request.params;
      console.log(`🔍 Verificando status da câmera: ${id}`);
      
      // Buscar a câmera
      const { data: camera, error } = await require('../services/supabase').supabase
        .from('cameras')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !camera) {
        console.log(`❌ Câmera não encontrada: ${id}`);
        return reply.code(404).send({
          error: 'Câmera não encontrada'
        });
      }
      
      console.log(`📷 Câmera encontrada: ${camera.name}`);
      console.log(`🔗 RTSP URL: ${camera.rtspUrl}`);
      console.log(`🔗 RTMP URL: ${camera.rtmpUrl}`);
      
      const workerStreamingService = require('../services/workerStreamingService');
      
      // Determinar qual URL usar e protocolo
      let streamUrl = null;
      let protocol = null;
      let isOnline = false;
      let errorMessage = null;
      
      if (camera.rtspUrl && camera.rtspUrl.trim() !== '') {
        streamUrl = camera.rtspUrl;
        protocol = 'RTSP';
        console.log(`🔵 Verificando câmera RTSP: ${streamUrl}`);
      } else if (camera.rtmpUrl && camera.rtmpUrl.trim() !== '') {
        streamUrl = camera.rtmpUrl;
        protocol = 'RTMP';
        console.log(`🔴 Verificando câmera RTMP: ${streamUrl}`);
      } else {
        console.log(`❌ Nenhuma URL válida encontrada para a câmera ${id}`);
        isOnline = false;
        errorMessage = 'Nenhuma URL de stream configurada';
      }
      
      // Verificar se há stream ativo no worker para esta câmera
      if (streamUrl) {
        try {
          console.log(`🔍 Consultando status do worker para câmera ${id}...`);
          const workerStatus = await workerStreamingService.getStreamStatus(id);
          
          if (workerStatus.success && workerStatus.data) {
            isOnline = workerStatus.data.active && workerStatus.data.status === 'running';
            console.log(`📊 Status do worker: ${workerStatus.data.active ? 'ativo' : 'inativo'} (${workerStatus.data.status})`);
          } else {
            console.log(`⚠️ Worker retornou: ${JSON.stringify(workerStatus)}`);
            isOnline = false;
            errorMessage = 'Stream não está ativo no worker';
          }
          
        } catch (workerError) {
          console.log(`⚠️ Erro ao consultar worker: ${workerError.message}`);
          
          // Se o worker não responder, tentar verificação básica de URL
          if (protocol === 'RTSP') {
            const rtspPattern = /rtsp:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/;
            isOnline = rtspPattern.test(streamUrl);
            errorMessage = isOnline ? null : 'URL RTSP mal formada ou sem credenciais';
          } else if (protocol === 'RTMP') {
            const rtmpPattern = /rtmp:\/\/[^\/]+\/[^\/]+\/\w+/;
            isOnline = rtmpPattern.test(streamUrl);
            errorMessage = isOnline ? null : 'URL RTMP mal formada';
          }
        }
      }
      
      const newStatus = isOnline ? 'online' : 'offline';
      console.log(`📊 Status final determinado: ${newStatus} (Protocolo: ${protocol || 'N/A'})`);
      
      // Atualizar status no banco
      const { error: updateError } = await require('../services/supabase').supabase
        .from('cameras')
        .update({ 
          status: newStatus,
          updatedAt: new Date().toISOString()
        })
        .eq('id', id);
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar status no banco:`, updateError);
      } else {
        console.log(`✅ Status atualizado no banco: ${newStatus}`);
      }
      
      // Preparar resposta detalhada
      const response = {
        success: true,
        message: 'Status verificado com sucesso',
        cameraId: id,
        cameraName: camera.name,
        streamUrl: streamUrl,
        protocol: protocol,
        statusCheck: {
          previousStatus: camera.status,
          newStatus: newStatus,
          isOnline: isOnline,
          checkedAt: new Date().toISOString(),
          errorMessage: errorMessage
        }
      };
      
      console.log(`✅ Resposta preparada:`, response);
      return reply.code(200).send(response);
      
    } catch (error) {
      console.error('❌ Erro ao verificar status da câmera:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Ocorreu um erro inesperado no servidor'
      });
    }
  });

  // Capturar snapshot da câmera
  fastify.get('/cameras/:id/snapshot', {
    preHandler: isClient, // Pelo menos cliente
    handler: captureSnapshot
  });
  
  // === ROTAS DE GRAVAÇÃO ===
  
  // Iniciar gravação contínua para uma câmera
  fastify.post('/cameras/:id/recording/start', {
    preHandler: authenticate, // Apenas autenticação básica
    handler: async (request, reply) => {
      console.log('🚀 === INÍCIO DA ROTA DE GRAVAÇÃO ===');
      try {
        const { id: cameraId } = request.params;
        const { role, id: userId } = request.user;
        
        console.log(`🎬 Iniciando gravação contínua para câmera: ${cameraId}`);
        console.log(`👤 Usuário: ${userId}, Role: ${role}`);
        console.log(`📋 Request headers:`, request.headers);
        console.log(`📋 Request params:`, request.params);
        console.log(`📋 Request user:`, request.user);
        
        // Verificar se é ADMIN (simplificado)
        if (role !== 'ADMIN' && role !== 'INTEGRATOR') {
          console.log(`❌ Permissão negada para role: ${role}`);
          return reply.code(403).send({ 
            error: 'Apenas administradores e integradores podem iniciar gravações contínuas' 
          });
        }
        
        console.log('✅ Permissão OK, buscando câmera...');
        
        // Buscar a câmera com dados completos usando Supabase
        const { supabase } = require('../services/supabase');
        
        console.log('🔍 Executando query no Supabase...');
        const { data: camera, error: cameraError } = await supabase
          .from('cameras')
          .select(`
            *,
            clients(*),
            integrators(*)
          `)
          .eq('id', cameraId)
          .single();

        console.log('📊 Resultado da query:');
        console.log('  - Camera data:', camera ? 'encontrada' : 'não encontrada');
        console.log('  - Camera error:', cameraError);

        if (cameraError || !camera) {
          console.error('❌ Erro ao buscar câmera:', cameraError);
          return reply.code(404).send({ error: 'Câmera não encontrada' });
        }

        console.log(`📷 Câmera encontrada: ${camera.name}`);
        console.log(`🔗 RTSP URL: ${camera.rtspUrl}`);
        console.log(`🔗 RTMP URL: ${camera.rtmpUrl}`);

        // Verificar se a câmera tem URL RTSP ou RTMP configurada
        const hasRtspUrl = camera.rtspUrl && camera.rtspUrl.trim() !== '';
        const hasRtmpUrl = camera.rtmpUrl && camera.rtmpUrl.trim() !== '';
        
        if (!hasRtspUrl && !hasRtmpUrl) {
          console.log(`❌ Câmera sem URL de entrada: ${camera.name}`);
          return reply.code(400).send({ 
            error: 'Câmera não possui URL RTSP ou RTMP configurada' 
          });
        }

        // Preparar dados da câmera para enviar ao worker
        const cameraData = {
          id: camera.id,
          name: camera.name,
          rtspUrl: camera.rtspUrl || null,
          rtmpUrl: camera.rtmpUrl || null,
          clientId: camera.clientId,
          integratorId: camera.integratorId,
          userId: userId
        };

        console.log(`🔄 Enviando comando para worker...`);
        console.log(`📤 Dados da câmera:`, cameraData);

        // Enviar comando para o worker iniciar a gravação contínua
        const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3002';
        console.log(`📡 Worker URL: ${WORKER_URL}`);
        
        const workerResponse = await fetch(`${WORKER_URL}/recording/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ camera: cameraData }),
        });

        console.log(`📊 Worker response status: ${workerResponse.status}`);

        if (!workerResponse.ok) {
          const errorData = await workerResponse.json().catch(() => ({ message: 'Erro desconhecido do worker' }));
          console.error('❌ Erro do worker:', errorData);
          return reply.code(500).send({ 
            error: 'Falha ao iniciar gravação contínua', 
            details: errorData.message || 'Worker não respondeu corretamente'
          });
        }

        console.log('✅ Worker respondeu OK, atualizando status no banco...');
        
        // Atualizar status da câmera no banco usando Supabase
        const { error: updateError } = await supabase
          .from('cameras')
          .update({ 
            recordingStatus: 'CONTINUOUS',
            updatedAt: new Date().toISOString()
          })
          .eq('id', cameraId);

        if (updateError) {
          console.error('❌ Erro ao atualizar status da câmera:', updateError);
        } else {
          console.log('✅ Status da câmera atualizado no banco');
        }

        const workerData = await workerResponse.json();
        console.log('✅ Gravação contínua iniciada com sucesso');
        console.log('📦 Worker response data:', workerData);
        
        return reply.send({
          success: true,
          message: 'Gravação contínua iniciada com sucesso',
          cameraId,
          workerResponse: workerData
        });
        
      } catch (error) {
        console.error('❌ ❌ ❌ ERRO CRÍTICO na rota de gravação:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error name:', error.name);
        return reply.code(500).send({ 
          error: 'Ocorreu um erro inesperado no servidor',
          message: error.message
        });
      } finally {
        console.log('🏁 === FIM DA ROTA DE GRAVAÇÃO ===');
      }
    }
  });

  // Parar gravação contínua de uma câmera
  fastify.post('/cameras/:id/recording/stop', {
    preHandler: authenticate, // Apenas autenticação básica
    handler: async (request, reply) => {
      try {
        const { id: cameraId } = request.params;
        const { role, id: userId } = request.user;
        
        console.log(`🛑 Parando gravação contínua para câmera: ${cameraId}`);
        console.log(`👤 Usuário: ${userId}, Role: ${role}`);
        
        // Verificar se é ADMIN ou INTEGRATOR (simplificado)
        if (role !== 'ADMIN' && role !== 'INTEGRATOR') {
          console.log(`❌ Permissão negada para role: ${role}`);
          return reply.code(403).send({ 
            error: 'Apenas administradores e integradores podem parar gravações contínuas' 
          });
        }
        
        // Buscar a câmera usando Supabase
        const { supabase } = require('../services/supabase');
        
        const { data: camera, error: cameraError } = await supabase
          .from('cameras')
          .select(`
            *,
            clients(*),
            integrators(*)
          `)
          .eq('id', cameraId)
          .single();

        if (cameraError || !camera) {
          console.error('❌ Erro ao buscar câmera:', cameraError);
          return reply.code(404).send({ error: 'Câmera não encontrada' });
        }

        console.log(`📷 Câmera encontrada: ${camera.name}`);

        console.log(`🔄 Enviando comando para worker parar gravação...`);

        // Enviar comando para o worker parar a gravação
        const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3002';
        const workerResponse = await fetch(`${WORKER_URL}/recording/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cameraId }),
        });

        if (!workerResponse.ok) {
          const errorData = await workerResponse.json().catch(() => ({ message: 'Erro desconhecido do worker' }));
          console.error('❌ Erro do worker:', errorData);
          return reply.code(500).send({ 
            error: 'Falha ao parar gravação contínua', 
            details: errorData.message || 'Worker não respondeu corretamente'
          });
        }

        // Atualizar status da câmera no banco usando Supabase
        const { error: updateError } = await supabase
          .from('cameras')
          .update({ 
            recordingStatus: 'INACTIVE',
            updatedAt: new Date().toISOString()
          })
          .eq('id', cameraId);

        if (updateError) {
          console.error('❌ Erro ao atualizar status da câmera:', updateError);
        }

        const workerData = await workerResponse.json();
        console.log('✅ Gravação contínua parada com sucesso');
        
        return reply.send({
          success: true,
          message: 'Gravação contínua parada com sucesso',
          cameraId,
          workerResponse: workerData
        });
        
      } catch (error) {
        console.error('❌ Erro ao parar gravação contínua:', error);
        return reply.code(500).send({ 
          error: 'Ocorreu um erro inesperado no servidor',
          message: error.message
        });
      }
    }
  });
  
  // === ROTAS DE STREAMING HLS ===
  
  // Iniciar stream HLS de uma câmera
  fastify.post('/cameras/:id/stream/hls/start', {
    preHandler: isClient, // Pelo menos cliente
    handler: startHLSStream
  });

  // Parar stream HLS de uma câmera
  fastify.post('/cameras/:id/stream/hls/stop', {
    preHandler: isClient, // Pelo menos cliente
    handler: stopHLSStream
  });

  // Obter status do stream HLS de uma câmera
  fastify.get('/cameras/:id/stream/hls/status', {
    preHandler: isClient, // Pelo menos cliente
    handler: getHLSStreamStatus
  });

  // Listar todos os streams HLS ativos
  fastify.get('/streams/hls/active', {
    preHandler: isClient, // Pelo menos cliente
    handler: getActiveHLSStreams
  });
  
  // Rotas de streaming (legacy - manter compatibilidade)
  fastify.post('/cameras/:cameraId/stream/start', startStream);
  fastify.post('/cameras/:cameraId/stream/stop', stopStream);
  fastify.get('/cameras/:cameraId/stream/status', getStreamStatus);
  fastify.get('/streams/active', getActiveStreams);
}

module.exports = cameraRoutes; 