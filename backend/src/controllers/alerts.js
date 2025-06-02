const { PrismaClient } = require('@prisma/client');
const { sendCameraStatusAlert } = require('../services/emailService');

const prisma = new PrismaClient();

/**
 * Lista configurações de alertas para um usuário
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function getAlertConfigurations(request, reply) {
  try {
    const { role, id: userId } = request.user;
    const { cameraId } = request.query;
    
    let where = {};
    
    // Filtrar por câmera específica se fornecida
    if (cameraId) {
      where.cameraId = cameraId;
    }
    
    // Adicionar filtro por usuário (cliente só vê suas próprias configurações)
    if (role === 'CLIENT') {
      where.userId = userId;
    } else if (role === 'INTEGRATOR') {
      // Integradores podem ver suas próprias configurações e as dos seus clientes
      const integrator = await prisma.integrator.findUnique({
        where: { userId },
        include: {
          clients: {
            select: { userId: true }
          }
        }
      });
      
      if (!integrator) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Usuário não é um integrador válido'
        });
      }
      
      const clientUserIds = integrator.clients.map(client => client.userId);
      where.OR = [
        { userId },
        { userId: { in: clientUserIds } }
      ];
    }
    
    const configurations = await prisma.alertConfiguration.findMany({
      where,
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            status: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return reply.code(200).send(configurations);
    
  } catch (error) {
    console.error('Erro ao listar configurações de alertas:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao buscar configurações'
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
    const { role, id: userId } = request.user;
    const { cameraId, emailAddresses, notifyOnline, notifyOffline, targetUserId } = request.body;
    
    // Apenas integradores e admins podem criar configurações de alerta
    if (role !== 'INTEGRATOR' && role !== 'ADMIN') {
      return reply.code(403).send({
        error: 'Permissão negada',
        message: 'Apenas integradores podem configurar alertas'
      });
    }
    
    // Verificar se a câmera existe
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      include: {
        client: true
      }
    });
    
    if (!camera) {
      return reply.code(404).send({
        error: 'Câmera não encontrada',
        message: 'A câmera solicitada não existe'
      });
    }
    
    // Verificar permissão do integrador para a câmera
    if (role === 'INTEGRATOR') {
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para configurar alertas para esta câmera'
        });
      }
    }
    
    // Verificar o usuário alvo
    const targetUser = targetUserId ? 
      await prisma.user.findUnique({ where: { id: targetUserId } }) : 
      await prisma.user.findUnique({ where: { id: userId } });
    
    if (!targetUser) {
      return reply.code(404).send({
        error: 'Usuário não encontrado',
        message: 'O usuário alvo não existe'
      });
    }
    
    // Para integradores configurando para clientes, verificar se é cliente deles
    if (role === 'INTEGRATOR' && targetUser.role === 'CLIENT' && targetUser.id !== userId) {
      const integrator = await prisma.integrator.findUnique({
        where: { userId },
        include: {
          clients: {
            where: { userId: targetUser.id }
          }
        }
      });
      
      if (!integrator || integrator.clients.length === 0) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Este usuário não é seu cliente'
        });
      }
    }
    
    // Criar configuração de alerta
    const configuration = await prisma.alertConfiguration.create({
      data: {
        cameraId,
        userId: targetUser.id,
        emailAddresses,
        notifyOnline: notifyOnline !== false, // default true
        notifyOffline: notifyOffline !== false, // default true
        createdBy: userId
      }
    });
    
    return reply.code(201).send(configuration);
    
  } catch (error) {
    console.error('Erro ao criar configuração de alerta:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao criar configuração'
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
    const { id } = request.params;
    const { role, id: userId } = request.user;
    const { emailAddresses, notifyOnline, notifyOffline } = request.body;
    
    // Buscar configuração existente
    const configuration = await prisma.alertConfiguration.findUnique({
      where: { id },
      include: {
        camera: {
          include: {
            integrator: true
          }
        }
      }
    });
    
    if (!configuration) {
      return reply.code(404).send({
        error: 'Configuração não encontrada',
        message: 'A configuração de alerta solicitada não existe'
      });
    }
    
    // Verificar permissão
    if (role === 'CLIENT') {
      // Cliente só pode editar suas próprias configurações
      if (configuration.userId !== userId) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para editar esta configuração'
        });
      }
    } else if (role === 'INTEGRATOR') {
      // Integrador pode editar configurações de seus clientes e suas próprias
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || configuration.camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para editar esta configuração'
        });
      }
    }
    
    // Atualizar configuração
    const updatedConfiguration = await prisma.alertConfiguration.update({
      where: { id },
      data: {
        emailAddresses: emailAddresses !== undefined ? emailAddresses : undefined,
        notifyOnline: notifyOnline !== undefined ? notifyOnline : undefined,
        notifyOffline: notifyOffline !== undefined ? notifyOffline : undefined,
      }
    });
    
    return reply.code(200).send(updatedConfiguration);
    
  } catch (error) {
    console.error('Erro ao atualizar configuração de alerta:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao atualizar configuração'
    });
  }
}

/**
 * Remove uma configuração de alerta
 * @param {Object} request - Requisição
 * @param {Object} reply - Resposta
 */
