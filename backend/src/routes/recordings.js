const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Configurar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3002';

/**
 * Rotas de gravações para o Fastify
 * @param {FastifyInstance} fastify - Instância do Fastify
 * @param {Object} options - Opções do plugin
 */
async function recordingRoutes(fastify, options) {
  // Middleware de autenticação para todas as rotas de gravações
  fastify.addHook('preHandler', fastify.authenticate);
  
  // Lista gravações por câmera
  fastify.get('/:cameraId', async (request, reply) => {
    try {
      const { cameraId } = request.params;
      const { 
        page = 1, 
        limit = 10,
        startDate,
        endDate,
        type
      } = request.query;
      
      console.log(`🔍 Buscando gravações para câmera: ${cameraId}`);
      
      // Verificar se a câmera existe e se o usuário tem permissão
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

      // Construir query para gravações
      let query = supabase
        .from('recordings')
        .select('*', { count: 'exact' })
        .eq('cameraId', cameraId)
        .order('date', { ascending: false });

      // Aplicar filtros de data
      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }
      if (type) {
        query = query.eq('recordingType', type.toUpperCase());
      }

      // Aplicar paginação
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const from = (pageNum - 1) * limitNum;
      const to = from + limitNum - 1;
      
      query = query.range(from, to);

      const { data: recordings, error, count } = await query;

      if (error) {
        console.error('❌ Erro ao buscar gravações:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Erro ao buscar gravações'
        });
      }

      // Calcular metadados de paginação
      const totalPages = Math.ceil((count || 0) / limitNum);
      
      console.log(`✅ Gravações encontradas: ${recordings?.length || 0}`);
      
      return reply.code(200).send({
        data: recordings || [],
        meta: {
          total: count || 0,
          page: pageNum,
          limit: limitNum,
          totalPages
        }
      });

    } catch (error) {
      console.error('❌ Erro ao listar gravações:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Erro ao listar gravações'
      });
    }
  });

  // Iniciar gravação contínua
  fastify.post('/start/:cameraId', async (request, reply) => {
    try {
      const { cameraId } = request.params;
      const userId = request.user.id;

      console.log(`🎬 Iniciando gravação contínua para câmera: ${cameraId}`);
      
      // Buscar a câmera
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

      // Verificar se a câmera tem URL RTSP configurada
      if (!camera.rtspUrl) {
        return reply.code(400).send({ 
          error: 'Configuração inválida',
          message: 'Câmera não possui URL RTSP configurada'
        });
      }

      // Enviar comando para o worker iniciar a gravação
      const workerResponse = await fetch(`${WORKER_URL}/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          camera: {
            id: camera.id,
            name: camera.name,
            rtspUrl: camera.rtspUrl,
            userId: userId
          }
        }),
      });

      const workerData = await workerResponse.json();

      if (!workerResponse.ok) {
        console.log(`❌ Worker retornou erro:`, workerData);
        return reply.code(500).send({ 
          error: 'Falha ao iniciar gravação', 
          message: workerData.message || 'Erro no worker',
          details: workerData 
        });
      }

      // Atualizar status da câmera
      await supabase
        .from('cameras')
        .update({ recordingStatus: 'CONTINUOUS' })
        .eq('id', cameraId);

      return reply.code(200).send({
        success: true,
        message: 'Gravação contínua iniciada com sucesso',
        data: {
          cameraId: camera.id,
          status: 'CONTINUOUS'
        }
      });

    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error);
      return reply.code(500).send({ 
        error: 'Erro interno',
        message: 'Erro interno ao iniciar gravação',
        details: error.message
      });
    }
  });

  // Parar gravação contínua
  fastify.post('/stop/:cameraId', async (request, reply) => {
    try {
      const { cameraId } = request.params;

      console.log(`🛑 Parando gravação contínua para câmera: ${cameraId}`);

      // Enviar comando para o worker parar a gravação
      const workerResponse = await fetch(`${WORKER_URL}/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: cameraId
        }),
      });

      const workerData = await workerResponse.json();

      if (!workerResponse.ok) {
        console.log(`❌ Worker retornou erro:`, workerData);
        return reply.code(500).send({ 
          error: 'Falha ao parar gravação', 
          message: workerData.message || 'Erro no worker',
          details: workerData 
        });
      }

      // Atualizar status da câmera
      await supabase
        .from('cameras')
        .update({ recordingStatus: 'INACTIVE' })
        .eq('id', cameraId);

      return reply.code(200).send({
        success: true,
        message: 'Gravação contínua parada com sucesso',
        data: {
          cameraId: cameraId
        }
      });

    } catch (error) {
      console.error('❌ Erro ao parar gravação:', error);
      return reply.code(500).send({ 
        error: 'Erro interno',
        message: 'Erro interno ao parar gravação'
      });
    }
  });

  // Excluir uma gravação
  fastify.delete('/:recordingId', async (request, reply) => {
    try {
      const { recordingId } = request.params;
      const userId = request.user.id;
      const userRole = request.user.role;

      console.log(`🗑️ Excluindo gravação: ${recordingId}`);

      // Buscar a gravação
      const { data: recording, error: recordingError } = await supabase
        .from('recordings')
        .select('*')
        .eq('id', recordingId)
        .single();

      if (recordingError || !recording) {
        return reply.code(404).send({ 
          error: 'Gravação não encontrada',
          message: 'A gravação especificada não existe'
        });
      }

      // Verificar permissões (admin ou dono da câmera)
      const isAdmin = userRole === 'ADMIN';
      if (!isAdmin && recording.userId !== userId) {
        return reply.code(403).send({ 
          error: 'Sem permissão',
          message: 'Você não tem permissão para excluir esta gravação'
        });
      }

      // Excluir do banco de dados
      const { error: deleteError } = await supabase
        .from('recordings')
        .delete()
        .eq('id', recordingId);

      if (deleteError) {
        console.error('❌ Erro ao excluir gravação do banco:', deleteError);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Erro ao excluir gravação'
        });
      }

      return reply.code(200).send({
        success: true,
        message: 'Gravação excluída com sucesso',
        recordingId
      });

    } catch (error) {
      console.error('❌ Erro ao excluir gravação:', error);
      return reply.code(500).send({ 
        error: 'Erro interno',
        message: 'Erro interno ao excluir gravação'
      });
    }
  });
}

module.exports = recordingRoutes; 