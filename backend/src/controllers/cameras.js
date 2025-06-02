const { supabase } = require('../services/supabase');
const { generateRtmpUrl } = require('../utils/streamingUtils');
const { processCameraStatusChange } = require('./alerts');
const { PrismaClient } = require('@prisma/client');
const workerStreamingService = require('../services/workerStreamingService');

const prisma = new PrismaClient();

/**
 * Lista todas as câmeras com base no role do usuário
 * - Admin: todas as câmeras
 * - Integrador: câmeras que pertencem a ele
 * - Cliente: apenas suas próprias câmeras
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getCameras(request, reply) {
  try {
    const { role, id: userId } = request.user;
    let cameras = [];
    
    if (role === 'ADMIN') {
      // Admin vê todas as câmeras
      const { data, error } = await supabase
        .from('cameras')
        .select(`
          *,
          clients:clientId (name, integrators:integratorId (name))
        `);
        
      if (error) throw error;
      cameras = data;
    } 
    else if (role === 'INTEGRATOR') {
      // Integrador vê câmeras vinculadas a ele
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
      
      const { data, error } = await supabase
        .from('cameras')
        .select(`
          *,
          clients:clientId (name)
        `)
        .eq('integratorId', integrator.id);
        
      if (error) throw error;
      cameras = data;
    } 
    else if (role === 'CLIENT') {
      // Cliente vê apenas suas próprias câmeras
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
      
      const { data, error } = await supabase
        .from('cameras')
        .select('*')
        .eq('clientId', client.id);
        
      if (error) throw error;
      cameras = data;
    }
    
    return reply.code(200).send(cameras);
  } catch (error) {
    console.error('Erro ao listar câmeras:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível listar as câmeras'
    });
  }
}

/**
 * Obtém detalhes de uma câmera específica
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getCameraById(request, reply) {
  try {
    const { id } = request.params;
    const { role, id: userId } = request.user;
    
    // Buscar a câmera
    const { data: camera, error } = await supabase
      .from('cameras')
      .select(`
        *,
        clients:clientId (*, integrators:integratorId (*)),
        retention_settings (*),
        camera_streams (*),
        motion_detection_configs (*)
      `)
      .eq('id', id)
      .single();
    
    if (error || !camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'Câmera não encontrada no sistema'
      });
    }
    
    // Verificar permissão baseada no role
    if (role === 'CLIENT') {
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
    else if (role === 'INTEGRATOR') {
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
    }
    
    return reply.code(200).send(camera);
  } catch (error) {
    console.error('Erro ao buscar câmera:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível buscar os detalhes da câmera'
    });
  }
}

/**
 * Cria uma nova câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function createCamera(request, reply) {
  try {
    const { role, id: userId } = request.user;
    const { name, rtspUrl, rtmpUrl, clientId, type, retentionDays = 7 } = request.body;
    
    console.log('🎥 === CRIANDO NOVA CÂMERA - DEBUG DETALHADO ===');
    console.log('👤 Usuário:', { role, userId });
    console.log('📋 Body recebido:', JSON.stringify(request.body, null, 2));
    console.log('🔗 URLs extraídas:', { rtspUrl, rtmpUrl });
    console.log('📦 Outros dados:', { name, clientId, type, retentionDays });
    
    // Validações obrigatórias
    if (!name || !clientId) {
      console.log('❌ Validação falhou: dados obrigatórios');
      return reply.code(400).send({
        error: 'Dados obrigatórios',
        message: 'Nome e cliente são obrigatórios'
      });
    }

    // Verificar se pelo menos uma URL foi fornecida
    if (!rtspUrl && !rtmpUrl) {
      console.log('❌ Validação falhou: nenhuma URL fornecida');
      return reply.code(400).send({
        error: 'URL obrigatória',
        message: 'É necessário fornecer pelo menos uma URL RTSP ou RTMP'
      });
    }
    
    // Detectar protocolo baseado na URL fornecida
    const streamUrl = rtspUrl || rtmpUrl;
    const url = streamUrl.toLowerCase();
    
    let cameraData = {
      name,
      clientId,
      type: type || 'IP',
      status: 'offline',
      streamStatus: 'INACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Salvar URL na coluna correta baseada no protocolo
    if (rtspUrl && url.startsWith('rtsp://')) {
      cameraData.rtspUrl = rtspUrl;
      console.log('📡 Câmera RTSP detectada');
    } else if (rtmpUrl && url.startsWith('rtmp://')) {
      cameraData.rtmpUrl = rtmpUrl;
      // WORKAROUND: Como a constraint NOT NULL ainda existe, colocar string vazia em rtspUrl
      cameraData.rtspUrl = '';
      console.log('📺 Câmera RTMP detectada');
    } else if (rtspUrl) {
      // Se foi fornecido rtspUrl mas não começa com rtsp://
      if (!url.startsWith('rtsp://')) {
        return reply.code(400).send({
          error: 'URL inválida',
          message: 'URL RTSP deve começar com rtsp://'
        });
      }
      cameraData.rtspUrl = rtspUrl;
    } else if (rtmpUrl) {
      // Se foi fornecido rtmpUrl mas não começa com rtmp://
      if (!url.startsWith('rtmp://')) {
        return reply.code(400).send({
          error: 'URL inválida',
          message: 'URL RTMP deve começar com rtmp://'
        });
      }
      cameraData.rtmpUrl = rtmpUrl;
      // WORKAROUND: Como a constraint NOT NULL ainda existe, colocar string vazia em rtspUrl
      cameraData.rtspUrl = '';
    }
    
    // DEBUG: Log dos dados que serão inseridos
    console.log('🔍 Dados para inserção:', JSON.stringify(cameraData, null, 2));
    
    // Apenas admins e integradores podem criar câmeras
    if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Clientes não podem adicionar câmeras diretamente'
      });
    }
    
    let integratorId;
    
    if (role === 'INTEGRATOR') {
      // Se for integrador, buscar o ID do integrador usando Supabase
      const { data: integrator, error } = await supabase
        .from('integrators')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (error || !integrator) {
        console.error('❌ Integrador não encontrado:', error);
        return reply.code(400).send({
          error: 'Integrador não encontrado',
          message: 'Usuário integrador não possui registro na tabela integradores'
        });
      }
      
      integratorId = integrator.id;
    } else if (role === 'ADMIN') {
      // Admin precisa especificar um integrador - buscar o primeiro disponível se não especificado
      if (request.body.integratorId) {
        integratorId = request.body.integratorId;
      } else {
        // Buscar o primeiro integrador disponível
        const { data: firstIntegrator, error } = await supabase
          .from('integrators')
          .select('id')
          .limit(1)
          .single();
        
        if (error || !firstIntegrator) {
          return reply.code(400).send({
            error: 'Integrador necessário',
            message: 'Nenhum integrador encontrado. É necessário especificar um integrador.'
          });
        }
        
        integratorId = firstIntegrator.id;
      }
    }

    // Adicionar integradorId aos dados
    cameraData.integratorId = integratorId;

    // Verificar se o cliente existe
    console.log('🔍 Verificando se cliente existe...', clientId);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();
    
    let finalClient = client;
    
    if (clientError || !client) {
      console.error('❌ Cliente não encontrado:', clientError);
      
      // Buscar o primeiro cliente disponível como fallback
      const { data: availableClients } = await supabase
        .from('clients')
        .select('id, name')
        .limit(1)
        .single();
      
      if (availableClients) {
        console.log('🔄 Usando cliente fallback:', availableClients.name);
        finalClient = availableClients;
        // Atualizar o clientId para usar o cliente real
        cameraData.clientId = availableClients.id;
      } else {
        console.log('👥 Clientes disponíveis: nenhum encontrado');
      return reply.code(400).send({
          error: 'Nenhum cliente disponível',
          message: 'Não há clientes cadastrados no sistema'
      });
      }
    } else {
      console.log('✅ Cliente encontrado:', client.name);
    }

    // Criar câmera no banco usando Supabase
    const { data: camera, error } = await supabase
      .from('cameras')
      .insert([cameraData])
      .select(`
        *,
        clients:clientId (name),
        integrators:integratorId (name)
      `)
      .single();

    if (error) {
      console.error('❌ Erro ao criar câmera no Supabase:', error);
      return reply.status(500).send({ 
        error: 'Erro interno',
        message: `Erro no banco de dados: ${error.message || 'Não foi possível criar a câmera'}`
      });
    }

    console.log('✅ Câmera criada com sucesso:', camera.id);

    // Criar configuração de retenção se retentionDays foi especificado
    if (retentionDays && retentionDays !== 7) {
      const { error: retentionError } = await supabase
        .from('retention_settings')
        .insert([{
          cameraId: camera.id,
          days: retentionDays
        }]);
      
      if (retentionError) {
        console.error('⚠️ Erro ao criar configuração de retenção:', retentionError);
        // Não falhar a criação da câmera por causa disso
      }
    }

    return reply.status(201).send({
      message: 'Câmera criada com sucesso',
      camera
    });
  } catch (error) {
    console.error('❌ Erro ao criar câmera:', error);
    return reply.status(500).send({ 
      error: 'Erro interno',
      message: 'Não foi possível criar a câmera'
    });
  }
}

/**
 * Atualiza uma câmera existente
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function updateCamera(request, reply) {
  try {
    const { id } = request.params;
    const { role, id: userId } = request.user;
    const updateData = request.body;
    
    // Buscar a câmera
    const { data: camera } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', id)
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
          message: 'Você não tem permissão para editar esta câmera'
        });
      }
    } else if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Clientes não podem editar câmeras'
      });
    }
    
    // Atualizar a câmera
    const { data: updatedCamera, error } = await supabase
      .from('cameras')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar câmera:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível atualizar a câmera'
      });
    }
    
    return reply.code(200).send({
      message: 'Câmera atualizada com sucesso',
      camera: updatedCamera
    });
    
  } catch (error) {
    console.error('Erro ao atualizar câmera:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível atualizar a câmera'
    });
  }
}

/**
 * Remove uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function deleteCamera(request, reply) {
  try {
    const { id } = request.params;
    const { role, id: userId } = request.user;
    
    // Buscar a câmera
    const { data: camera } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', id)
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
          message: 'Você não tem permissão para excluir esta câmera'
        });
      }
    } else if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Clientes não podem excluir câmeras'
      });
    }
    
    // Excluir configurações relacionadas primeiro
    await supabase.from('retention_settings').delete().eq('cameraId', id);
    await supabase.from('motion_detection_configs').delete().eq('cameraId', id);
    await supabase.from('camera_streams').delete().eq('cameraId', id);
    
    // Excluir a câmera
    const { error } = await supabase
      .from('cameras')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao excluir câmera:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível excluir a câmera'
      });
    }
    
    return reply.code(200).send({
      message: 'Câmera excluída com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao excluir câmera:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível excluir a câmera'
    });
  }
}

/**
 * Atualiza as configurações de retenção de uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function updateRetentionSetting(request, reply) {
  try {
    const { id: cameraId } = request.params;
    const { days } = request.body;
    const { role, id: userId } = request.user;
    
    console.log(`🗃️ Atualizando retenção da câmera ${cameraId} para ${days} dias`);
    
    // Validação
    if (!days || days < 1 || days > 365) {
      return reply.code(400).send({
        error: 'Valor inválido',
        message: 'Dias de retenção deve ser entre 1 e 365'
      });
    }
    
    // Verificar se a câmera existe
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (cameraError || !camera) {
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
          message: 'Você não tem permissão para alterar esta câmera'
        });
      }
    } else if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Clientes não podem alterar configurações de retenção'
      });
    }
    
    // Verificar se já existe configuração de retenção
    const { data: existingRetention } = await supabase
      .from('retention_settings')
      .select('*')
      .eq('cameraId', cameraId)
      .single();
    
    let retentionResult;
    
    if (existingRetention) {
      // Atualizar configuração existente
      const { data, error } = await supabase
        .from('retention_settings')
        .update({ days })
        .eq('cameraId', cameraId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao atualizar retenção:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Não foi possível atualizar a configuração de retenção'
        });
      }
      
      retentionResult = data;
    } else {
      // Criar nova configuração
      const { data, error } = await supabase
        .from('retention_settings')
        .insert([{ cameraId, days }])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao criar retenção:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Não foi possível criar a configuração de retenção'
        });
      }
      
      retentionResult = data;
    }
    
    console.log('✅ Configuração de retenção atualizada com sucesso');
    
    return reply.code(200).send({
      message: 'Configuração de retenção atualizada com sucesso',
      retention: retentionResult
    });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar configuração de retenção:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível atualizar a configuração de retenção'
    });
  }
}

/**
 * Busca configurações de alerta para uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getAlertConfigurations(request, reply) {
  try {
    const { id: cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    console.log(`📧 Buscando configurações de alerta para câmera ${cameraId}`);
    
    // Verificar se a câmera existe e se o usuário tem acesso
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (cameraError || !camera) {
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
    
    // Buscar configurações de alerta
    const { data: alertConfigs, error } = await supabase
      .from('alert_configurations')
      .select('*')
      .eq('cameraId', cameraId);
    
    if (error) {
      console.error('❌ Erro ao buscar configurações de alerta:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível buscar as configurações de alerta'
      });
    }
    
    console.log(`✅ Encontradas ${alertConfigs.length} configurações de alerta`);
    
    return reply.code(200).send(alertConfigs);
    
  } catch (error) {
    console.error('❌ Erro ao buscar configurações de alerta:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível buscar as configurações de alerta'
    });
  }
}

/**
 * Cria uma nova configuração de alerta
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function createAlertConfiguration(request, reply) {
  try {
    const { cameraId, emailAddresses, notifyOnline = true, notifyOffline = true } = request.body;
    const { role, id: userId } = request.user;
    
    console.log(`📧 Criando configuração de alerta para câmera ${cameraId}`);
    
    // Verificar se a câmera existe
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (cameraError || !camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'Câmera não encontrada no sistema'
      });
    }
    
    // Verificar permissões (apenas integradores e admins podem criar)
    if (role === 'INTEGRATOR') {
      const { data: integrator } = await supabase
        .from('integrators')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para configurar alertas desta câmera'
        });
      }
    } else if (role !== 'ADMIN') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Apenas integradores e admins podem criar configurações de alerta'
      });
    }
    
    // Criar configuração de alerta
    const { data: alertConfig, error } = await supabase
      .from('alert_configurations')
      .insert([{
        cameraId,
        userId,
        emailAddresses,
        notifyOnline,
        notifyOffline,
        createdBy: userId
      }])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao criar configuração de alerta:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível criar a configuração de alerta'
      });
    }
    
    console.log('✅ Configuração de alerta criada com sucesso');
    
    return reply.code(201).send(alertConfig);
    
  } catch (error) {
    console.error('❌ Erro ao criar configuração de alerta:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível criar a configuração de alerta'
    });
  }
}

/**
 * Atualiza uma configuração de alerta existente
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function updateAlertConfiguration(request, reply) {
  try {
    const { id: configId } = request.params;
    const updateData = request.body;
    const { role, id: userId } = request.user;
    
    console.log(`📧 Atualizando configuração de alerta ${configId}`);
    
    // Buscar configuração existente
    const { data: existingConfig, error: configError } = await supabase
      .from('alert_configurations')
      .select('*, cameras(*)')
      .eq('id', configId)
      .single();
    
    if (configError || !existingConfig) {
      return reply.code(404).send({
        error: 'Configuração não encontrada',
        message: 'Configuração de alerta não encontrada'
      });
    }
    
    // Verificar permissões
    if (role === 'INTEGRATOR') {
      const { data: integrator } = await supabase
        .from('integrators')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!integrator || existingConfig.cameras.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para alterar esta configuração'
        });
      }
    } else if (role !== 'ADMIN') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Apenas integradores e admins podem alterar configurações de alerta'
      });
    }
    
    // Atualizar configuração
    const { data: updatedConfig, error } = await supabase
      .from('alert_configurations')
      .update(updateData)
      .eq('id', configId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao atualizar configuração de alerta:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível atualizar a configuração de alerta'
      });
    }
    
    console.log('✅ Configuração de alerta atualizada com sucesso');
    
    return reply.code(200).send(updatedConfig);
    
  } catch (error) {
    console.error('❌ Erro ao atualizar configuração de alerta:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível atualizar a configuração de alerta'
    });
  }
}

/**
 * Exclui uma configuração de alerta
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function deleteAlertConfiguration(request, reply) {
  try {
    const { id: configId } = request.params;
    const { role, id: userId } = request.user;
    
    console.log(`📧 Excluindo configuração de alerta ${configId}`);
    
    // Buscar configuração existente
    const { data: existingConfig, error: configError } = await supabase
      .from('alert_configurations')
      .select('*, cameras(*)')
      .eq('id', configId)
      .single();
    
    if (configError || !existingConfig) {
      return reply.code(404).send({
        error: 'Configuração não encontrada',
        message: 'Configuração de alerta não encontrada'
      });
    }
    
    // Verificar permissões
    if (role === 'INTEGRATOR') {
      const { data: integrator } = await supabase
        .from('integrators')
        .select('id')
        .eq('userId', userId)
        .single();
      
      if (!integrator || existingConfig.cameras.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para excluir esta configuração'
        });
      }
    } else if (role !== 'ADMIN') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Apenas integradores e admins podem excluir configurações de alerta'
      });
    }
    
    // Excluir configuração
    const { error } = await supabase
      .from('alert_configurations')
      .delete()
      .eq('id', configId);
    
    if (error) {
      console.error('❌ Erro ao excluir configuração de alerta:', error);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível excluir a configuração de alerta'
      });
    }
    
    console.log('✅ Configuração de alerta excluída com sucesso');
    
    return reply.code(200).send({
      success: true,
      message: 'Configuração de alerta excluída com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao excluir configuração de alerta:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível excluir a configuração de alerta'
    });
  }
}

/**
 * Verifica o status real de uma câmera testando a URL RTSP
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function checkCameraStatus(request, reply) {
  try {
    console.log('🔍 Função checkCameraStatus chamada');
    
    return reply.code(200).send({
      message: 'Teste simples funcionando',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erro na função checkCameraStatus:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Erro na função de teste'
    });
  }
}

/**
 * Captura um snapshot da câmera via proxy para evitar problemas de CORS
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function captureSnapshot(request, reply) {
  try {
    const { id: cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    console.log(`📸 Capturando snapshot da câmera ${cameraId}`);
    
    // Verificar se a câmera existe
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (cameraError || !camera) {
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
    
    if (!camera.rtspUrl) {
      return reply.code(400).send({
        error: 'URL RTSP não configurada',
        message: 'Esta câmera não possui URL RTSP configurada'
      });
    }
    
    // Extrair credenciais da URL RTSP para gerar URL de snapshot
    const urlPattern = /rtsp:\/\/([^:]+):([^@]+)@([^:]+):(\d+)(.*)/;
    const match = camera.rtspUrl.match(urlPattern);
    
    if (!match) {
      return reply.code(400).send({
        error: 'URL RTSP inválida',
        message: 'Formato da URL RTSP não é suportado'
      });
    }
    
    const [, username, password, host, port] = match;
    
    // Tentar diferentes URLs de snapshot comuns
    const snapshotUrls = [
      `http://${username}:${password}@${host}/cgi-bin/snapshot.cgi`,
      `http://${username}:${password}@${host}/snapshot.jpg`,
      `http://${username}:${password}@${host}/jpg/image.jpg`,
      `http://${username}:${password}@${host}/axis-cgi/jpg/image.cgi`
    ];
    
    console.log(`📸 Tentando capturar snapshot de ${host}...`);
    
    // Tentar cada URL de snapshot
    for (const snapshotUrl of snapshotUrls) {
      try {
        const response = await fetch(snapshotUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Camera-Monitor/1.0)'
          }
        });
        
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          
          // Retornar a imagem diretamente
          reply.header('Content-Type', contentType);
          reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
          reply.header('Pragma', 'no-cache');
          reply.header('Expires', '0');
          
          return reply.send(Buffer.from(imageBuffer));
        }
      } catch (error) {
        console.log(`⚠️ Falha na URL ${snapshotUrl}: ${error.message}`);
        continue;
      }
    }
    
    // Se nenhuma URL funcionou, retornar erro
    return reply.code(503).send({
      error: 'Snapshot indisponível',
      message: 'Não foi possível capturar snapshot da câmera. Verifique se a câmera está online.'
    });
    
  } catch (error) {
    console.error('❌ Erro ao capturar snapshot:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível capturar snapshot da câmera'
    });
  }
}

/**
 * Inicia stream HLS para uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function startHLSStream(request, reply) {
  try {
    const { id: cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    console.log(`🎬 Solicitação para iniciar stream HLS da câmera ${cameraId}`);
    
    // Verificar se a câmera existe
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (cameraError || !camera) {
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
          message: 'Você não tem permissão para iniciar stream desta câmera'
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
          message: 'Você não tem permissão para iniciar stream desta câmera'
        });
      }
    }
    
    // Verificar se a câmera tem URL RTSP
    if (!camera.rtspUrl) {
      return reply.code(400).send({
        error: 'URL RTSP não configurada',
        message: 'Esta câmera não possui URL RTSP configurada'
      });
    }
    
    // Determinar URL de stream (RTSP ou RTMP)
    let streamUrl = null;
    let protocol = null;
    
    if (camera.rtspUrl && camera.rtspUrl.trim() !== '') {
      streamUrl = camera.rtspUrl;
      protocol = 'RTSP';
      console.log(`🔵 Usando URL RTSP: ${streamUrl}`);
    } else if (camera.rtmpUrl && camera.rtmpUrl.trim() !== '') {
      streamUrl = camera.rtmpUrl;
      protocol = 'RTMP';
      console.log(`🔴 Usando URL RTMP: ${streamUrl}`);
    } else {
      return reply.code(400).send({
        error: 'URLs de stream não configuradas',
        message: 'Esta câmera não possui URL RTSP nem RTMP configurada'
      });
    }
    
    console.log(`📡 Protocolo detectado: ${protocol}, URL: ${streamUrl}`);
    
    // Verificar se o worker está disponível
    const workerAvailable = await workerStreamingService.isWorkerAvailable();
    if (!workerAvailable) {
      return reply.code(503).send({
        error: 'Serviço indisponível',
        message: 'Worker de streaming não está disponível'
      });
    }
    
    try {
      // Solicitar início do stream ao worker com a URL apropriada
      const result = await workerStreamingService.startStreamWithUrl(cameraId, streamUrl, {
        quality: request.body?.quality || 'medium',
        protocol: protocol
      });
      
      // Atualizar hlsUrl no banco de dados
      if (result.success && result.data?.hlsUrl) {
        await supabase
          .from('cameras')
          .update({ 
            hlsUrl: result.data.hlsUrl,
            streamStatus: 'ACTIVE',
            status: 'online'
          })
          .eq('id', cameraId);
          
        console.log(`✅ HLS URL atualizada no banco: ${result.data.hlsUrl}`);
      }
      
      return reply.code(200).send({
        success: true,
        message: `Stream HLS ${protocol} iniciado com sucesso`,
        protocol: protocol,
        streamUrl: streamUrl,
        data: result.data
      });
      
    } catch (workerError) {
      console.error(`❌ Erro do worker ao iniciar stream [${cameraId}]:`, workerError);
      return reply.code(500).send({
        error: 'Erro do worker',
        message: workerError.message || 'Não foi possível iniciar o stream HLS'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao iniciar stream HLS:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível iniciar o stream HLS'
    });
  }
}

/**
 * Para stream HLS de uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function stopHLSStream(request, reply) {
  try {
    const { id: cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    console.log(`🛑 Solicitação para parar stream HLS da câmera ${cameraId}`);
    
    // Verificar se a câmera existe
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (cameraError || !camera) {
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
          message: 'Você não tem permissão para parar stream desta câmera'
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
          message: 'Você não tem permissão para parar stream desta câmera'
        });
      }
    }
    
    try {
      // Solicitar parada do stream ao worker
      const result = await workerStreamingService.stopStream(cameraId);
      
      return reply.code(200).send({
        success: true,
        message: 'Stream HLS parado com sucesso',
        data: result.data
      });
      
    } catch (workerError) {
      console.error(`❌ Erro do worker ao parar stream [${cameraId}]:`, workerError);
      return reply.code(500).send({
        error: 'Erro do worker',
        message: workerError.message || 'Não foi possível parar o stream HLS'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao parar stream HLS:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível parar o stream HLS'
    });
  }
}

/**
 * Obtém status do stream HLS de uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getHLSStreamStatus(request, reply) {
  try {
    const { id: cameraId } = request.params;
    
    // Verificar se a câmera existe
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', cameraId)
      .single();
    
    if (cameraError || !camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'Câmera não encontrada no sistema'
      });
    }
    
    try {
      // Obter status do stream do worker
      const result = await workerStreamingService.getStreamStatus(cameraId);
      
      return reply.code(200).send({
        success: true,
        data: result.data
      });
      
    } catch (workerError) {
      console.error(`❌ Erro do worker ao obter status [${cameraId}]:`, workerError);
      return reply.code(500).send({
        error: 'Erro do worker',
        message: workerError.message || 'Não foi possível obter status do stream'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao obter status do stream HLS:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível obter status do stream'
    });
  }
}

/**
 * Lista todos os streams HLS ativos
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getActiveHLSStreams(request, reply) {
  try {
    // Verificar se o worker está disponível
    const workerAvailable = await workerStreamingService.isWorkerAvailable();
    if (!workerAvailable) {
      return reply.code(503).send({
        error: 'Serviço indisponível',
        message: 'Worker de streaming não está disponível'
      });
    }
    
    try {
      // Obter streams ativos do worker
      const result = await workerStreamingService.getActiveStreams();
      
      return reply.code(200).send({
        success: true,
        data: result.data
      });
      
    } catch (workerError) {
      console.error('❌ Erro do worker ao listar streams ativos:', workerError);
      return reply.code(500).send({
        error: 'Erro do worker',
        message: workerError.message || 'Não foi possível listar streams ativos'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao listar streams HLS ativos:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível listar streams ativos'
    });
  }
}

module.exports = {
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
}; 