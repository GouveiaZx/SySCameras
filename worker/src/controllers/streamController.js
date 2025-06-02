const streamingService = require('../services/streamingService');
const { supabase } = require('../services/supabase');

/**
 * Inicia stream HLS para uma câmera
 */
async function startStream(req, res) {
  try {
    const { cameraId, rtspUrl, cameraName, quality } = req.body;
    
    if (!cameraId) {
      return res.status(400).json({
        success: false,
        message: 'cameraId é obrigatório'
      });
    }

    console.log(`🎬 Solicitação para iniciar stream da câmera ${cameraId}`);
    console.log(`📊 Configurações: quality=${quality}, rtspUrl=${rtspUrl ? 'fornecida' : 'não fornecida'}`);

    let streamUrl = rtspUrl;
    let name = cameraName;

    // Se não foi fornecida URL diretamente, buscar no banco
    if (!streamUrl) {
      const { data: camera, error } = await supabase
        .from('cameras')
        .select('id, name, rtspUrl, status')
        .eq('id', cameraId)
        .single();

      if (error || !camera) {
        return res.status(404).json({
          success: false,
          message: 'Câmera não encontrada'
        });
      }

      if (!camera.rtspUrl) {
        return res.status(400).json({
          success: false,
          message: 'Câmera não possui URL RTSP configurada'
        });
      }

      streamUrl = camera.rtspUrl;
      name = camera.name;
    }

    // Validar protocolo da URL
    const isValidRTSP = streamUrl.toLowerCase().startsWith('rtsp://');
    const isValidRTMP = streamUrl.toLowerCase().startsWith('rtmp://');
    
    if (!isValidRTSP && !isValidRTMP) {
      return res.status(400).json({
        success: false,
        message: 'URL deve começar com rtsp:// ou rtmp://'
      });
    }

    // Aplicar configurações de qualidade se fornecidas
    const streamOptions = {};
    if (quality) {
      console.log(`🎯 Aplicando configurações de qualidade: ${quality}`);
      streamOptions.quality = quality;
    }

    // Iniciar stream HLS
    const result = await streamingService.startHLSStream(cameraId, streamUrl, streamOptions);

    if (result.success) {
      // Tentar atualizar URL HLS no banco se a câmera existe no banco
      try {
        await supabase
          .from('cameras')
          .update({ 
            hlsUrl: result.hlsUrl,
            streamStatus: 'ACTIVE',
            updatedAt: new Date().toISOString()
          })
          .eq('id', cameraId);
      } catch (dbError) {
        console.warn('⚠️ Não foi possível atualizar banco (câmera pode não existir no BD):', dbError.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Stream HLS iniciado com sucesso',
        data: {
          cameraId,
          cameraName: name || cameraId,
          hlsUrl: result.hlsUrl,
          streamInfo: result.streamInfo
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Erro ao iniciar stream:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

/**
 * Para stream HLS de uma câmera
 */
async function stopStream(req, res) {
  try {
    const { cameraId } = req.body;
    
    if (!cameraId) {
      return res.status(400).json({
        success: false,
        message: 'cameraId é obrigatório'
      });
    }

    console.log(`🛑 Solicitação para parar stream da câmera ${cameraId}`);

    // Parar stream
    const result = streamingService.stopHLSStream(cameraId);

    if (result.success) {
      // Atualizar status no banco de dados
      await supabase
        .from('cameras')
        .update({ 
          hlsUrl: null,
          streamStatus: 'INACTIVE',
          updatedAt: new Date().toISOString()
        })
        .eq('id', cameraId);

      return res.status(200).json({
        success: true,
        message: 'Stream HLS parado com sucesso',
        data: {
          cameraId
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Erro ao parar stream:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

/**
 * Obter status de um stream
 */
async function getStreamStatus(req, res) {
  try {
    const { cameraId } = req.params;
    
    if (!cameraId) {
      return res.status(400).json({
        success: false,
        message: 'cameraId é obrigatório'
      });
    }

    const status = streamingService.getStreamStatus(cameraId);

    return res.status(200).json({
      success: true,
      data: {
        cameraId,
        ...status
      }
    });

  } catch (error) {
    console.error('❌ Erro ao obter status do stream:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

/**
 * Listar todos os streams ativos
 */
async function getActiveStreams(req, res) {
  try {
    const streams = streamingService.getActiveStreams();

    return res.status(200).json({
      success: true,
      data: {
        totalStreams: streams.length,
        streams
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar streams ativos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

/**
 * Status geral do worker de streaming
 */
async function getWorkerStatus(req, res) {
  try {
    const streams = streamingService.getActiveStreams();
    const memoryUsage = process.memoryUsage();

    return res.status(200).json({
      success: true,
      data: {
        worker: {
          status: 'running',
          uptime: process.uptime(),
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
          }
        },
        streaming: {
          activeStreams: streams.length,
          streams: streams.map(stream => ({
            cameraId: stream.cameraId,
            status: stream.status,
            uptime: Math.round(stream.uptime / 1000) + 's'
          }))
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao obter status do worker:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

/**
 * 🆕 Alterar qualidade de um stream ativo
 */
async function changeStreamQuality(req, res) {
  try {
    const { cameraId } = req.params;
    const { quality } = req.body;
    
    if (!cameraId) {
      return res.status(400).json({
        success: false,
        message: 'cameraId é obrigatório'
      });
    }

    if (!quality) {
      return res.status(400).json({
        success: false,
        message: 'quality é obrigatório'
      });
    }

    console.log(`🎯 Solicitação para alterar qualidade da câmera ${cameraId} para: ${quality}`);

    const result = await streamingService.changeStreamQuality(cameraId, quality);

    if (result.success) {
      // Atualizar qualidade no banco de dados se possível
      try {
        await supabase
          .from('cameras')
          .update({ 
            quality: quality,
            updatedAt: new Date().toISOString()
          })
          .eq('id', cameraId);
      } catch (dbError) {
        console.warn('⚠️ Não foi possível atualizar qualidade no banco:', dbError.message);
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cameraId,
          newQuality: result.newQuality,
          config: result.config
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Erro ao alterar qualidade do stream:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

/**
 * 🆕 Obter qualidades disponíveis
 */
async function getAvailableQualities(req, res) {
  try {
    const qualities = streamingService.getAvailableQualities();

    return res.status(200).json({
      success: true,
      data: {
        qualities
      }
    });

  } catch (error) {
    console.error('❌ Erro ao obter qualidades:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

/**
 * 🆕 Forçar reconexão de um stream
 */
async function forceReconnect(req, res) {
  try {
    const { cameraId } = req.params;
    
    if (!cameraId) {
      return res.status(400).json({
        success: false,
        message: 'cameraId é obrigatório'
      });
    }

    console.log(`🔄 Solicitação para forçar reconexão da câmera ${cameraId}`);

    const streamInfo = streamingService.getStreamStatus(cameraId);
    
    if (!streamInfo.active) {
      return res.status(404).json({
        success: false,
        message: 'Stream não encontrado ou não está ativo'
      });
    }

    // Forçar reconexão
    await streamingService.reconnectStream(cameraId, streamInfo);

    return res.status(200).json({
      success: true,
      message: 'Reconexão iniciada com sucesso',
      data: {
        cameraId
      }
    });

  } catch (error) {
    console.error('❌ Erro ao forçar reconexão:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

/**
 * 🆕 Verificar saúde específica de um stream
 */
async function getStreamHealth(req, res) {
  try {
    const { cameraId } = req.params;
    
    if (!cameraId) {
      return res.status(400).json({
        success: false,
        message: 'cameraId é obrigatório'
      });
    }

    const streamInfo = streamingService.activeStreams.get(cameraId);
    
    if (!streamInfo) {
      return res.status(404).json({
        success: false,
        message: 'Stream não encontrado'
      });
    }

    const isHealthy = await streamingService.checkStreamHealth(cameraId, streamInfo);

    return res.status(200).json({
      success: true,
      data: {
        cameraId,
        isHealthy,
        healthCheck: {
          lastCheck: streamInfo.lastHealthCheck,
          consecutiveFailures: streamInfo.consecutiveFailures || 0,
          lastFailure: streamInfo.lastFailure,
          lastReconnection: streamInfo.lastReconnection
        },
        streamInfo: {
          status: streamInfo.status,
          uptime: Date.now() - streamInfo.startTime.getTime(),
          quality: streamInfo.quality,
          protocol: streamInfo.protocol
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar saúde do stream:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}

module.exports = {
  startStream,
  stopStream,
  getStreamStatus,
  getActiveStreams,
  getWorkerStatus,
  // 🆕 Novas funções
  changeStreamQuality,
  getAvailableQualities,
  forceReconnect,
  getStreamHealth
}; 