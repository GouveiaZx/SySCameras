const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Obtém a configuração de detecção de movimento para uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getMotionDetectionConfig(request, reply) {
  try {
    const { cameraId } = request.params;
    const { role, id: userId } = request.user;
    
    // Verificar se a câmera existe
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      include: {
        client: true,
        integrator: true
      }
    });
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'A câmera solicitada não existe'
      });
    }
    
    // Verificar permissões
    if (role === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { userId }
      });
      
      if (!client || camera.clientId !== client.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar esta câmera'
        });
      }
    } else if (role === 'INTEGRATOR') {
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para acessar esta câmera'
        });
      }
    }
    
    // Buscar configuração existente ou retornar configuração padrão
    const config = await prisma.motionDetectionConfig.findUnique({
      where: { cameraId }
    });
    
    if (!config) {
      return reply.code(200).send({
        cameraId,
        enabled: false,
        sensitivity: 50,
        minMotionDuration: 3,
        preRecordingBuffer: 5,
        postRecordingBuffer: 10,
        notifyOnMotion: false,
        recordOnMotion: true,
        cooldownPeriod: 60,
        detectionAreas: null
      });
    }
    
    return reply.code(200).send(config);
    
  } catch (error) {
    console.error('Erro ao buscar configuração de detecção de movimento:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao buscar configuração de detecção de movimento'
    });
  }
}

/**
 * Cria ou atualiza configuração de detecção de movimento para uma câmera
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function saveMotionDetectionConfig(request, reply) {
  try {
    const { cameraId } = request.params;
    const { role, id: userId } = request.user;
    const {
      enabled,
      sensitivity,
      minMotionDuration,
      preRecordingBuffer,
      postRecordingBuffer,
      notifyOnMotion,
      recordOnMotion,
      detectionAreas,
      cooldownPeriod
    } = request.body;
    
    // Verificar se a câmera existe
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      include: {
        client: true,
        integrator: true
      }
    });
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'A câmera solicitada não existe'
      });
    }
    
    // Verificar permissões (apenas integradores e admins podem configurar)
    if (role === 'CLIENT') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Apenas integradores e administradores podem configurar detecção de movimento'
      });
    } else if (role === 'INTEGRATOR') {
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para configurar esta câmera'
        });
      }
    }
    
    // Validar dados
    if (sensitivity !== undefined && (sensitivity < 1 || sensitivity > 100)) {
      return reply.code(400).send({
        error: 'Dados inválidos',
        message: 'Sensibilidade deve estar entre 1 e 100'
      });
    }
    
    // Criar ou atualizar configuração
    const config = await prisma.motionDetectionConfig.upsert({
      where: { cameraId },
      update: {
        enabled: enabled !== undefined ? enabled : undefined,
        sensitivity: sensitivity !== undefined ? sensitivity : undefined,
        minMotionDuration: minMotionDuration !== undefined ? minMotionDuration : undefined,
        preRecordingBuffer: preRecordingBuffer !== undefined ? preRecordingBuffer : undefined,
        postRecordingBuffer: postRecordingBuffer !== undefined ? postRecordingBuffer : undefined,
        notifyOnMotion: notifyOnMotion !== undefined ? notifyOnMotion : undefined,
        recordOnMotion: recordOnMotion !== undefined ? recordOnMotion : undefined,
        detectionAreas: detectionAreas !== undefined ? detectionAreas : undefined,
        cooldownPeriod: cooldownPeriod !== undefined ? cooldownPeriod : undefined,
      },
      create: {
        cameraId,
        enabled: enabled !== undefined ? enabled : false,
        sensitivity: sensitivity !== undefined ? sensitivity : 50,
        minMotionDuration: minMotionDuration !== undefined ? minMotionDuration : 3,
        preRecordingBuffer: preRecordingBuffer !== undefined ? preRecordingBuffer : 5,
        postRecordingBuffer: postRecordingBuffer !== undefined ? postRecordingBuffer : 10,
        notifyOnMotion: notifyOnMotion !== undefined ? notifyOnMotion : false,
        recordOnMotion: recordOnMotion !== undefined ? recordOnMotion : true,
        detectionAreas: detectionAreas !== undefined ? detectionAreas : null,
        cooldownPeriod: cooldownPeriod !== undefined ? cooldownPeriod : 60,
      }
    });
    
    return reply.code(200).send(config);
    
  } catch (error) {
    console.error('Erro ao salvar configuração de detecção de movimento:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao salvar configuração de detecção de movimento'
    });
  }
}

/**
 * Processa alerta de movimento detectado e inicia gravação se configurado
 * Esta função seria chamada pelo sistema de detecção de movimento
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function handleMotionDetected(request, reply) {
  try {
    const { cameraId } = request.params;
    const { confidence, timestamp } = request.body;
    
    // Verificar se a câmera existe
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      include: {
        motionDetection: true
      }
    });
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'A câmera solicitada não existe'
      });
    }
    
    // Verificar se a detecção de movimento está habilitada
    if (!camera.motionDetection || !camera.motionDetection.enabled) {
      return reply.code(200).send({
        message: 'Detecção de movimento não está habilitada para esta câmera',
        action: 'none'
      });
    }
    
    // Verificar se a confiança do movimento está acima do limite de sensibilidade
    const sensitivity = camera.motionDetection.sensitivity || 50;
    const confidenceThreshold = 100 - sensitivity; // Inverte a escala para facilitar a comparação
    
    if (confidence < confidenceThreshold) {
      return reply.code(200).send({
        message: 'Confiança do movimento abaixo do limite configurado',
        action: 'none',
        confidence,
        threshold: confidenceThreshold
      });
    }
    
    // Verificar se devemos gravar
    if (camera.motionDetection.recordOnMotion) {
      // Em uma implementação real, você iniciaria a gravação aqui
      // Por enquanto, apenas registramos o evento
      
      // Verificar se já existe uma gravação recente (cooldown)
      const cooldownPeriod = camera.motionDetection.cooldownPeriod || 60;
      const recentRecording = await prisma.recording.findFirst({
        where: {
          cameraId,
          recordingType: 'MOTION',
          createdAt: {
            gte: new Date(Date.now() - cooldownPeriod * 1000)
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (recentRecording) {
        return reply.code(200).send({
          message: 'Período de cooldown ativo, gravação não iniciada',
          action: 'none',
          lastRecording: recentRecording.createdAt
        });
      }
      
      // Registrar no log (em uma implementação real, você iniciaria a gravação)
      console.log(`Movimento detectado na câmera ${cameraId} com confiança ${confidence}%, iniciando gravação`);
      
      // Se deve notificar
      if (camera.motionDetection.notifyOnMotion) {
        // Em uma implementação real, você enviaria notificações aqui
        console.log(`Enviando notificação de movimento para a câmera ${cameraId}`);
      }
      
      // Retornar resposta indicando que a gravação deve ser iniciada
      return reply.code(200).send({
        message: 'Movimento detectado, iniciando gravação',
        action: 'record',
        config: {
          preBuffer: camera.motionDetection.preRecordingBuffer,
          postBuffer: camera.motionDetection.postRecordingBuffer,
          minDuration: camera.motionDetection.minMotionDuration
        }
      });
    }
    
    return reply.code(200).send({
      message: 'Movimento detectado, mas gravação não está habilitada',
      action: 'none'
    });
    
  } catch (error) {
    console.error('Erro ao processar detecção de movimento:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao processar detecção de movimento'
    });
  }
}

module.exports = {
  getMotionDetectionConfig,
  saveMotionDetectionConfig,
  handleMotionDetected
}; 