async function deleteAlertConfiguration(request, reply) {
  try {
    const { id } = request.params;
    const { role, id: userId } = request.user;
    
    // Buscar configuração existente
    const configuration = await prisma.alertConfiguration.findUnique({
      where: { id },
      include: {
        camera: {
          include: {
            integrator: true
          }
        }
      }
    });
    
    if (!configuration) {
      return reply.code(404).send({
        error: 'Configuração não encontrada',
        message: 'A configuração de alerta solicitada não existe'
      });
    }
    
    // Verificar permissão
    if (role === 'CLIENT') {
      // Cliente só pode excluir suas próprias configurações
      if (configuration.userId !== userId) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para excluir esta configuração'
        });
      }
    } else if (role === 'INTEGRATOR') {
      // Integrador pode excluir configurações de seus clientes e suas próprias
      const integrator = await prisma.integrator.findUnique({
        where: { userId }
      });
      
      if (!integrator || configuration.camera.integratorId !== integrator.id) {
        return reply.code(403).send({
          error: 'Permissão negada',
          message: 'Você não tem permissão para excluir esta configuração'
        });
      }
    }
    
    // Excluir configuração
    await prisma.alertConfiguration.delete({
      where: { id }
    });
    
    return reply.code(204).send();
    
  } catch (error) {
    console.error('Erro ao excluir configuração de alerta:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Ocorreu um erro ao excluir configuração'
    });
  }
}

/**
 * Processa alteração de status de uma câmera e envia alertas se necessário
 * @param {string} cameraId - ID da câmera
 * @param {string} newStatus - Novo status ('online' ou 'offline')
 * @param {string} previousStatus - Status anterior
 */
async function processCameraStatusChange(cameraId, newStatus, previousStatus) {
  try {
    if (newStatus === previousStatus) {
      return { success: true, message: 'Status não mudou' };
    }
    
    // Registrar alerta
    await prisma.alert.create({
      data: {
        cameraId,
        status: newStatus
      }
    });
    
    // Buscar câmera com dados relacionados
    const camera = await prisma.camera.findUnique({
      where: { id: cameraId },
      include: {
        client: true,
        integrator: true
      }
    });
    
    if (!camera) {
      console.error(`Câmera não encontrada: ${cameraId}`);
      return { success: false, error: 'Câmera não encontrada' };
    }
    
    // Buscar configurações de alerta para esta câmera
    const alertConfigurations = await prisma.alertConfiguration.findMany({
      where: {
        cameraId,
        // Filtrar com base no tipo de alerta (online/offline)
        OR: [
          { notifyOnline: true, ...(newStatus === 'online' ? {} : { id: 'none' }) },
          { notifyOffline: true, ...(newStatus === 'offline' ? {} : { id: 'none' }) }
        ]
      }
    });
    
    // Enviar e-mails de alerta para cada configuração
    const emailPromises = alertConfigurations.map(config => {
      return sendCameraStatusAlert(config.emailAddresses, camera, newStatus);
    });
    
    await Promise.all(emailPromises);
    
    return {
      success: true,
      alertCount: alertConfigurations.length,
      message: `${alertConfigurations.length} alertas enviados`
    };
    
  } catch (error) {
    console.error('Erro ao processar mudança de status da câmera:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getAlertConfigurations,
  createAlertConfiguration,
  updateAlertConfiguration,
  deleteAlertConfiguration,
  processCameraStatusChange
}; 