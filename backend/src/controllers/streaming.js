const { supabase } = require('../services/supabase');

/**
 * Inicia um stream para uma câmera específica
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function startStream(request, reply) {
  try {
    const { cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    // Verificar se a câmera existe e se o usuário tem permissão
    const { data: camera } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'Câmera não encontrada no sistema'
      });
    }
    
    // Verificar permissões
    if (role === 'INTEGRATOR') {
      const { data: integrator } = await supabase
        .from('integrators')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para controlar esta câmera'
        });
      }
    } else if (role === 'CLIENT') {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!client || camera.clientId !== client.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para controlar esta câmera'
        });
      }
    }
    
    // Verificar se já existe um stream ativo
    const { data: existingStream } = await supabase
      .from('camera_streams')
      .select('*')
      .eq('cameraId', cameraId)
      .eq('status', 'ACTIVE')
      .single();
    
    if (existingStream) {
      return reply.code(400).send({
        error: 'Stream já ativo',
        message: 'Já existe um stream ativo para esta câmera',
        stream: existingStream
      });
    }
    
    // Gerar informações do stream
    const streamId = `stream_${cameraId}_${Date.now()}`;
    const rtmpUrl = `rtmp://localhost:1935/live/${streamId}`;
    const hlsUrl = `http://localhost:8080/live/${streamId}.m3u8`;
    
    // Criar registro do stream
    const { data: newStream, error } = await supabase
      .from('camera_streams')
      .insert({
        cameraId,
        streamId,
        rtmpUrl,
        hlsUrl,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        startedBy: userId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar stream:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível iniciar o stream'
      });
    }
    
    // Atualizar status da câmera
    await supabase
      .from('cameras')
      .update({
        streamStatus: 'ACTIVE',
        status: 'online'
      })
      .eq('id', cameraId);
    
    return reply.code(200).send({
      message: 'Stream iniciado com sucesso',
      stream: newStream,
      instructions: {
        rtmp: `Para transmitir, use: ${rtmpUrl}`,
        hls: `Para assistir, acesse: ${hlsUrl}`
      }
    });
    
  } catch (error) {
    console.error('Erro ao iniciar stream:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível iniciar o stream'
    });
  }
}

/**
 * Para um stream ativo
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function stopStream(request, reply) {
  try {
    const { cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    // Verificar permissões (mesmo código do startStream)
    const { data: camera } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'Câmera não encontrada no sistema'
      });
    }
    
    // Verificar permissões
    if (role === 'INTEGRATOR') {
      const { data: integrator } = await supabase
        .from('integrators')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para controlar esta câmera'
        });
      }
    } else if (role === 'CLIENT') {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!client || camera.clientId !== client.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para controlar esta câmera'
        });
      }
    }
    
    // Buscar stream ativo
    const { data: activeStream } = await supabase
      .from('camera_streams')
      .select('*')
      .eq('cameraId', cameraId)
      .eq('status', 'ACTIVE')
      .single();
    
    if (!activeStream) {
      return reply.code(400).send({
        error: 'Nenhum stream ativo',
        message: 'Não há stream ativo para esta câmera'
      });
    }
    
    // Finalizar o stream
    const { error } = await supabase
      .from('camera_streams')
      .update({
        status: 'STOPPED',
        endedAt: new Date().toISOString(),
        endedBy: userId
      })
      .eq('id', activeStream.id);
    
    if (error) {
      console.error('Erro ao parar stream:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível parar o stream'
      });
    }
    
    // Atualizar status da câmera
    await supabase
      .from('cameras')
      .update({
        streamStatus: 'INACTIVE',
        status: 'offline'
      })
      .eq('id', cameraId);
    
    return reply.code(200).send({
      message: 'Stream parado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao parar stream:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível parar o stream'
    });
  }
}

/**
 * Obtém status do stream de uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getStreamStatus(request, reply) {
  try {
    const { cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    // Verificar se a câmera existe e permissões
    const { data: camera } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'Câmera não encontrada no sistema'
      });
    }
    
    // Verificar permissões (mesmo código anterior)
    if (role === 'INTEGRATOR') {
      const { data: integrator } = await supabase
        .from('integrators')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar esta câmera'
        });
      }
    } else if (role === 'CLIENT') {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!client || camera.clientId !== client.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar esta câmera'
        });
      }
    }
    
    // Buscar stream atual
    const { data: currentStream } = await supabase
      .from('camera_streams')
      .select('*')
      .eq('cameraId', cameraId)
      .order('startedAt', { ascending: false })
      .limit(1)
      .single();
    
    return reply.code(200).send({
      camera: {
        id: camera.id,
        name: camera.name,
        status: camera.status,
        streamStatus: camera.streamStatus,
        recordingStatus: camera.recordingStatus
      },
      stream: currentStream || null
    });
    
  } catch (error) {
    console.error('Erro ao obter status do stream:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível obter o status do stream'
    });
  }
}

/**
 * Lista todos os streams ativos
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getActiveStreams(request, reply) {
  try {
    const { role, id: userId } = request.user;
    
    let query = supabase
      .from('camera_streams')
      .select(`
        *,
        cameras:cameraId (
          name,
          clientId,
          integratorId
        )
      `)
      .eq('status', 'ACTIVE');
    
    // Filtrar baseado no role
    if (role === 'INTEGRATOR') {
      const { data: integrator } = await supabase
        .from('integrators')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!integrator) {
        return reply.code(404).send({
          error: 'Integrador não encontrado',
          message: 'Perfil de integrador não encontrado'
        });
      }
      
      // Filtrar streams das câmeras do integrador
      const { data: integratorCameras } = await supabase
        .from('cameras')
        .select('id')
        .eq('integratorId', integrator.id);
      
      const cameraIds = integratorCameras.map(c => c.id);
      query = query.in('cameraId', cameraIds);
    } 
    else if (role === 'CLIENT') {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!client) {
        return reply.code(404).send({
          error: 'Cliente não encontrado',
          message: 'Perfil de cliente não encontrado'
        });
      }
      
      // Filtrar streams das câmeras do cliente
      const { data: clientCameras } = await supabase
        .from('cameras')
        .select('id')
        .eq('clientId', client.id);
      
      const cameraIds = clientCameras.map(c => c.id);
      query = query.in('cameraId', cameraIds);
    }
    
    const { data: streams, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar streams:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível buscar os streams'
      });
    }
    
    return reply.code(200).send(streams);
    
  } catch (error) {
    console.error('Erro ao listar streams ativos:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível listar os streams ativos'
    });
  }
}

module.exports = {
  startStream,
  stopStream,
  getStreamStatus,
  getActiveStreams
}; 