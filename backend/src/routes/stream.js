const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Configurar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3002';

/**
 * Rotas para gerenciamento de streams
 * @param {Object} fastify - Instância do Fastify
 */
async function routes(fastify, options) {
  
  // Iniciar stream de câmera
  fastify.post('/start', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { cameraId } = request.body;
    const userId = request.user.id;

    try {
      console.log(`🎬 Iniciando stream para câmera: ${cameraId}`);
      
      // Buscar a câmera no banco de dados
      const { data: camera, error: cameraError } = await supabase
        .from('cameras')
        .select('*')
        .eq('id', cameraId)
        .single();

      if (cameraError || !camera) {
        console.log(`❌ Câmera não encontrada: ${cameraId}`);
        return reply.code(404).send({ 
          error: 'Câmera não encontrada',
          message: 'A câmera especificada não existe'
        });
      }

      console.log(`📹 Câmera encontrada: ${camera.name} (${camera.rtspUrl})`);

      // Verificar se a câmera tem URL RTSP configurada
      if (!camera.rtspUrl) {
        console.log(`❌ Câmera ${cameraId} não tem URL RTSP configurada`);
        return reply.code(400).send({ 
          error: 'Configuração inválida',
          message: 'Câmera não possui URL RTSP configurada'
        });
      }

      // Enviar comando para o worker iniciar o streaming
      console.log(`🔄 Enviando comando para worker: ${WORKER_URL}/api/streams/start`);
      
      const workerResponse = await fetch(`${WORKER_URL}/api/streams/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: camera.id,
          rtspUrl: camera.rtspUrl,
          cameraName: camera.name || `Camera-${camera.id}`,
          quality: 'medium'
        }),
      });

      const workerData = await workerResponse.json();
      console.log(`📡 Resposta do worker:`, workerData);

      if (!workerResponse.ok) {
        console.log(`❌ Worker retornou erro:`, workerData);
        return reply.code(500).send({ 
          error: 'Falha ao iniciar stream', 
          message: workerData.message || 'Erro no worker',
          details: workerData 
        });
      }

      // Atualizar câmera com URL de streaming se fornecida
      if (workerData.hlsUrl) {
        const { error: updateError } = await supabase
          .from('cameras')
          .update({ 
            hlsUrl: workerData.hlsUrl,
            streamStatus: 'ACTIVE',
            status: 'online'
          })
          .eq('id', cameraId);

        if (updateError) {
          console.log(`⚠️ Erro ao atualizar câmera:`, updateError);
        } else {
          console.log(`✅ Câmera atualizada com HLS URL: ${workerData.hlsUrl}`);
        }
      }

      return reply.code(200).send({
        success: true,
        message: 'Stream iniciado com sucesso',
        data: {
          cameraId: camera.id,
          hlsUrl: workerData.hlsUrl,
          status: 'ACTIVE'
        }
      });

    } catch (error) {
      console.error('❌ Erro ao iniciar stream:', error);
      return reply.code(500).send({ 
        error: 'Erro interno',
        message: 'Erro interno ao iniciar stream',
        details: error.message
      });
    }
  });

  // Parar stream de câmera
  fastify.post('/stop', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { cameraId } = request.body;

    try {
      console.log(`🛑 Parando stream para câmera: ${cameraId}`);
      
      // Buscar a câmera no banco de dados
      const { data: camera, error: cameraError } = await supabase
        .from('cameras')
        .select('*')
        .eq('id', cameraId)
        .single();

      if (cameraError || !camera) {
        return reply.code(404).send({ 
          error: 'Câmera não encontrada',
          message: 'A câmera especificada não existe'
        });
      }

      // Enviar comando para o worker parar o streaming
      const workerResponse = await fetch(`${WORKER_URL}/api/streams/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: camera.id
        }),
      });

      const workerData = await workerResponse.json();

      if (!workerResponse.ok) {
        console.log(`❌ Worker retornou erro ao parar:`, workerData);
        return reply.code(500).send({ 
          error: 'Falha ao parar stream', 
          message: workerData.message || 'Erro no worker',
          details: workerData 
        });
      }

      // Atualizar câmera
      const { error: updateError } = await supabase
        .from('cameras')
        .update({ 
          hlsUrl: null,
          streamStatus: 'INACTIVE'
        })
        .eq('id', cameraId);

      if (updateError) {
        console.log(`⚠️ Erro ao atualizar câmera:`, updateError);
      }

      return reply.code(200).send({
        success: true,
        message: 'Stream encerrado com sucesso',
        data: {
          cameraId: camera.id
        }
      });

    } catch (error) {
      console.error('❌ Erro ao parar stream:', error);
      return reply.code(500).send({ 
        error: 'Erro interno',
        message: 'Erro interno ao parar stream'
      });
    }
  });

  // Obter status do stream de uma câmera
  fastify.get('/status/:cameraId', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { cameraId } = request.params;

    try {
      console.log(`📊 Obtendo status do stream para câmera: ${cameraId}`);
      
      // Consultar status no worker
      const workerResponse = await fetch(`${WORKER_URL}/api/streams/${cameraId}/status`);
      const workerData = await workerResponse.json();

      if (!workerResponse.ok) {
        console.log(`❌ Worker retornou erro ao obter status:`, workerData);
        return reply.code(500).send({ 
          error: 'Falha ao obter status', 
          message: workerData.message || 'Erro no worker'
        });
      }

      return reply.code(200).send({
        success: true,
        data: workerData
      });

    } catch (error) {
      console.error('❌ Erro ao obter status do stream:', error);
      return reply.code(500).send({ 
        error: 'Erro interno',
        message: 'Erro interno ao obter status do stream'
      });
    }
  });
}

module.exports = routes; 